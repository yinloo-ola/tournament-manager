# Implementation Plan: Pure-Frontend Slice 2 — Entry Import (Singles / Doubles / Team) via ExcelJS

## Overview
Design: `docs/plans/2026-08-01-pure-frontend-slice2-entry-import-design.md`

Import tournament entries from `.xlsx` entirely in-browser with ExcelJS, replacing the three `apiImport*Entry` server round-trips. Code lives in `features/entry/` (importers) and `shared/excel/` (ExcelJS wrapper), per the design's `## Architecture`.

**Ordering rationale.** Requirements run in dependency order, each landing green on its own:
- **R1** builds the shared `readWorkbook` layer and the **Go-captured regression baselines** — this is the fidelity crux of the whole slice (raw cell values, serial dates, interior blanks) and must be proven *before* any importer exists.
- **R2–R4** are near-verbatim ports of the Go importers, each gated by a golden test against its committed baseline plus unit tests for the join/optional-column edges.
- **R5** rewires `CategoryCard`/`TournamentView` to the local pipeline (async `readWorkbook` → sync importer → emit), dropping the three `fetch` calls.
- **R6** removes the now-dead `apiImport*Entry` exports from `client.ts`, grep-gated.

**Intended branch** (created during `pwk-executing-tasks`, not here — this phase is read-only): `feature/pure-frontend-slice2-entry-import`.

**New file layout:**
- `web/src/shared/excel/readWorkbook.ts` — ExcelJS wrapper; `__tests__/readWorkbook.test.ts`
- `web/src/features/entry/domain/importSingles.ts` — port of `endpoint/entry/internal/singles.go`
- `web/src/features/entry/domain/importDoubles.ts` — port of `endpoint/entry/internal/doubles.go`
- `web/src/features/entry/domain/importTeam.ts` — port of `endpoint/entry/internal/team.go`
- `web/src/features/entry/domain/__tests__/` — unit + golden tests for the three importers
- `web/src/features/entry/__tests__/entryImport.feature.test.ts` — feature acceptance
- `web/src/features/entry/__tests__/golden/` — committed Go-captured baselines (`singles|doubles|team.rows.json`, `singles|doubles|team.golden.json`)
- `endpoint/entry/internal/tests/golden_baseline_test.go` — Go-side oracle guard + baseline generator (`-update`)

Tests live in `__tests__/` dirs next to each module (matches the vitest include glob `src/**/__tests__/**/*.test.ts`).

**Key parity facts (verified against the committed fixtures `testdata/Men Singles.xlsx`, `Mens Doubles.xlsx`, `Mens Team.xlsx`):**
- All three workbooks name their sheets `entries` (and `players` for Doubles/Team) — ExcelJS reads by name, exactly as Go's `GetRows(sheetName)`.
- `Date Of Birth` cells are **Excel serial dates** (e.g. `36892`) stored as raw numbers with date number formats. Go's `GetRows(RawCellValue: true)` returns them as the raw serial string (`"36892"`). The TS port must reproduce this — **not** a formatted date, **not** a JS `Date`. This is the single highest-fidelity risk.
- excelize `GetRows` inserts `""` for **interior** blank cells and drops **trailing** blanks. This matters: in the Singles fixture, row 10 (Simon Gauzy) has no Seeding cell; with interior-blank insertion the row is length 6 and passes the `len(row) < len(header)` guard — without it, the row would be length 5 and *silently skipped*, dropping a player. The wrapper must replicate this exact row-shape semantics.
- Go `pointer.OrNil` omits `club`/`seeding` from JSON when empty/zero, and Team entries always carry `minPlayers`/`maxPlayers`.
- Team fixture: 9 teams × 3 players; `minPlayers=maxPlayers=3` is the golden-safe bound. One entries row (Ipad) has no Club — exercises the optional-column path.
- Error-message parity decisions (per `docs/lessons.md` "decide error-message parity at the throw site"): the UI surfaces `error.message` via `alert`. Go's *inner* messages are the parity target: `failed to parse seeding`, `player with SN %s not found in players sheet` (note: Go writes "SN" but interpolates the **name** — reproduce verbatim, do not "fix"), `team %s not found in players sheet`, `team %s has %d players, which is not between %d and %d`, `sheet %s does not exist` (missing sheet). The old HTTP prefix (`Failed to import singles entry: …`) is dropped — that was transport noise, not behavior.

