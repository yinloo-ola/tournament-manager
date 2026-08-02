# Implementation Plan: Pure-Frontend Slice 3 — Schedule (Draft Generation + Draft .xlsx Export + Final .xlsx Import/Merge)

## Overview
Design: `docs/plans/2026-08-01-pure-frontend-slice3-schedule-design.md`

Port the full schedule round-trip to run entirely in-browser: generate the draft schedule, export it as a styled multi-sheet `.xlsx` via ExcelJS, and re-import the user-edited `.xlsx` merging the final schedule back into the tournament. Replaces `apiExportDraftSchedule` and `apiImportFinalSchedule`. Code lives in `features/schedule/`. **This is the largest and highest-risk slice** — it concentrates the rewrite's Excel fidelity risk (styles, hyperlinks, sheet protection, date handling).

**Ordering rationale.** Requirements run in dependency order, each landing green on its own:
- **R1** ports the two leaf utilities (HSL→hex color, cell-address splitting) — no dependencies on other new code; proven before anything consumes them.
- **R2** ports `scheduleMatches` (the deterministic greedy scheduler) — depends only on model types; gated by a Go-captured schedule golden.
- **R3** ports `CreateDraftSchedule` to ExcelJS (the draft `.xlsx` writer) — depends on R1 (color) + R2 (schedule); gated by a structural comparison against a Go-generated `.xlsx`.
- **R4** ports `ImportFinalSchedule` (the final `.xlsx` reader/merger) — depends on R1 (address splitting); gated by round-trip cross-validation against the Go oracle.
- **R5** rewires `TournamentView` to the local pipeline (generate → export blob download, import → parse → merge), dropping the two `fetch` calls; grep-gated cleanup of dead client functions.

**Intended branch** (created during `pwk-executing-tasks`, not here — this phase is read-only): `feature/pure-frontend-slice3-schedule`.

**New file layout:**
- `web/src/features/schedule/domain/scheduleMatches.ts` — port of `scheduleMatches` + `getSlotsForCategory{Group,Knockout}` + `Schedule`/`TimeSlot` types
- `web/src/features/schedule/excel/color.ts` — port of `utils/color` (HSL→hex, deterministic)
- `web/src/features/schedule/excel/draftScheduleWorkbook.ts` — port of `draft_schedule.go` populate* writers (ExcelJS)
- `web/src/features/schedule/domain/importFinalSchedule.ts` — port of `ImportFinalSchedule` + `getMatchFromCellAddr` + group/knockout assembly
- `web/src/shared/excel/address.ts` — cell-name splitting (port of `excelize.SplitCellName` behavior)
- `web/src/features/schedule/domain/__tests__/` — unit + golden tests
- `web/src/features/schedule/excel/__tests__/` — workbook structural tests
- `web/src/features/schedule/__tests__/` — feature acceptance
- `web/src/features/schedule/__tests__/golden/` — committed Go-captured baselines
- `endpoint/schedule/internal/tests/schedule_oracle_test.go` — Go-side oracle guard + baseline generators (`-update`)

Tests live in `__tests__/` dirs next to each module (matches the vitest include glob `src/**/__tests__/**/*.test.ts`).

