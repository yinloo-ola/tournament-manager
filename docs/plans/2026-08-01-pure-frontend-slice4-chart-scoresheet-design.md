# Pure-Frontend Rewrite — Slice 4: Round-Robin Chart & Scoresheet Exports via ExcelJS

**Status:** Brainstorm → pending plan
**Date:** 2026-08-01
**Depends on:** Slice 0 (foundation), Slice 1 (groups + generated rounds exist to chart/score).
**Scope:** One PR. The two remaining Excel *exports* done in-browser: the round-robin result chart and the per-match scoresheets generated from a user-supplied template. Both are styled Excel outputs; the scoresheet's template-cloning step is the single most intricate port item in the whole rewrite.

---

## Requirements

1. **Round-robin chart export (port).** Port `CreateRobinCharts` (`tealeg/xlsx` → ExcelJS): one sheet per category (named by `shortName`); a styled header (tournament name — merged, bold size 20; category name — merged, bold size 12); for each group a round-robin matrix (player rows × player columns with a **black diagonal cell**, `Player`/`Points`/`Position` columns, grey header fill `#A0A0A0`, thin borders, centered headers, player name with optional `(club)`); fixed column widths and row heights. Client-side.
2. **Scoresheet export (port).** Port `ExportScoresheet` (`excelize` → ExcelJS): for every group match and every knockout match, **clone the user-supplied template sheet** (the template sheet named by the category's `shortName`) into a new sheet and substitute placeholders `{{category}} {{tournament}} {{date}} {{time}} {{table}} {{player1}} {{player2}}`. New-sheet naming: group → `{cat}-Grp{g}-Rd{r}-{table}`; knockout → `{cat}-KO-Rd{round}-{n}`. Client-side.
3. Replaces `apiExportRoundRobinExcel` and `apiExportScoresheetWithTemplate`; code lives in `features/roundrobin/` and `features/scoresheet/`.

---

## Problem

These are pure outputs (no import counterpart), but both are styled Excel the user prints or shares. The chart is fully generated; the scoresheet transforms a user template. Both currently run server-side and must be reproduced faithfully in the browser.

---

## Approaches considered

- **ExcelJS (chosen).** The chart needs fills/borders/fonts/alignment/merges/widths/heights — all supported. The scoresheet needs deep cell+style copying, which ExcelJS can do cell-by-cell.
- **SheetJS.** Community edition has limited *write* styling; rejected for the styled chart.

---

## Architecture

```
features/roundrobin/
  excel/roundrobinChartWorkbook.ts   — port of chart.go (ExcelJS)
features/scoresheet/
  excel/scoresheetWorkbook.ts        — port of export_scoresheet.go (ExcelJS)
shared/excel/
  cloneSheet.ts                      — deep-copy a worksheet (values + styles + merges + dims) — NEW helper
  styles.ts                          — shared style builders
```

---

## Components

- **`roundrobinChartWorkbook.ts`** — builds per-category sheets: header, group matrices with the diagonal-black pattern, fixed widths (`4 / auto / 12×N / 10×2`), row heights (25 for player rows, 30/20 for headers). Colors here are **fixed constants** (`#A0A0A0`, `#000000`), so unlike the schedule this output *is* byte-near-comparable.
- **`cloneSheet.ts` (NEW — the crux).** ExcelJS has **no `copySheet`**. This helper deep-copies a source worksheet to a new one: iterates every cell, copies value **and** the full style object (font, fill, border, alignment, number format), plus merged-cell ranges and column/row dimensions. It is reused by the scoresheet and becomes a shared asset for any future template work.
- **`scoresheetWorkbook.ts`** — for each match: `cloneSheet(templateSheet)` → walk the clone's cells → string-replace the placeholders → write back. Only cells containing a placeholder are rewritten (matching Go's `isReplaced` behavior).

---

## Data flow

Chart: `tournament` (with groups) → `roundrobinChartWorkbook` → `.xlsx` blob (download).
Scoresheet: `tournament` + user-uploaded `scoresheet template.xlsx` → for each match `cloneSheet` + substitute → multi-sheet `.xlsx` blob (download). No server.

---

## Error handling

- Template sheet for a category not found → error (`"template sheet '<cat>' not found"`), matching Go.
- Duplicate generated sheet name → skip (idempotent), matching Go's existing-duplicate guard.
- Placeholder substitution is pure string replace; no failure mode beyond clone failures (propagated as typed errors).

---

## Testing

- **Chart structural+style diff (primary):** generate the chart from Go and TS on `testdata/tournament.json`; since chart colors are fixed constants, compare **values, merged ranges, fills, fonts, borders, widths, and heights** — effectively near-byte-exact. This is the most exacting validation available in the rewrite.
- **Scoresheet test:** feed `testdata/scoresheet template.xlsx` + `tournament.json`; assert the generated workbook has the correct sheet names and that every placeholder cell contains the substituted value; assert non-placeholder template cells are preserved (template fidelity).
- **`cloneSheet` unit test:** clone a small known worksheet; assert value + style + merge parity cell-by-cell (this is the riskiest component and gets its own direct test).

---

## Production-risk areas

- **HIGH — the scoresheet `cloneSheet` is the single most intricate port item in the entire rewrite.** ExcelJS exposes no sheet copy; a hand-rolled deep copy must faithfully reproduce styles, merges, and dimensions or the printed scoresheets will look wrong. Mitigations: a dedicated `cloneSheet` unit test against a known template, plus the template-fidelity assertion that non-placeholder cells survive unchanged.
- The chart is lower risk (fixed colors, well-defined layout) and admits near-exact comparison.
- Both are pure outputs (no import), so there is no round-trip safety net — validation is generate-and-compare only.

---

## Feature acceptance

- **Given** `testdata/tournament.json` (drawn groups + generated rounds) and `testdata/scoresheet template.xlsx`, **when** the user exports a round-robin chart and scoresheets in-browser, **then** the chart matches the current Go output (values + styling) and the scoresheets contain correct substituted values with the template layout preserved — with no server involved.

---

## Out of scope

- Schedule Excel (slice 3); Go removal (slice 5).