**Production-risk areas** (carried from the design): **Medium — Excel read fidelity.** Cell-value typing (ExcelJS may return a `number` or coerce a date-formatted cell to a JS `Date` where Go read a raw string), whitespace/trimming, and the two-sheet join keys (doubles joins **by name**, not SN). Mitigation is oracle-driven: R1 pins `readWorkbook` to a Go-captured raw-rows baseline; R2–R4 pin each importer to a Go-captured `Entry[]` golden baseline; both compare full JSON equality.

---

## Setup

- **New web dependency:** `exceljs` in `web/package.json` (verify: `npm install exceljs` in `web/`; `npx vitest run` still passes with the existing suite). ExcelJS ships its own TypeScript types — no `@types/exceljs` needed unless the build says otherwise.
- **Oracle fixtures already committed:** `testdata/Men Singles.xlsx`, `testdata/Mens Doubles.xlsx`, `testdata/Mens Team.xlsx` (used by web tests as `resolve(process.cwd(), '../testdata/<name>')` — the same pattern as `model.test.ts`).
- **Baseline generation** (part of R1): `endpoint/entry/internal/tests/golden_baseline_test.go` reads each fixture, runs the Go importer, and either **asserts** its output matches the committed baseline or **rewrites** it with `-update`. Run `go test ./endpoint/entry/...` to verify the committed baselines match today's Go behavior.
- **How to verify setup worked:** `go test ./endpoint/entry/...` passes (baselines equal Go output); `web/src/features/entry/__tests__/readWorkbook.test.ts` passes (raw rows equal the committed `*.rows.json`); `vue-tsc --build --force` and the existing vitest suite stay green.

---

## Requirement 1: `readWorkbook` — raw-value ExcelJS wrapper + regression baselines

`web/src/shared/excel/readWorkbook.ts`: a thin ExcelJS wrapper mirroring Go's `GetRows(sheetName, Options{RawCellValue: true})`. Exports `readWorkbook(source: File | ArrayBuffer): Promise<Record<string, string[][]>>` — sheet name → rows of raw cell values **as strings**, exactly as Go returns them (`[][]string`). Importers consume only this shape, so the Go ports stay near-verbatim.