**Key parity facts (verified against Go source):**
- **UTC datetime parsing.** Go's `model.Date.UnmarshalJSON` uses `time.Parse("2006-01-02T15:04", value)` — Go treats a layout without timezone as **UTC**. But JS `new Date("2025-03-22T09:00")` (no `Z`) is **local time** per the ECMAScript spec. The TS scheduler must parse `startTime` as UTC explicitly (append `'Z'` or use `Date.UTC`) to match Go's time arithmetic. This is the single most subtle parity trap in the slice.
- **Color non-determinism in Go.** `utils/color.GenerateColors` seeds `rand` with `time.Now()` and adds `±10°` random hue jitter — colors vary run-to-run. The TS port makes color generation **deterministic** (drop the jitter, use evenly spaced hues with fixed S/L) — a deliberate, documented behavior change (colors are decorative; the design explicitly approves this).
- **Match hyperlink offset.** In `populateSchedule`, `sn` is incremented *before* building `matchLink`, so `matchLink = "matches!A{sn}"` where `sn` (post-increment) coincidentally equals `matchesRow` (pre-increment) — the link points to the correct row. Port the exact same counter logic.
- **`excelhelper.SplitRowCol` is dead code** — not called anywhere. The actual import uses `excelize.SplitCellName` (via `getMatchFromCellAddr`). Port the cell-name splitting behavior, not the dead helper.
- **Import reads hyperlinks, not just cell values.** The Slice 2 `readWorkbook` returns `string[][]` (raw values only) — it cannot expose hyperlink metadata. The import must work with the **ExcelJS workbook object directly** (`worksheet.getCell(addr)`) to detect and follow internal hyperlinks from the schedule grid to the matches sheet.
- **Sheet protection password:** `matchesSheetPassword = "12345654321"` (hardcoded in Go).
- **`NumFmt: 22`** = `m/d/yyyy h:mm` (Excel built-in format 22) for datetime cells.
- **1-indexed offsets in matches sheet:** `Round` and `Group` columns store `roundIdx+1` and `groupIdx+1`; entry indices store `entryIdx+1`. Import subtracts 1 to recover 0-indexed model values. `Entry1Idx`/`Entry2Idx` columns are only written when both ≥ 0 (bye/empty matches skip them); import reads empty as 0 → 0−1 = −1 = `EntryEmptyIdx`.
- **Knockout `Match.Name()` formatting:** Round 2 → `" F"`, Round 4 → `" SF"`, Round 8 → `" QF"`, else → `" R{round}"`. Group matches → `" Grp{groupIdx+1}"`. This display text is written to schedule cells.
- **`grpMatchTable` table assignment** (group scheduler): iterates groups, assigns each match-in-round-0 to tables round-robin (`tableIdx = (tableIdx + 1) % numTables`), then later rounds reuse the same table assignment for the same match index within the group.

**Production-risk areas** (from the design): **HIGH — Excel write/read fidelity.** Styles (fills, borders, fonts), merged cells, column widths, internal hyperlinks (location type), and sheet protection must all work in ExcelJS. Each is supported but each is a fidelity checkpoint. Mitigation: Go oracle-driven structural comparison (values, layout, non-color styles) + round-trip cross-validation. Colors are validated for format (`#RRGGBB`) only, not exact value.

---

## Setup

