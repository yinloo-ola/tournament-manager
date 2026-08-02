# Implementation Plan: Pure-Frontend Slice 4 — Round-Robin Chart & Scoresheet Exports via ExcelJS

## Overview
Design: `docs/plans/2026-08-01-pure-frontend-slice4-chart-scoresheet-design.md`

Port the two remaining Excel *exports* to run entirely in-browser: the round-robin result chart (one styled sheet per category, fully generated) and the per-match scoresheets (clone a user-supplied template sheet per match, substitute placeholders). Both produce styled `.xlsx` blobs for download — no server round-trip. Replaces `apiExportRoundRobinExcel` and `apiExportScoresheetWithTemplate`.

**Intended branch** (created during `pwk-executing-tasks`, not here — this phase is read-only): `feature/pure-frontend-slice4-chart-scoresheet`.

**New file layout** (executor chooses exact structure; this is the design's guidance):
- `web/src/features/roundrobin/excel/roundrobinChartWorkbook.ts` — port of `chart.go` (`tealeg/xlsx` → ExcelJS)
- `web/src/features/scoresheet/excel/scoresheetWorkbook.ts` — port of `export_scoresheet.go` (`excelize` → ExcelJS)
- `web/src/shared/excel/cloneSheet.ts` — **NEW** — deep-copy a worksheet (values + styles + merges + dims); ExcelJS has no `copySheet`
- `web/src/shared/excel/styles.ts` — shared style builders (may end up thin — chart styles are self-contained, scoresheet preserves template styles; executor decides whether it's warranted)
- `web/src/{features,shared}/.../__tests__/` — unit + golden tests next to each module
- `endpoint/roundrobin/internal/chart_oracle_test.go` — Go-side oracle guard + baseline generator (`-update`)

**Ordering rationale.** Requirements run in dependency order, each landing green on its own:
- **R1** ports the `cloneSheet` deep-copy helper — no dependencies on other new code; the single most intricate port item (HIGH risk); proven independently by its own unit test before anything consumes it.
- **R2** ports `CreateRobinCharts` (the chart workbook generator) — no dependency on `cloneSheet`; fixed colors admit near-exact Go-vs-TS comparison; gated by a structural oracle.
- **R3** ports `ExportScoresheet` (the template-cloning scoresheet generator) — depends on R1 (`cloneSheet`); gated by sheet-name + placeholder-substitution + template-fidelity assertions.
- **R4** rewires `TournamentView` to the local pipeline (chart: build → blob download; scoresheet: load template → clone+substitute → blob download), dropping the two `fetch` calls; grep-gated cleanup of dead client functions.

**Key parity facts (verified against Go source):**

- **`tealeg/xlsx` `Merge(hcells, vcells)` semantics.** `HMerge = hcells` means *additional* cells to the right (not total span). A cell at A1 with `Merge(3, 0)` spans A1:D1 — 4 columns total. The chart header uses `Merge(maxPlayer+3, 0)` → spans `maxPlayer+4` columns. The "Group N" label uses `Merge(1, 0)` → spans 2 columns. ExcelJS `mergeCells("A1:D1")` takes an explicit range — compute the end column from the merge count.
- **`SetColAutoWidth(2, fn)` is a Go-only concept.** Column 2 (player-name column) width = `max(runeCount(cellValue) + 1)` over all cells in column 2. The callback is `strings.Count(s, "")` which returns `len([]rune(s)) + 1`. Merged-cell overflow cells are empty (only the top-left cell of a merge holds a value) and contribute nothing. In practice: width = `max(runeCount("Player") + 1, longest player-name-including-club-suffix runeCount + 1)`. ExcelJS has no auto-width; the port must compute this manually.
- **ARGB color constants are fixed.** Grey header fill = `FFA0A0A0`, black diagonal = `FF000000`. Both use `ApplyFill = true` + `PatternType = "solid"`. In ExcelJS: `{ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA0A0A0' } }`. Unlike the schedule (random colors), these are deterministic → near-exact comparison is valid.
- **Alignment terminology: tealeg `"center"` ↔ ExcelJS `"middle"`.** `tealeg/xlsx` uses `Vertical = "center"`; ExcelJS uses `vertical: 'middle'` for the same OOXML `<verticalAlignment center>`. When both files are read back by ExcelJS, both normalize to `"middle"`. The port writes `vertical: 'middle'`.
- **`excelize.CopySheet(from, to)` does a deep XML copy** (`deepcopy.Copy(worksheet)`) of the entire worksheet structure — all cell values, style references, merged ranges, column widths, row heights, and sheet-level properties. It does **not** copy drawings, table parts, or page setup. The TS `cloneSheet` must replicate cell values + full style objects + merges + column/row dimensions.
- **Scoresheet substitution reads from the *template*, writes to the *new sheet*.** Go's `AddMatchScoresheet` calls `CopySheet` first (new sheet gets all template content), then iterates template cells via `GetRows(templateName)`, substitutes placeholders, and writes only modified cells to the new sheet. The TS port can equivalently clone-then-walk-the-clone in-place — the observable result is the same: new sheet has all template content with placeholders replaced.
- **Placeholder date/time formatting.** Go uses `match.DateTime.Format("2006-01-02")` → `"2025-03-22"` and `Format("15:04")` → `"09:00"`. The TS `Match.datetime` is a string like `"2025-03-22T09:00"` — `substring(0, 10)` and `substring(11, 16)` produce the same output. For a zero/empty datetime, Go produces `"0001-01-01"` / `"00:00"`; the TS port must handle gracefully (the template cell will still be substituted, just with potentially odd values).
- **`{{player1}}` / `{{player2}}` resolution.** Empty string if `entryIdx < 0` (`EntryEmptyIdx = -1`). Otherwise `entries[entryIdx].name`. Note: the TS `Entry.name` getter for Doubles returns `""` only if *both* player names are empty (`&&`), while Go's `Entry.Name()` returns `""` if *either* is empty (`||`). This is a pre-existing model divergence — not introduced by this slice. It does not affect test data with complete entries.
- **`tealeg/xlsx` `SetColWidth` signature:** `SetColWidth(minCol, maxCol, width)`. The chart sets: col 1 = 4.0 (`SetColWidth(1, 1, 4.0)`), col 2 = auto, cols 3 through `3+maxPlayer` = 12.0 each (`SetColWidth(3, 3+maxPlayer, 12.0)`), last two cols (`3+maxPlayer+1` through `3+maxPlayer+2`) = 10.0.

**Production-risk areas** (from the design): **HIGH — the `cloneSheet` deep-copy is the single most intricate port item in the entire rewrite.** ExcelJS exposes no sheet copy; a hand-rolled deep copy must faithfully reproduce styles, merges, and dimensions or the printed scoresheets will look wrong. The chart is lower risk (fixed colors, well-defined layout, near-exact comparison). Both are pure outputs (no import), so validation is generate-and-compare only — no round-trip safety net.

---

## Setup

- **ExcelJS already installed** (Slice 2 dependency). Verify: `npx vitest run` passes with existing suite.
- **Go oracle harness for the chart** (part of R2): `endpoint/roundrobin/internal/chart_oracle_test.go` constructs a representative tournament (categories with populated groups and entries — mirroring the schedule oracle's `buildOracleTournament` pattern), runs `CreateRobinCharts`, writes the `.xlsx` to a `bytes.Buffer`, and commits it as `web/src/features/roundrobin/excel/__tests__/golden/chart.golden.xlsx` with a `-update` flag. The TS test reads this golden `.xlsx` with ExcelJS and compares against the TS-generated workbook cell-by-cell.
- **Test fixture enrichment.** The existing `testdata/tournament.json` has 1 entry per category with empty groups — insufficient for the chart (needs groups with `entriesIdx`) and scoresheet (needs groups with rounds and knockout rounds). The Go oracle constructs its own representative tournament in test code (like the schedule oracle's `buildOracleTournament`). For the TS unit tests, either construct the tournament in code or load and enrich `testdata/tournament.json` via `generateRoundsForTournament`.
- **Scoresheet test fixture.** `testdata/scoresheet template.xlsx` already exists (sheets: `MT`, `MS`, `MD` — named by category short name). The TS scoresheet test loads it and feeds a tournament with matches for those categories.
- **How to verify setup worked:** `go test ./endpoint/roundrobin/...` passes (oracle baseline equals Go output); `vue-tsc --build --force` and the existing vitest suite stay green.

---

## Requirement 1: `cloneSheet` — deep-copy a worksheet (the crux)

`web/src/shared/excel/cloneSheet.ts`: a **NEW** helper that deep-copies a source ExcelJS `Worksheet` into a new worksheet within the same (or a target) `Workbook`. ExcelJS has **no** `copySheet`/`CopySheet` — this helper fills that gap and becomes a shared asset for any future template work.

It must faithfully reproduce: every cell's value **and** full style object (font, fill, border, alignment, number format, protection), all merged-cell ranges, column widths/properties, and row heights/properties. This mirrors Go's `excelize.CopySheet` (a `deepcopy.Copy` of the entire worksheet XML).

### Acceptance criteria
- Given a source worksheet with cells containing strings, numbers, and dates, when `cloneSheet` runs, then every cell in the clone has the same value (same type) as the corresponding source cell.
- Given a source worksheet with styled cells (font: bold/size/color, fill: solid pattern with fgColor, border: thin all sides, alignment: horizontal/vertical/wrap, number format), when cloned, then every styled cell in the clone has a style object deep-equal to the source (same font, fill, border, alignment, number format).
- Given a source worksheet with merged-cell ranges (e.g., `B1:X1`, `B5:I6`), when cloned, then the clone has the same set of merged ranges.
- Given a source worksheet with non-default column widths (e.g., col B = 15.5, col D = 8.0), when cloned, then the clone's columns have the same widths.
- Given a source worksheet with non-default row heights (e.g., row 1 = 30, row 5 = 25), when cloned, then the clone's rows have the same heights.
- Given a source worksheet that is completely empty (no cells, no styles, no merges), when cloned, then the clone is also empty (no error).
- Given a source worksheet with cells containing rich text (`{ richText: [...] }`), when cloned, then the clone preserves the rich text content and its styling.
- Given a clone produced by `cloneSheet`, when the clone is serialized to `.xlsx` buffer and re-read by ExcelJS, then all values, styles, merges, widths, and heights survive the round-trip.

### Integration tests
- `should clone all cell values with correct types` — given a worksheet with string, number, Date, and formula cells, when cloned, then each clone cell's value deep-equals the source (type included).
- `should clone all cell styles (font, fill, border, alignment, numFmt)` — given a worksheet with varied cell styles, when cloned, then each clone cell's `style` object deep-equals the source cell's style.
- `should clone merged-cell ranges` — given a worksheet with 3 merge ranges (`B1:X1`, `B5:I6`, `S8:S9`), when cloned, then the clone's `_merges` (or equivalent) contains the same ranges.
- `should clone column widths and row heights` — given a worksheet with custom column widths and row heights, when cloned, then the clone's columns and rows match.
- `should clone an empty worksheet without error` — given a worksheet with no cells, when cloned, then no error is thrown and the clone is empty.
- `should preserve styles through .xlsx round-trip` — given a styled source worksheet, when cloned → serialized → re-read, then the re-read clone matches the source on values + styles + merges + widths + heights.
- `should clone a real template sheet (scoresheet template)` — given the `testdata/scoresheet template.xlsx` `MS` sheet loaded by ExcelJS, when cloned, then the clone has the same merged ranges (29 ranges), cell values, and cell styles as the source.

### Checkpoints: full
### Review: parallel

### Production-risk notes
- **This is the single most intricate port item in the entire rewrite.** ExcelJS exposes no sheet copy. The deep copy must reproduce: cell values (all types), full style objects (font/fill/border/alignment/numberFormat/protection), merged-cell ranges, column widths/properties, row heights/properties. Missing any of these corrupts the printed scoresheets.
- **ExcelJS style object is mutable and shared by reference.** When copying styles cell-by-cell, avoid aliasing the source cell's style object (a mutation on the clone would bleed back to the source). Deep-copy the style or construct a fresh style object from the source's properties.
- **ExcelJS `worksheet.getCell(row, col)` vs `worksheet.getRow(row).getCell(col)`.** Both work but have different performance characteristics for iteration. The port must iterate efficiently over the source's actual cell range (use `worksheet.actualColumnCount` / `worksheet.actualRowCount` or `eachRow`/`eachCell`).
- **Merged cells in ExcelJS.** Merged ranges are stored in `worksheet._merges` (internal) or accessible via the model. When reading merged ranges from a source, use the worksheet's merge model, not cell-level inspection. When writing merges to the clone, use `worksheet.mergeCells(range)`.
- **Mitigation:** the dedicated unit test against the real `scoresheet template.xlsx` (29 merge ranges, varied styles) is the primary safety net. The R3 template-fidelity assertion (non-placeholder cells survive unchanged) is the secondary net.

---

## Requirement 2: Round-robin chart export — `roundrobinChartWorkbook`

`web/src/features/roundrobin/excel/roundrobinChartWorkbook.ts`: port of `CreateRobinCharts` + `createCategorySheet` + `createCategoryHeader` + `createTableForGroup` from `endpoint/roundrobin/internal/chart.go` (`tealeg/xlsx` → ExcelJS). Builds an ExcelJS `Workbook` with one sheet per category (named by `category.shortName`), each containing a styled header and round-robin matrices for every group.

### Acceptance criteria
- Given a tournament with categories, when `createRobinCharts` builds the workbook, then it creates one worksheet per category, named by `category.shortName`, and the default `Sheet1` is absent.
- Given a category sheet, when the header is built, then row 1 contains the tournament name (merged across `maxPlayer+4` columns, font bold size 20, horizontal center, row height 30); row 2 contains the category name (merged across `maxPlayer+4` columns, font bold size 12, horizontal center, row height 20); row 3 is a blank spacer row (height 20). `maxPlayer` = max `entriesIdx.length` across the category's groups.
- Given a group within a category, when its table is built, then a "Group N" row appears (label `"Group {g+1}"`, merged across 2 columns), followed by a header row (empty bordered cell, `"Player"`, player numbers `1..N`, `"Points"`, `"Position"` — all with grey fill `#A0A0A0`, bold, thin borders), followed by one player row per entry, followed by a blank row.
- Given a player row in the matrix, when built, then it contains: the 1-based player index, the player name with optional `(club)` suffix, N matrix cells (each with thin borders; the diagonal cell `p2 == p` has a solid black fill `#000000`), and 2 empty bordered cells (Points, Position). The row height is 25.
- Given the matrix cells for player `p`, when the diagonal cell `p2 == p` is rendered, then it has a solid fill with fgColor `FF000000` (black) and thin borders on all sides. Non-diagonal cells have thin borders only (no fill).
- Given all groups in the category, when column widths are set, then column 1 = 4.0, column 2 = auto-computed width (max rune count + 1 over all column-2 cell values), columns 3 through `maxPlayer+2` = 12.0 each, and the last two columns = 10.0 each.
- Given a player entry with a non-nil/non-empty `club`, when the player name cell is built, then the cell value is `"playerName (club)"`. Given a player with no club, then the cell value is just the player name.
- Given a group with `entriesIdx` containing a negative index (`EntryEmptyIdx = -1`), when the table is built, then that entry resolves to an empty/zero `Entry` (name returns `""`), and the matrix row is still rendered with the correct structure (matching Go's behavior of leaving the entry zero-valued).
- Given the Go oracle's test tournament, when the TS chart workbook is generated and both Go and TS `.xlsx` outputs are read back by ExcelJS, then they match on: sheet names, all cell values, merged ranges, fill colors (exact ARGB), border styles, font properties (bold, size), alignment, column widths, and row heights — effectively near-exact.

### Integration tests
- `should create one sheet per category named by shortName` — given a tournament with categories `MS` and `MD`, when the workbook is generated, then `workbook.worksheets` has sheets named `MS` and `MD` (no `Sheet1`).
- `should build the styled category header` — given a category with maxPlayer=4, when the sheet is read back, then row 1 = tournament name (merged A1:E1, bold size 20, center, height 30); row 2 = category name (merged A2:E2, bold size 12, center, height 20); row 3 = blank (height 20).
- `should render group matrix with diagonal-black pattern` — given a group with 4 entries, when the player rows are read back, then each row has 4 matrix cells; the diagonal cell (row i, matrix col i) has solid fill `FF000000`; other matrix cells have no fill but do have thin borders.
- `should set grey fill on header cells` — given the header row, when read back, then `"Player"`, player-number, `"Points"`, and `"Position"` cells have solid fill `FFA0A0A0` and bold font.
- `should format player name with club suffix` — given a player with name `"Alice"` and club `"NYC"`, when the cell is read back, then the value is `"Alice (NYC)"`. Given a player with no club, then the value is just the name.
- `should set correct column widths` — given maxPlayer=4, when widths are read back, then col 1 = 4, cols 3–6 = 12, cols 7–8 = 10; col 2 = max(runeCount("Player")+1, longest player name runeCount + 1).
- `should set correct row heights` — given a category sheet, when heights are read back, then row 1 = 30, row 2 = 20, row 3 = 20, and each player row = 25.
- `should match the Go-generated chart near-exactly` — given the Go oracle tournament, when TS and Go both generate the chart `.xlsx`, then reading both with ExcelJS and comparing all cell values, merged ranges, fill colors, borders, fonts, alignment, column widths, and row heights yields equality.

### Checkpoints: spec
### Review: inline

### Production-risk notes
- **The chart admits near-exact Go-vs-TS comparison** because colors are fixed constants (not random like the schedule). This is the most exacting validation available in the rewrite — use it.
- **`tealeg/xlsx` vs ExcelJS merge semantics.** `tealeg` `Merge(hcells, 0)` = "hcells additional cells to the right" (total span = hcells+1). ExcelJS `mergeCells("A1:D1")` takes an explicit A1 range. The port must convert: `Merge(maxPlayer+3, 0)` at cell A1 → `mergeCells("A1:" + colToLetter(1 + maxPlayer + 3) + "1")`.
- **`SetColAutoWidth` has no ExcelJS equivalent.** The port must compute column 2's width manually: iterate all cells in column 2, find the max `runeCount(value) + 1`. (In Go, `strings.Count(s, "")` = `utf8.RuneCountInString(s) + 1`.) For ASCII player names, JS `string.length + 1` matches. For multi-byte characters outside BMP, JS `.length` over-counts (surrogate pairs) — unlikely for tournament names but worth a code comment.
- **Player row with negative `entriesIdx` entry.** Go resolves `idx >= 0` entries and leaves negative-index entries as zero-valued `Entry{}` (name returns `""`). The TS port must do the same: skip resolution for negative indices, use a zero/empty entry whose `name` is `""`.
- **The `workbookToBuffer` utility** already exists in `features/schedule/excel/draftScheduleWorkbook.ts`. The chart export may import it or the executor may extract it to `shared/excel/`. Either is fine — the wiring (R4) just needs a buffer → blob → download path.

---

## Requirement 3: Scoresheet export — `scoresheetWorkbook`

`web/src/features/scoresheet/excel/scoresheetWorkbook.ts`: port of `ExportScoresheet` + `AddMatchScoresheet` from `endpoint/schedule/internal/export_scoresheet.go` (`excelize` → ExcelJS). For every group match and every knockout match, clones the user-supplied template sheet (named by the category's `shortName`) into a new sheet and substitutes placeholders.

### Acceptance criteria
- Given a tournament with categories, groups (with rounds), and knockout rounds, and a loaded template workbook, when `exportScoresheets` runs, then for every group match and every knockout match, a new sheet is created by cloning the template sheet named by `match.categoryShortName`.
- Given a group match at `grpIdx`, `roundIdx`, with `table`, when its scoresheet sheet is created, then the sheet is named `{catShortName}-Grp{grpIdx+1}-Rd{roundIdx+1}-{table}`.
- Given a knockout match at `round`, `matchIdx`, when its scoresheet sheet is created, then the sheet is named `{catShortName}-KO-Rd{round}-{matchIdx+1}`.
- Given a template sheet containing placeholder cells, when a match's scoresheet is generated, then every cell containing `{{category}}` is replaced with the category short name, `{{tournament}}` with the tournament name, `{{date}}` with the match datetime formatted as `YYYY-MM-DD`, `{{time}}` as `HH:MM`, `{{table}}` with the match table, `{{player1}}` with `entries[entry1Idx].name` (or `""` if `entry1Idx < 0`), and `{{player2}}` with `entries[entry2Idx].name` (or `""` if `entry2Idx < 0`).
- Given a cell containing multiple placeholders (e.g., `"{{player1}} vs {{player2}}"`), when substituted, then all placeholders in that cell are replaced in a single pass.
- Given a template cell that does **not** contain any placeholder, when the scoresheet is generated, then that cell's value and style are preserved unchanged from the template (template fidelity).
- Given a template sheet whose name does not match any category `shortName`, when a match for that category is processed, then an error is thrown: `"template sheet '<shortName>' not found"`.
- Given a match whose generated sheet name already exists (duplicate), when processed, then the match is skipped (idempotent — no error, no duplicate sheet).
- Given a match with `entry1Idx < 0` (bye/empty), when `{{player1}}` is substituted, then the placeholder is replaced with an empty string (not removed — the surrounding text survives).
- Given the `testdata/scoresheet template.xlsx` (sheets `MT`, `MS`, `MD`) and a tournament with matches for those categories, when scoresheets are generated, then every new sheet has correct placeholder substitutions and all non-placeholder template cells (values + styles + merges) are preserved.

### Integration tests
- `should create a sheet per group match with correct naming` — given a category `MS` with group 0, round 1, table `"T1"`, when scoresheets are generated, then a sheet named `MS-Grp1-Rd2-T1` exists.
- `should create a sheet per knockout match with correct naming` — given a category `MS` with a knockout round 2, match index 0, when scoresheets are generated, then a sheet named `MS-KO-Rd2-1` exists.
- `should substitute all placeholders correctly` — given a template cell `"{{player1}} vs {{player2}} on {{date}}"`, when a match with `player1="Alice"`, `player2="Bob"`, `datetime="2025-03-22T09:00"` is processed, then the cell value is `"Alice vs Bob on 2025-03-22"`.
- `should format date as YYYY-MM-DD and time as HH:MM` — given `datetime="2025-03-22T09:00"`, when `{{date}}` and `{{time}}` are substituted, then date = `"2025-03-22"` and time = `"09:00"`.
- `should substitute empty string for bye player (entryIdx < 0)` — given a match with `entry1Idx = -1`, when `{{player1}}` is substituted, then the replacement is `""`.
- `should preserve non-placeholder template cells unchanged` — given a template with styled cells containing no placeholders, when scoresheets are generated, then those cells retain their original values and styles (font, fill, border, alignment, number format).
- `should preserve template merged ranges in cloned sheets` — given a template sheet with merge ranges (e.g., `B1:X1`), when cloned, then the cloned sheet has the same merge ranges.
- `should throw when template sheet not found` — given a category `WS` with no matching template sheet, when a match for `WS` is processed, then an error with message containing `"template sheet 'WS' not found"` is thrown.
- `should skip duplicate sheet names (idempotent)` — given two matches that produce the same sheet name, when processed, then only one sheet is created and no error is thrown.
- `should generate correct scoresheets from testdata template and tournament` — given `testdata/scoresheet template.xlsx` + a tournament with populated groups and knockout rounds for `MS`/`MD`/`MT`, when scoresheets are generated, then every sheet has correct names and all placeholder cells contain substituted values.

### Checkpoints: spec
### Review: inline

### Production-risk notes
- **Depends on R1 (`cloneSheet`).** The template-cloning step delegates to `cloneSheet`. If `cloneSheet` fails to preserve a style property, the printed scoresheet will look wrong. R1's dedicated unit test and this requirement's template-fidelity assertion are the safety nets.
- **Go's `CopySheet` + `GetRows(templateName)` vs TS's clone-then-walk.** Go clones the template sheet first, then reads placeholder cells from the *template* and writes substituted values to the *new sheet*. The TS port can equivalently clone the template and then walk the *clone's* cells, substituting in-place. The observable result is identical — only cells containing placeholders are modified; all others retain cloned values + styles.
- **Placeholder substitution is pure string replacement** — no failure mode beyond clone failures (propagated as typed errors). The Go `isReplaced` flag ensures only cells that actually changed are written back; in the clone-then-walk approach, this means only write back a cell if it contained a placeholder (skip cells without any `{{...}}` token).
- **Empty cells are skipped.** Go's `if cellValue == "" { continue }` means truly empty cells are not processed. In the TS clone-then-walk approach, empty cells are already correctly cloned (as empty); no substitution is needed.
- **Match metadata assignment.** `ExportScoresheet` sets `CategoryShortName`, `GroupIdx`, `RoundIdx`, `Round`, `MatchIdx` on each match before calling `AddMatchScoresheet`. For group matches: `Round = -1`, `MatchIdx = -1`. For knockout matches: `GroupIdx = -1`, `RoundIdx = -1`, `Round = koRound.Round`, `MatchIdx = m`. The TS port must set these (or pass them explicitly) so `IsKnockout()` and sheet-naming logic work correctly.

---

## Requirement 4: TournamentView wiring + structural cleanup

Replace `apiExportRoundRobinExcel` and `apiExportScoresheetWithTemplate` in `web/src/views/TournamentView.vue` with the local pipeline. The chart export path: `createRobinCharts(tournament)` → `workbookToBuffer` → blob download. The scoresheet export path: load user-selected template `.xlsx` with ExcelJS → `exportScoresheets(tournament, templateWorkbook)` → `workbookToBuffer` → blob download. Drop the two dead client functions from `client.ts`.

### Acceptance criteria
- Given the user clicks "EXPORT RR CHARTS", when `exportRoundRobin` runs, then it calls `createRobinCharts(tournament)`, produces an `.xlsx` blob, and triggers a download — with **no `fetch`** call to the server.
- Given the user selects a scoresheet template `.xlsx`, when `exportScoresheetWithTemplateSelected` runs, then it loads the template with ExcelJS, calls `exportScoresheets(tournament, templateWorkbook)`, produces an `.xlsx` blob, and triggers a download — with **no `fetch`** call.
- Given a scoresheet export error (template sheet not found, corrupt template), when the handler runs, then the error's message is surfaced via `alert` and no download occurs.
- Given a chart export error (e.g., malformed tournament), when the handler runs, then the error is surfaced via `alert`.
- `TournamentView` no longer imports `apiExportRoundRobinExcel` or `apiExportScoresheetWithTemplate` from `@/client/client`.
- `apiExportRoundRobinExcel` and `apiExportScoresheetWithTemplate` are deleted from `client.ts`.
- No source under `web/src` imports the deleted symbols: grep returns zero matches.

### Integration tests
- `should generate and download a round-robin chart with no server` — given a tournament with populated groups, when `exportRoundRobin` runs, then a blob is created and downloaded, and `fetch` was never called.
- `should generate and download scoresheets from a template with no server` — given a tournament and a template `.xlsx` file, when the scoresheet handler runs, then a blob is created and downloaded, and `fetch` was never called.
- `should surface scoresheet errors via alert` — given a template `.xlsx` missing a required sheet (e.g., no sheet for category `WS`), when the handler runs, then `alert` is called with the error message and no download occurs.
- `should have no remaining references to the removed export endpoints` — given the tree after cleanup, when grepping `web/src` for `apiExportRoundRobinExcel` and `apiExportScoresheetWithTemplate`, then zero matches are found and `vue-tsc --build --force` succeeds.

### Checkpoints: full
### Review: parallel

### Production-risk notes
- The chart export is synchronous (build workbook → buffer → blob → download). Wrap in `try/catch` to surface errors via `alert`, matching the existing `exportDraftSchedule` pattern.
- The scoresheet export is **async** (ExcelJS `workbook.xlsx.load(templateBuffer)` is Promise-based, and `workbookToBuffer` is async). The `try/catch` wraps the async chain; errors surface via `alert`.
- The blob download reuses the existing `createObjectURL` + `a.download` pattern already in `exportRoundRobin` and `exportScoresheetWithTemplateSelected`. No new download abstraction needed.
- The `validTournament` validation currently lives in `client.ts` alongside the deleted functions. If it's only used by the two deleted functions, it becomes dead code — verify with grep before deciding to keep or remove it. The existing `exportDraftSchedule` in TournamentView already calls `generateRoundsForTournament` which validates internally, so `validTournament` may be redundant.

---

## Feature acceptance

- **Given** `testdata/scoresheet template.xlsx` and a tournament with drawn groups and generated rounds (via `generateRoundsForTournament`), **when** the user exports a round-robin chart and scoresheets in-browser, **then** the chart matches the current Go output (values + styling — near-exact, validated by the Go oracle) and the scoresheets contain correct substituted values with the template layout (values, styles, merges) preserved — with no server involved (`fetch` asserted unused).

## Notes on test philosophy (from `docs/lessons.md`)

- **Chart golden captured from Go** (the oracle): `chart_oracle_test.go` runs `CreateRobinCharts` on a representative tournament and commits the `.xlsx` bytes. The TS test reads both the golden `.xlsx` and the TS-generated workbook with ExcelJS and compares cell-by-cell — never a self-comparison of the TS output.
- **Near-exact comparison is valid for the chart** because colors are fixed constants (`#A0A0A0`, `#000000`), unlike the schedule's random colors. Compare values, merged ranges, fills, fonts, borders, widths, and heights.
- **`cloneSheet` gets its own dedicated test** against a known worksheet and the real `scoresheet template.xlsx` — it is the riskiest component and gets direct validation independent of the scoresheet feature test.
- **Template fidelity is the scoresheet's safety net**: assert that non-placeholder cells (values + styles) survive the clone+substitute pipeline unchanged. This catches any `cloneSheet` defect that the unit test might miss.
- **Both outputs are pure outputs (no import)** — there is no round-trip safety net. Validation is generate-and-compare only.