### Acceptance criteria
- Given an uploaded `.xlsx` (File or ArrayBuffer), when `readWorkbook` resolves, then it returns one `string[][]` per sheet keyed by **sheet name** (`entries`, `players`), including the header row, with every cell value a string exactly as excelize `GetRows(RawCellValue: true)` produces.
- Given a `Date Of Birth` cell storing an Excel serial (e.g. `36892`) with a date number format, when read, then the value is the raw serial string `"36892"` — **not** a formatted date and **not** a JS `Date`. (ExcelJS date-coerces date-formatted cells; the wrapper must defeat that — recover the raw serial from the cell's underlying value, and reject date-coercion. Fixtures use the 1900 date system.)
- Given a row with an interior blank cell (e.g. Singles row 10, missing Seeding), when read, then that cell is `""` and the row keeps its full width (`len(row) == 6`) — matching Go's `appendSpace` interior-blank insertion.
- Given a row with trailing blank cells, when read, then the trailing blanks are dropped (`len(row)` ends at the last non-blank) — matching Go's `GetRows`.
- Given a numeric cell (Seeding, SN), when read, then it is the raw numeric string (`"1"`, not `"1.0"`); a shared-string cell returns its text; whitespace is **not** trimmed by the wrapper (importers trim, as Go does).
- Given any of the three fixtures, when `readWorkbook` parses it, then the rows deep-equal the committed Go-captured `*.rows.json` for every sheet. *(The oracle: captured from Go, not from the TS implementation.)*

### Integration tests
- `should expose raw serial dates, not JS Dates` — given a fixture's DOB cells, when `readWorkbook` runs, then `rows[i][4]` equals the Go serial string (`"36892"`, …) and is `typeof 'string'` (never a `Date`).
- `should insert interior blanks and trim trailing blanks (Go row-shape parity)` — given the Singles fixture, when `readWorkbook` runs, then the Simon Gauzy row (no Seeding) has length 6 with `""` at index 3, and no row carries trailing `""`.
- `should stringify numbers without float artifacts` — given Seeding/SN cells, when read, then values are `"1"`…`"27"` (no `.0` suffix).
- `should match the Go-captured raw rows for all three fixtures` — given `readWorkbook(fixtureBuffer)`, then each sheet's `string[][]` `toEqual` the corresponding committed `*.rows.json` (singles/doubles/team).

### Checkpoints: full
### Review: parallel

### Production-risk notes
- **ExcelJS date-coercion is the highest-risk line in the slice.** If the executor's spike (first task of R1) shows ExcelJS cannot expose the raw serial through its public cell API, resolve it before proceeding (convert the coerced `Date` back to the 1900 serial, or read the cell's raw model value) and let the `*.rows.json` comparison arbitrate. Do **not** "fix" the serial into a formatted date — today's Go output ships the serial string, and the whole slice's contract is byte-parity with it.
- Row-shape semantics (interior `""`, trailing trim) are load-bearing: without them the `len(row) < header` guards diverge from Go and rows are silently dropped. Covered by the dedicated row-shape test.
- `readWorkbook` is `async` (ExcelJS read is Promise-based); the *importers* (R2–R4) are **synchronous** over the returned workbook — do not make them async (see `docs/lessons.md`: sync throwers are invoked synchronously at the orchestration layer).

---

## Requirement 2: Singles import

`web/src/features/entry/domain/importSingles.ts` — port of `endpoint/entry/internal/singles.go`. Signature: `importSinglesEntries(workbook: Record<string, string[][]>): EntryLike[]` (synchronous; throws on error). Returns **plain Entry-shaped objects** (the old `apiImport*` `res.json()` contract — `TournamentView.playersImported` rehydrates via `Entry.from`), with `entryType: 'Singles'` and the sub-object key order matching the Go model (`entryType, seeding, club, singlesEntry`).