- **ExcelJS already installed** (Slice 2 dependency in `web/package.json`). Verify: `npx vitest run` passes with existing suite.
- **Go oracle harness** (part of R1/R2): `endpoint/schedule/internal/tests/schedule_oracle_test.go` constructs a representative tournament with populated groups + knockout rounds (similar to the existing `draft_schedule_test.go` data), runs `scheduleMatches` and/or `CreateDraftSchedule`, and captures golden baselines with a `-update` flag. The committed baselines pin the TS ports to Go's exact output.
- **Test fixture gap.** The existing `testdata/tournament.json` has only 1 entry per category with empty groups — `scheduleMatches` on it produces zero time-slots (trivially correct, but proves nothing). The oracle must construct a tournament with enough entries to exercise multi-group, multi-round, multi-table scheduling. This can be built in Go test code (like `draft_schedule_test.go`'s `Test_getSlotsForCategory`), or by loading `testdata/tournament.json`, adding entries, running `GenerateRoundsForTournament`, then `scheduleMatches`.
- **How to verify setup worked:** `go test ./endpoint/schedule/...` passes (oracle baselines equal Go output); `vue-tsc --build --force` and the existing vitest suite stay green.

---

## Requirement 1: Leaf utilities — color generation + cell-address splitting

`web/src/features/schedule/excel/color.ts`: port of `utils/color/color.go`. Exports `generateColors(numColors: number, mode: ColorMode): string[]` returning `#RRGGBB` hex strings. **Deterministic** — unlike Go, the TS port drops the random seed and hue jitter; hues are evenly spaced (`hue = i * (360 / numColors)`), S/L fixed per mode (Light: S=0.75, L=0.8; Dark: S=0.75, L=0.35). This is a deliberate, documented behavior change — Go's randomness made byte-exact `.xlsx` comparison impossible.

`web/src/shared/excel/address.ts`: cell-name splitting (port of `excelize.SplitCellName` behavior — the function actually used by `getMatchFromCellAddr`). Exports `splitCellName(addr: string): { col: string; row: number }` — splits `"AC21"` into `{ col: "AC", row: 21 }`. Handles single and multi-letter columns. Throws on empty, invalid characters, letters-after-digits, or missing row/col.

### Acceptance criteria
- Given `numColors` and `mode`, when `generateColors` runs, then it returns exactly `numColors` strings, each matching `/^#[0-9A-F]{6}$/` (uppercase hex).
- Given the same `numColors` and `mode`, when `generateColors` runs twice, then both calls return identical arrays (deterministic — no randomness).
- Given specific HSL inputs, when `hslToHex(h, s, l)` runs, then the output matches the Go `hslToRGB` algorithm's `int(r*255)` truncation (not rounding) for the same inputs.
- Given a cell address `"AC21"`, when `splitCellName` runs, then it returns `{ col: "AC", row: 21 }`.
- Given single-letter `"A1"` and multi-letter `"ZZ99"`, when split, then col and row are correct.
- Given `""`, `""` , `"123"` (digits-first), `"A"` (no row), `"1A"` (invalid), when `splitCellName` runs, then it throws with a descriptive error.

### Integration tests
- `should produce valid #RRGGBB colors for Light and Dark modes` — given `generateColors(5, ColorMode.Light)` and `generateColors(5, ColorMode.Dark)`, then every entry matches `/^#[0-9A-F]{6}$/`.
- `should be deterministic across calls` — given two calls with the same args, then results are identical.
- `should match Go hslToRGB for known HSL values` — given `(h=0, s=1, l=0.5)` → pure red `"#FF0000"`; `(h=120, s=1, l=0.5)` → pure green `"#00FF00"`; `(h=240, s=1, l=0.5)` → pure blue `"#0000FF"`; `(s=0, l=0.5)` → mid-gray `"#808080"`.
- `should split single and multi-letter cell addresses` — given `"A1"`, `"Z26"`, `"AA1"`, `"AC21"`, then `{col, row}` are correct.
- `should reject invalid cell addresses` — given `""`, `"123"`, `"A"`, `"A1B"`, then it throws.

### Checkpoints: spec
### Review: inline

### Production-risk notes
- The Go `hslToRGB` uses `int(r*255)` (truncation toward zero, Go's default for positive floats→int). JavaScript `Math.floor` matches this for positive values. Verify with the `s=0, l=0.5` gray case: `int(0.5*255) = int(127.5) = 127` → `"#7F7F7F"`. If the TS port rounds instead, gray would be `"#808080"` — a divergence. The unit test pins this.
- Determinism is a deliberate deviation from Go. Document it at the function level (JSDoc) so a future maintainer doesn't re-introduce `Math.random()`.
- `splitCellName` mirrors `excelize.SplitCellName`'s contract (returns col string + row int), not the dead `excelhelper.SplitRowCol`. The import only uses the row from the split.

---

## Requirement 2: Draft schedule generation — `scheduleMatches`

`web/src/features/schedule/domain/scheduleMatches.ts`: port of `scheduleMatches` + `getSlotsForCategoryGroup` + `getSlotsForCategoryKnockout` + `getOrCreateSlot`/`getOrCreateNextSlot`. Produces a `Schedule` (array of `TimeSlot`s, each with a `Tables` array of `Match | null`).

### Acceptance criteria
- Given a tournament with `startTime`, `numTables`, and categories with populated `groups`/`knockoutRounds`, when `scheduleMatches` runs, then it produces a `Schedule` whose `TimeSlots` are ordered: all categories' group stages first (in category order), then all categories' knockout stages (in category order), advancing `nextStartTime` per category by `durationMinutes` after the last slot's start time.
- Given `startTime` as `"2025-03-22T09:00"` (no timezone), when parsed, then the scheduler treats it as **UTC** (matching Go's `time.Parse("2006-01-02T15:04", …)` → UTC). Time arithmetic (`startTime + durationMinutes * slotIdx`) operates in UTC.
- Given a category with multiple groups and matches, when `getSlotsForCategoryGroup` runs, then each match is placed on the table assigned by the `grpMatchTable` round-robin assignment, in the first available slot for that table.
- Given a category with knockout rounds, when `getSlotsForCategoryKnockout` runs, then matches are placed sequentially on tables (round-robin across `numTables`), creating new slots when the current one is full.
- Given a category with no groups (empty), when `scheduleMatches` runs, then zero group slots are generated for it and it is skipped (logged, not fatal — matches Go's `slog.Info` skip).
- Given a category with no knockout rounds, when the knockout stage runs, then it is skipped.
- Given the Go oracle's test tournament, when `scheduleMatches` runs in TS, then the resulting `Schedule` (serialized as JSON: time-slot count, tables per slot, match assignments including datetime/category/table/groupIdx/roundIdx/round/matchIdx/entry indices) deep-equals the committed `schedule.golden.json`.

### Integration tests
- `should match the Go golden schedule output` — given the same tournament construction as the Go oracle (loaded from `testdata/schedule-test-tournament.json` or constructed in code, with rounds generated via `generateRoundsForTournament`), when `scheduleMatches` runs, then the serialized schedule `toEqual`s the committed `schedule.golden.json` (captured from Go with `-update`).
- `should advance nextStartTime per category by durationMinutes` — given two categories with durations 30 and 45 minutes, when the schedule is generated, then the second category's first slot starts after the first category's last slot + 30 minutes.
- `should skip categories with no group matches` — given a category with empty groups, then no group slots are generated for it and the schedule is not corrupted.
- `should schedule group matches using the round-robin table assignment` — given a category with 3 groups of 4 players (2 matches per round), when `getSlotsForCategoryGroup` runs with 8 tables, then group 0 matches land on tables 0–1, group 1 on tables 2–3, group 2 on tables 4–5 (round-robin counter resets at `numTables`).

### Checkpoints: spec
### Review: inline

### Production-risk notes
- **UTC parsing is the critical parity trap.** Go's `time.Parse("2006-01-02T15:04", "2025-03-22T09:00")` returns UTC. JS `new Date("2025-03-22T09:00")` returns local time. If the TS port uses local time, every datetime in the schedule will be off by the timezone offset, and the golden comparison fails. The port must parse as UTC: `new Date(startTime + 'Z')` or equivalent. Document this prominently.
- The `grpMatchTable` table-assignment algorithm is deterministic but intricate — it pre-computes table indices for each `(group, matchInRound0)` pair, then all rounds reuse the same table for the same match slot within a group. The golden test exercises this.
- The `getOrCreateSlot` vs `getOrCreateNextSlot` distinction: group scheduler searches all existing slots for the first free table; knockout scheduler only checks the last slot. Port both exactly.
- The Go oracle captures the golden in UTC. The TS test must normalize its datetimes to the same format (ISO string with `Z` suffix or equivalent) before comparison.

---

## Requirement 3: Draft `.xlsx` export — `draftScheduleWorkbook`

`web/src/features/schedule/excel/draftScheduleWorkbook.ts`: port of `CreateDraftSchedule` and all `populate*` functions from `draft_schedule.go`. Builds an ExcelJS `Workbook` with sheets: `schedule` (time-slot × table grid, color-coded match cells, internal hyperlinks to `matches`), `matches` (one row per match: SN, Category, Round, Group, KO Round, Match, Date/Time, Table, EntryID1, EntryID2 — **sheet-protected** with password `"12345654321"`), `Tournament Info`, and one `entries_<shortName>` sheet per category. Includes header/match/datetime styles, column widths, and the `Match.Name()` display text.

### Acceptance criteria
- Given a `Schedule` and a `Tournament`, when `createDraftScheduleWorkbook` builds the workbook, then it creates sheets named `schedule`, `matches`, `Tournament Info`, and `entries_<shortName>` per category, and removes the default `Sheet1`.
- Given the schedule grid, when the `schedule` sheet is populated, then row 1 is the header (`Date/Time`, `T1`, `T2`, …, `Tn` where n = `schedule.maxTableCount`), each subsequent row starts with the time-slot's datetime, and each match cell contains the `Match.Name()` display text with an internal hyperlink to `matches!A{sn}`.
- Given a match cell, when styled, then it has a solid fill with the category's color (from `generateCategoryGroupColorMap`) and thin black borders on all sides.
- Given the matches sheet, when populated, then each match row has SN (sequential), Category, Round/Group (group stage) or KO Round/Match (knockout), Date/Time, Table, and EntryID1/EntryID2 (when both ≥ 0). The matches sheet is protected with password `"12345654321"`.
- Given the `Tournament Info` sheet, when populated, then it has tournament name, numTables, startTime, and a category details table with all category fields.
- Given a category entries sheet, when populated, then it has one row per player with Entry ID, Team Name (blank for Singles/Doubles), Seeding, Club, Player SN, Name, DOB, Gender.
- Given the Go oracle's test tournament, when the TS workbook is generated and read back with ExcelJS, then its **structure** (sheet names, cell values, column widths, non-color styles, sheet protection state) matches the Go-generated `.xlsx` read with ExcelJS — compared structurally, **excluding cell fill colors** (which are non-deterministic in Go and deterministic in TS — format validity only).

### Integration tests
- `should produce the correct sheet structure` — given a small tournament + schedule, when the workbook is generated, then `workbook.worksheets` has sheets `schedule`, `matches`, `Tournament Info`, `entries_MS` (no `Sheet1`).
- `should write schedule grid with correct values and hyperlinks` — given a 2-slot, 2-table schedule, when the schedule sheet is read back, then header row is `["Date/Time", "T1", "T2"]`, and each match cell has a hyperlink whose target matches `matches!A{sn}`.
- `should color-code match cells with category colors` — given match cells, when read back, then each has a solid-pattern fill whose color matches `/^#[0-9A-F]{6}$/` and corresponds to the match's category.
- `should protect the matches sheet with the hardcoded password` — given the matches sheet, when checked, then `sheet.protect` is set (protection active).
- `should write tournament info and category entries correctly` — given a tournament with 2 categories, when the info and entry sheets are read back, then all cell values match the expected tournament/category/entry data.
- `should match the Go-generated workbook structurally (excluding colors)` — given the Go oracle tournament, when TS and Go both generate the draft `.xlsx`, then reading both with ExcelJS and comparing all cell values, sheet names, column widths, and non-color styles yields equality (colors checked for `#RRGGBB` format only).

### Checkpoints: full
### Review: parallel

### Production-risk notes
- **Internal hyperlinks** (schedule cell → matches sheet) are the highest ExcelJS fidelity risk. ExcelJS represents internal location hyperlinks as `cell.value = { hyperlink: 'matches!A2', text: 'MS Grp1' }` or via `worksheet.getCell(addr).value = { hyperlink, text }`. Verify that ExcelJS writes these as `<definedName>` or `<hyperlink>` location links (not external URLs). The round-trip test in R4 validates the link is readable.
- **Sheet protection** in ExcelJS: `worksheet.protect('12345654321', { selectLockedCells: true, selectUnlockedCells: true })`. Verify the options map to Go's `ProtectSheet` options.
- **Datetime cells**: ExcelJS writes dates when `cell.value = new Date(...)` or a serial number. The Go code uses `SetCellValue(sheet, addr, time.Time)` which writes a serial with `NumFmt: 22`. The TS port must apply `cell.numFmt = 22` (or equivalent `m/d/yyyy h:mm`) for datetime-styled cells. **ExcelJS stores dates as JS `Date` objects internally; when writing, it converts to Excel serials.** Verify the written serial round-trips correctly (read back as the same Date or serial).
- **Active sheet**: Go sets the active sheet to 1 (schedule). ExcelJS: `workbook.views[0].activeTab = scheduleSheetIndex`.
- The `sn` / `matchLink` counter logic must be ported exactly (see Key parity facts). The link target must match the row where the match data was written.
- **Structural comparison excludes colors** because Go's colors are random. The comparison covers: sheet names/order, all cell text/number values, column widths, border styles, font (bold), number formats, merged cells, hyperlinks (target addresses), and protection state. Fill colors are validated only as `#RRGGBB` format.

---

## Requirement 4: Final `.xlsx` import/merge — `importFinalSchedule`

`web/src/features/schedule/domain/importFinalSchedule.ts`: port of `ImportFinalSchedule` + `getMatchFromCellAddr` + `formCategoriesGroupsMap` + `formCategoriesKnockoutRoundsMap`. Reads the user-edited `.xlsx` (via ExcelJS, working with the workbook object directly to access hyperlinks), reconstructs `Record<string, Group[]>` and `Record<string, KnockoutRound[]>`, which the existing `calculator/schedule.ts` `importFinalSchedule()` merges into the tournament.

### Acceptance criteria
- Given an edited `.xlsx` with a `schedule` sheet, when `importFinalSchedule` reads it, then it builds a header map (column index → table name) from row 1, and for each data row with a parseable datetime in column A, scans cells for hyperlinks pointing to the `matches` sheet.
- Given a schedule cell with a hyperlink to `matches!A{row}`, when `getMatchFromCellAddr` runs, then it reads the match metadata from the `matches` sheet at that row: EntryID1 (col I), EntryID2 (col J), Category (col B), Round (col C), Group (col D), KO Round (col E), KO Match (col F) — converting to 0-indexed model values (`entryIdx-1`, `roundIdx-1`, `groupIdx-1`).
- Given all extracted matches, when assembled, then group matches (`groupIdx >= 0`) are formed into `Record<categoryShortName, Group[]>` (grouped by category → groupIdx → roundIdx, with `entriesIdx` collected from match entry indices), and knockout matches (`groupIdx == -1`) are formed into `Record<categoryShortName, KnockoutRound[]>` (grouped by category → round, sorted by round descending, matches sorted by matchIdx).
- Given a match row with empty EntryID cells (bye match), when read, then `getCellIntValue` returns 0, and `entry1Idx = 0 - 1 = -1` (= `EntryEmptyIdx`).
- Given the Go oracle's draft `.xlsx` (generated by Go), when imported by the TS port, then the resulting groups/knockout maps deep-equal the Go import's output on the same file.
- Given the TS-generated draft `.xlsx`, when imported by Go, then the resulting groups/knockout maps deep-equal the TS import's output on the same file (round-trip cross-validation).

### Integration tests
- `should extract matches from schedule hyperlinks` — given a small draft `.xlsx` (generated by the TS R3 port or Go oracle), when imported, then each match's datetime, table, category, entry indices, round, and group are correctly extracted.
- `should assemble group matches into per-category groups` — given group-stage matches, when assembled, then `formCategoriesGroupsMap` produces the correct `Group[]` per category with rounds and entriesIdx.
- `should assemble knockout matches into per-category rounds (descending)` — given knockout matches across rounds 2, 4, 8, when assembled, then rounds are ordered 8, 4, 2 (biggest first) with matches sorted by matchIdx.
- `should handle bye matches (empty entry cells)` — given a match row with no EntryID values, when imported, then entry indices are −1 (not 0).
- `should skip rows without a parseable datetime` — given a schedule row with text in column A (not a number), then it is skipped.
- `should match Go import output on the same draft .xlsx (round-trip)` — given the Go-generated draft `.xlsx`, when imported by both Go and TS, then the groups/knockout maps deep-equal.

### Checkpoints: spec
### Review: inline

### Production-risk notes
- **Hyperlink detection via ExcelJS** is the critical read-path risk. When the draft writer (R3) sets `cell.value = { hyperlink: 'matches!A2', text: 'MS Grp1' }`, ExcelJS may store this differently from a native Excel internal link. The import must detect these links reliably. If ExcelJS does not expose hyperlinks on re-read (a known limitation for some hyperlink types), the port may need to read the `matches` sheet directly and correlate by position. The round-trip test is the safety net.
- **Datetime serial → JS Date**: Go uses `excelize.ExcelDateToTime(serial, false)` (1900 system). ExcelJS auto-converts date-formatted cells to JS `Date` objects on read, but cells read via `worksheet.getCell(addr)` may expose the value differently depending on cell type. The port must handle both serial-number strings (from raw reads) and Date objects (from typed reads), converting to a consistent ISO string for the `Match.datetime` field.
- The import must work with the **ExcelJS workbook object directly** (`await workbook.xlsx.load(buffer)`), not through Slice 2's `readWorkbook` (which returns `string[][]` and loses hyperlink metadata). The import function is `async` (ExcelJS load is Promise-based).
- The existing `calculator/schedule.ts` `importFinalSchedule(groupsMap, knockoutMap, tournament)` merge logic is **reused unchanged** — the TS port only produces the same maps the server used to return.

---

## Requirement 5: TournamentView wiring + structural cleanup

Replace `apiExportDraftSchedule` and `apiImportFinalSchedule` in `web/src/views/TournamentView.vue` with the local pipeline. The export path becomes: `generateRoundsForTournament` → `scheduleMatches` → `createDraftScheduleWorkbook` → ExcelJS `writeBuffer` → blob download (via the slice-0 fallback download path). The import path becomes: file → `importFinalSchedule` (ExcelJS parse + match extraction) → existing `calculator/schedule.ts` merge. Drop the two dead client functions from `client.ts`.

### Acceptance criteria
- Given the user clicks "Export Draft Schedule", when the handler runs, then it calls `generateRoundsForTournament`, then `scheduleMatches`, then `createDraftScheduleWorkbook`, produces an `.xlsx` blob, and triggers a download — with **no `fetch`** call to the server.
- Given the user selects a final schedule `.xlsx`, when the handler runs, then it reads the file with ExcelJS, runs `importFinalSchedule` to extract groups/knockout maps, and merges them into the tournament via the existing `calculator/schedule.ts` `importFinalSchedule()` — with **no `fetch`** call.
- Given an import error (corrupt file, missing sheets, broken hyperlinks), when the handler runs, then the error's message is surfaced via `alert` and the tournament is **not** modified.
- `TournamentView` no longer imports `apiExportDraftSchedule` or `apiImportFinalSchedule` from `@/client/client`.
- `apiExportDraftSchedule` and `apiImportFinalSchedule` are deleted from `client.ts`; `apiExportScoresheetWithTemplate` remains (slice 4).
- No source under `web/src` imports the deleted symbols: grep returns zero matches.

### Integration tests
- `should generate and download a draft schedule with no server` — given a tournament with populated groups, when the export handler runs (with `generateRoundsForTournament` having populated groups), then a blob is created and downloaded, and `fetch` was never called.
- `should import a final schedule and merge into tournament with no server` — given a draft `.xlsx` file (from the TS export or Go oracle), when the import handler runs, then the tournament's group matches have datetimes/tables set, and `fetch` was never called.
- `should surface import errors via alert` — given a corrupt or missing-sheet `.xlsx`, when imported, then `alert` is called and the tournament is unchanged.
- `should have no remaining references to the removed schedule endpoints` — given the tree after cleanup, when grepping `web/src` for the two symbol names, then zero matches are found and `vue-tsc --build --force` succeeds.

### Checkpoints: full
### Review: parallel

### Production-risk notes
- The export path already calls `generateRoundsForTournament` before the API call (see current `exportDraftSchedule` in TournamentView). The port preserves this: generate rounds → schedule → export. If `generateRoundsForTournament` throws (e.g., not enough players), the error is caught and alerted, same as today.
- The import handler is `async` (ExcelJS load is Promise-based). Unlike Slice 2's importers (which are sync throwers), the schedule import is inherently async (it must `await workbook.xlsx.load(buffer)`). The `try/catch` wraps the async chain; errors surface via `alert`.
- The blob download reuses the existing `createObjectURL` + `a.download` pattern already in TournamentView (for `exportRoundRobin` and `exportScoresheet`). No new download abstraction needed.
- The `apiExportScoresheetWithTemplate` function stays in `client.ts` — it's out of scope (slice 4).

---

## Feature acceptance

- **Given** `testdata/tournament.json` (enriched with enough entries to exercise multi-group scheduling), **when** the user generates a draft schedule in-browser (`generateRoundsForTournament` → `scheduleMatches` → `createDraftScheduleWorkbook`), exports it as `.xlsx`, and re-imports it (`importFinalSchedule` → merge), **then** the merged tournament's match datetimes and tables agree structurally with the current Go round-trip — with no HTTP request made (fetch mocked and asserted unused).

## Notes on test philosophy (from `docs/lessons.md`)
- **Schedule golden captured from Go** (the oracle): `schedule_oracle_test.go` runs `scheduleMatches` on a representative tournament and commits the JSON output. The TS test asserts against it — never a self round-trip of the TS scheduler.
- **Workbook structural comparison, not byte comparison**: colors are non-deterministic in Go (random seed + jitter), so byte-exact `.xlsx` diff is impossible and would produce false failures. Comparison is structural: cell values, sheet names, column widths, non-color styles, hyperlinks, protection state. Colors validated for `#RRGGBB` format only.
- **Round-trip cross-validation is the safety net**: Go-exported draft → TS-import, and TS-exported draft → Go-import; both must agree. This proves the TS write and read are individually correct against the Go oracle, even if structural comparison can't verify every byte.
- **UTC datetime parsing** is the single most subtle parity trap. Go's `time.Parse` without timezone → UTC; JS `new Date` without `Z` → local. The port must normalize to UTC explicitly. Documented at the function level and pinned by the golden test.
- **Deterministic colors are a deliberate behavior change** from Go — documented, approved by the design. The Go oracle's colors are random; the TS port's are not. This makes TS↔TS runs reproducible without affecting any functional behavior.