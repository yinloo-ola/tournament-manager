# Pure-Frontend Rewrite — Slice 2: Entry Import (Singles / Doubles / Team) via ExcelJS

**Status:** Brainstorm → pending plan
**Date:** 2026-08-01
**Depends on:** Slice 0 (foundation). Benefits from Slice 1 (category config exists) but can proceed in parallel.
**Scope:** One PR. Imports entries from `.xlsx` entirely in-browser, replacing the three `apiImport*Entry` endpoints.

---

## Requirements

1. **Singles import.** Read sheet `entries` (header `SN, Name, Club, Seeding, Date Of Birth, Gender`), skip the header row, produce `Entry[]` (entryType `Singles`), client-side.
2. **Doubles import.** Read sheets `players` (`SN, Name, Date Of Birth, Gender`) and `entries` (`SN, Player1, Player2, Club, Seeding`); join players to entries **by name**; produce `Entry[]` (entryType `Doubles` with a 2-player array).
3. **Team import.** Read sheets `players` (`SN, Name, Date Of Birth, Gender, Team`) grouped by team, and `entries` (`SN, <team>, Club, Seeding`); validate each team's player count is within `[minPlayers, maxPlayers]`; produce `Entry[]` (entryType `Team`).
4. All three use **raw cell values** (no formatted-value coercion), trim whitespace, treat `Club`/`Seeding` as optional, and parse `Seeding` as an integer when non-empty.
5. Replaces `apiImportSinglesEntry` / `apiImportDoublesEntry` / `apiImportTeamEntry`; the file is read in-browser via ExcelJS. Code lives in `features/entry/`.

---

## Problem

Entry import is the user's way to get real player lists into a tournament. Today it round-trips through the server (upload `.xlsx` → Go parses with `excelize` → JSON back). The parsing is pure tabular logic with no reason to leave the browser.

---

## Approaches considered

- **ExcelJS (chosen).** Reads `.xlsx` with full access to raw cell values; consistent with the ExcelJS choice already made for the write-heavy slices (3, 4). One Excel dependency across the whole rewrite.
- **SheetJS (xlsx).** Also reads `.xlsx`; widely used. Rejected for consistency — standardizing on ExcelJS for both read and write keeps one library and one mental model across the rewrite.

---

## Architecture

```
features/entry/
  domain/
    importSingles.ts     — port of entry/internal/singles.go
    importDoubles.ts     — port of entry/internal/doubles.go
    importTeam.ts        — port of entry/internal/team.go
  ui/                    — the import affordances currently in CategoryCard.vue
shared/excel/
  readWorkbook.ts        — thin ExcelJS wrapper (open ArrayBuffer → workbook → sheet rows, raw values)
```

---

## Components

- **`readWorkbook.ts`** — opens an uploaded `File`/`ArrayBuffer` with ExcelJS and yields rows as arrays of raw cell values (strings/numbers as stored), mirroring Go's `GetRows(..., RawCellValue: true)`.
- **`importSingles.ts`** — single-sheet parse; optional `Club`/`Seeding`.
- **`importDoubles.ts`** — builds a `Map<name, Player>` from the `players` sheet, then resolves each entry's two players by name (error if a named player is missing — matching Go's `"player ... not found in players sheet"`).
- **`importTeam.ts`** — builds a `Map<team, Player[]>` from the `players` sheet; resolves teams; enforces the `[minPlayers, maxPlayers]` count with the same error message as Go.

---

## Data flow

User picks a `.xlsx` file → `readWorkbook` → importer for the category's entry type → `Entry[]` → merged into the active tournament's category entries via the document store (persisted/autosaved by slice 0). No server.

---

## Error handling

- Missing required sheet / missing required player or team → typed error with the same message Go produces, surfaced in the UI; current document is not modified.
- Non-integer `Seeding` → error (matches Go's `"failed to parse seeding"`).
- Short rows (fewer columns than header) → skipped (matches Go's `len(row) < len(header)` / `len(row) < 3` guards).

---

## Testing

- **Golden import tests (primary):** feed the existing fixtures `testdata/Men Singles.xlsx`, `testdata/Mens Doubles.xlsx`, `testdata/Mens Team.xlsx` through both the Go importers and the TS importers; assert the resulting `Entry[]` JSON is **identical**. These fixtures are the oracle; capture Go's JSON output once as the regression baseline.
- Unit tests for optional-column handling and the name/team join edge cases (duplicate names, missing team).

---

## Production-risk areas

- **Medium — Excel read fidelity.** Risks: cell-value typing (ExcelJS may return a `number` where Go read a string via `RawCellValue`; coerce consistently), whitespace/trimming, and the two-sheet join keys (doubles joins **by name**, not SN — a detail easy to get wrong). All mitigated by the fixture-based golden tests, which compare full JSON equality.

---

## Feature acceptance

- **Given** `Men Singles.xlsx` (and likewise Doubles/Team), **when** the user imports it in-browser into a category, **then** the resulting entries are byte-for-byte identical (JSON equality) to today's Go import — with no server involved.

---

## Out of scope

- Schedule Excel (slice 3), chart/scoresheet Excel (slice 4), Go removal (slice 5).