### Acceptance criteria
- Given a workbook with an `entries` sheet, when `importSinglesEntries` runs, then it skips the header row, trims Name / Date Of Birth / Gender whitespace, treats Club and Seeding as optional, and produces one `EntryLike` per data row with `singlesEntry.player = { name, dateOfBirth, gender }`.
- Given a row with a blank Seeding cell (Singles fixture row 10), when imported, then `seeding` is omitted from the object (Go `pointer.OrNil(0)` → nil → `omitempty`), and the player is **not** dropped.
- Given a row with fewer columns than the 6-cell header after interior-blank insertion, when imported, then it is skipped (Go `len(row) < len(header)` guard).
- Given a non-empty Seeding that is not a strict integer (Go `strconv.Atoi` semantics: optional sign + digits; rejects `1.5`, `abc`, `""`), when imported, then it throws `Error("failed to parse seeding")`.
- Given a missing `entries` sheet, when imported, then it throws `Error("sheet entries does not exist")` (excelize's message).
- Given the Singles fixture, when imported, then `JSON.stringify(entries)` is **byte-for-byte equal** to the committed `singles.golden.json` (27 players; DOB serials carried through as-is).

### Integration tests
- `should match the Go golden output for Men Singles.xlsx` — given the fixture, when `importSinglesEntries(await readWorkbook(fixture))` runs, then `JSON.stringify(entries) === baselineString` **and** `entries` `toEqual` `JSON.parse(baseline)` (byte-parity is the hard claim; `toEqual` guards field-order drift).
- `should parse a valid seeding and omit an empty one` — given rows with Seeding `"5"` and `""`, then the first entry carries `seeding: 5` and the second omits `seeding`.
- `should throw failed to parse seeding on a non-integer seeding` — given Seeding `"abc"` / `"1.5"`, then it throws with the exact message.
- `should skip short rows and preserve an interior-blank optional column` — given the Simon Gauzy-style row (5 non-trailing cells), then the entry is kept with no `seeding` key.
- `should throw sheet entries does not exist for a workbook lacking the sheet` — given `{}`, then it throws the exact message.

### Checkpoints: spec
### Review: inline

### Production-risk notes
- DOB is intentionally the raw serial string (`dateOfBirth: "36892"`) — that is today's Go behavior and the golden baseline; a reviewer may flag it as odd. It is correct parity; do not reformat.

---

## Requirement 3: Doubles import

`web/src/features/entry/domain/importDoubles.ts` — port of `endpoint/entry/internal/doubles.go`. Signature: `importDoublesEntries(workbook): EntryLike[]` (synchronous). Reads `players` (header `SN, Name, Date Of Birth, Gender`) and `entries` (header `SN, Player1, Player2, Club, Seeding`), joining players to entries **by name** (not SN), producing `entryType: 'Doubles'` with a 2-player array.

### Acceptance criteria
- Given a workbook with `players` and `entries` sheets, when `importDoublesEntries` runs, then it builds a name→player map from the `players` sheet (skipping header, trimming Name/DOB/Gender, guarding `len(row) < 4`), then resolves each entry's two players by trimmed name, skipping `entries` rows with `len(row) < 3` and treating Club/Seeding as optional (interior-blank semantics per R1).
- Given duplicate player names in the `players` sheet, when imported, then the **last** occurrence wins (Go map overwrite semantics).
- Given an entry naming a player absent from the `players` sheet, when imported, then it throws `Error("player with SN <name> not found in players sheet")` — the message interpolates the player **name** even though Go writes "SN"; reproduce verbatim.
- Given a non-empty non-integer Seeding, when imported, then it throws `Error("failed to parse seeding")` (same as R2).
- Given the Doubles fixture, when imported, then `JSON.stringify(entries)` is byte-for-byte equal to `doubles.golden.json` (club/seeding from the `entries` sheet, player details from `players`).

### Integration tests
- `should match the Go golden output for Mens Doubles.xlsx` — byte-for-byte + `toEqual` against the committed baseline.
- `should resolve both players by name from the players sheet` — given entries referencing names in `players`, then each entry's `doublesEntry.players` carries the DOB/gender from `players`.
- `should throw player with SN <name> not found in players sheet` — given an entry referencing an unknown name, then it throws the exact message (name, not SN, interpolated).
- `should let the last duplicate name win` — given two `players` rows with the same name, then the entry resolves to the second row's details.
- `should skip short entries rows and keep club/seeding optional` — given a row with only `SN, Player1, Player2`, then it is imported with no `club`/`seeding` keys; given `len(row) < 3`, it is skipped.

### Checkpoints: spec
### Review: inline

### Production-risk notes
- The by-name (not by-SN) join is the subtle parity point; the golden test and the missing-player unit test pin it. Note the players sheet in the fixture has **no** Club column — Club comes only from the `entries` sheet, exactly as Go reads it.

---

## Requirement 4: Team import

`web/src/features/entry/domain/importTeam.ts` — port of `endpoint/entry/internal/team.go`. Signature: `importTeamEntries(workbook, minPlayers: number, maxPlayers: number): EntryLike[]` (synchronous). Reads `players` (header `SN, Name, Date Of Birth, Gender, Team`) grouped **by team**, and `entries` (header `SN, <team>, Club, Seeding`), validating each team's player count against `[minPlayers, maxPlayers]`.

### Acceptance criteria
- Given a workbook with `players` and `entries` sheets, when `importTeamEntries` runs, then it builds a team→player[] map from `players` (guarding `len(row) < 5`, trimming Name/DOB/Gender/Team), resolves each entries row's team by trimmed name (skipping `len(row) < 3`, Club/Seeding optional), and produces `entryType: 'Team'` with `teamEntry = { teamName, players, minPlayers, maxPlayers }`.
- Given a team whose player count is outside `[minPlayers, maxPlayers]`, when imported, then it throws `Error("team <team> has <n> players, which is not between <min> and <max>")` — exact Go format.
- Given an entries row naming a team absent from `players`, when imported, then it throws `Error("team <team> not found in players sheet")`.
- Given a non-empty non-integer Seeding, when imported, then it throws `Error("failed to parse seeding")`.
- Given the Team fixture with `minPlayers = maxPlayers = 3`, when imported, then `JSON.stringify(entries)` is byte-for-byte equal to `team.golden.json` (9 teams × 3 players; the club-less Ipad row omits `club`; `minPlayers`/`maxPlayers` are always present).

### Integration tests
- `should match the Go golden output for Mens Team.xlsx at min=max=3` — byte-for-byte + `toEqual` against the committed baseline.
- `should group players by team and carry min/max into each teamEntry` — given teams of 3, when imported with `min=3, max=5`, then each entry's `teamEntry.players` has the team's 3 players and `minPlayers/maxPlayers` are set.
- `should throw the exact count-range message` — given a 3-player team with `min=4, max=5`, then it throws `team <team> has 3 players, which is not between 4 and 5`.
- `should throw team <team> not found in players sheet` — given an entries row naming a team with no `players` rows, then it throws the exact message.
- `should keep club/seeding optional` — given the club-less Ipad row, then `club` is omitted and `seeding` is present.

### Checkpoints: spec
### Review: inline

### Production-risk notes
- The `[minPlayers, maxPlayers]` validation and exact range message are the parity-sensitive parts here; the golden test at `min=max=3` pins the fixture path, and the range unit test pins the error format.

---

## Requirement 5: CategoryCard + TournamentView wiring

Replace the three `apiImport*Entry` calls in `web/src/features/tournament-config/ui/CategoryCard.vue` with the local pipeline, and keep the `players-imported` emit contract intact so `TournamentView.vue`'s `playersImported` (rehydrate via `Entry.from`, assign `grpIdx`, clear/repopulate groups) is untouched.

### Acceptance criteria
- Given a file selected on the CategoryCard input, when the entry type is Singles/Doubles, then `readWorkbook(file)` resolves and the matching importer runs **synchronously** inside the orchestrator's `try/catch`, emitting `playersImported(entries)` — with **no `fetch`** call.
- Given the entry type is Team, when a file is selected, then the existing client-side guards still run first (min/max set, both > 0, min ≤ max → alert and return), then `importTeamEntries(workbook, minPlayers, maxPlayers)` runs and emits.
- Given an importer throws (parse/join/range/sheet error), when the file is selected, then the error's exact `message` is surfaced via `alert` and the current document is **not** modified (no emit, no partial entries).
- Given the file input, when import completes or fails, then the input value is reset (`file.value = ''`) as today.
- Given the workbook read is still pending, when the file is selected, then no entry mutation occurs before resolution (the async boundary is only around `readWorkbook`, not the importer).
- `CategoryCard` no longer imports from `@/client/client` for entry import; `apiImportSinglesEntry` / `apiImportDoublesEntry` / `apiImportTeamEntry` are not referenced anywhere in `web/src`.

### Integration tests
- `should import entries locally via readWorkbook + importer and emit players-imported` — given CategoryCard mounted with `readWorkbook` mocked to return a small inline workbook and the real importer running, when a file is selected, then `playersImported` emits the importer's `EntryLike[]` and `fetch` was never called (fetch mocked).
- `should surface an importer error via alert and not emit` — given `readWorkbook` resolving to a workbook that makes the importer throw (e.g. missing sheet), when a file is selected, then `alert` was called with the exact Go-parity message and `playersImported` was **not** emitted.
- `should run the team guards before importing` — given a Team category with unset/invalid min/max, when a file is selected, then the guard alert fires and the importer is never invoked.
- `should reset the file input after import` — given a completed import, then the input's value is cleared.

### Checkpoints: full
### Review: parallel

### Production-risk notes
- The sync-thrower lesson applies: importers throw synchronously; the orchestrator's `try/catch` around the *sync* importer call intercepts directly — do **not** wrap the importer in `await`/a promise chain (that converts the throw into an unhandled rejection and mis-routes the `Error`). Only `readWorkbook` is awaited. The component tests assert the alert path and that no `fetch` occurs.
- Component tests mock `readWorkbook` (per `docs/lessons.md`: thin I/O seams are mocked at the orchestration layer); the real ExcelJS path is covered by R1–R4 golden tests, so jsdom never needs to parse a real workbook here.

---

## Requirement 6: Structural cleanup — drop the legacy client functions

Remove the now-dead `apiImportSinglesEntry` / `apiImportDoublesEntry` / `apiImportTeamEntry` from `web/src/client/client.ts`, gated by a no-remaining-import check.

### Acceptance criteria
- Given R5 complete, when cleanup runs, then the three `apiImport*Entry` exports are deleted from `client.ts`; `apiImportFinalSchedule` and the export functions remain.
- No source under `web/src` imports the deleted symbols: `grep -rn "apiImportSinglesEntry\|apiImportDoublesEntry\|apiImportTeamEntry" web/src` returns zero matches across `.ts`/`.vue`.
- `vue-tsc --build --force` and the full vitest suite pass (no dangling imports).

### Integration tests
- `should have no remaining references to the removed import endpoints` — given the tree after R5, when grepping `web/src` for the three symbol names, then zero matches are found and the build (`vue-tsc`) succeeds.

### Checkpoints: none
### Review: skip

### Production-risk notes
- Pure deletion with zero behavioral surface (the UI already switched in R5). The hard gate is the grep + type-check: if any call site was missed, the build fails. Go-side endpoints stay (slice 5 removes them) — out of scope.

---

## Feature acceptance

- `should import all three fixtures to byte-identical Go entries with no server` — Given `Men Singles.xlsx`, `Mens Doubles.xlsx`, and `Mens Team.xlsx` (read from `../testdata/` as real Buffers), **when** `readWorkbook` + the matching importer runs (`min=max=3` for Team) and the result is rehydrated through `Entry.from` (projecting away the assigned `grpIdx`, as `TournamentView.playersImported` does), **then** each category's entries are byte-for-byte identical to the committed Go golden baseline, **and** no HTTP request was made (fetch mocked and asserted unused) — the full in-browser pipeline with no server.

## Notes on test philosophy (from `docs/lessons.md`)
- The baselines are captured **once from Go** (the oracle) and committed; TS golden tests assert against them — never a self round-trip of the TS implementation.
- Byte-for-byte is the hard parity claim (`JSON.stringify(tsOutput) === baselineString`), paired with `toEqual(JSON.parse(baseline))` to catch field-order drift. The importer builds plain objects in Go model field order (`entryType, seeding, club, <type entry>`), so stringified output matches Go's marshal ordering.
- Importers return **plain Entry-shaped objects**, not `Entry` class instances (the old `res.json()` contract); rehydration stays in `TournamentView.playersImported` via `Entry.from` — no strict-validation changes to the model (per the permissive-factory lesson).
- Error messages are asserted as exact strings at the throw site, per the Go→TS error-parity lesson.
