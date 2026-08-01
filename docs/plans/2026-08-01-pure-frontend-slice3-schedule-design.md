# Pure-Frontend Rewrite — Slice 3: Schedule (Draft Generation + Draft .xlsx Export + Final .xlsx Import/Merge)

**Status:** Brainstorm → pending plan
**Date:** 2026-08-01
**Depends on:** Slice 0 (foundation), Slice 1 (groups/knockout exist to schedule).
**Scope:** One PR. The full schedule round-trip in-browser: generate the draft schedule, export it as a styled multi-sheet `.xlsx`, let the user edit it externally, and re-import the edited `.xlsx` merging the final schedule back into the tournament. **This is the largest and highest-risk slice of the rewrite.**

---

## Requirements

1. **Draft schedule generation (port).** Port `scheduleMatches` to TS: greedy time-slot allocation of group-stage then knockout-stage matches across `numTables`, advancing `nextStartTime` per category by `durationMinutes`. Produces a `Schedule` (time-slots × tables → matches), client-side.
2. **Draft `.xlsx` export (port).** Port `CreateDraftSchedule` Excel writing to ExcelJS — multiple sheets with exact structure: `schedule` (time-slot × table grid, color-coded match cells, internal hyperlinks to the `matches` sheet), `matches` (one row per match: SN, Category, Round, Group, KO Round, Match, Date/Time, Table, EntryID1, EntryID2 — **sheet-protected**), `Tournament Info`, and one per-category entry sheet. Includes header/match/datetime cell styles, column widths, and merged cells.
3. **Color coding (port).** Port `utils/color` (HSL → `#RRGGBB`) to generate per-category/per-group colors used in the `schedule` sheet.
4. **Final `.xlsx` import/merge (port).** Port `ImportFinalSchedule` to TS: read the edited `.xlsx`, parse cell addresses (port `utils/excelhelper` `AC21 → row/col`), reconstruct `map[category]→[]Group` and `map[category]→[]KnockoutRound`, merge the final schedule (match table/date/duration) back into the tournament.
5. Replaces `apiExportDraftSchedule` and `apiImportFinalSchedule`; code lives in `features/schedule/`.

---

## Problem

The schedule is the most Excel-entangled feature: the draft is a generated, styled, multi-sheet workbook; the user manually refines it in a spreadsheet; the edited file is parsed back. Option 1 (chosen earlier) preserves this exact round-trip, just done client-side. Everything here is real Excel I/O with non-trivial formatting — hence the elevated risk.

---

## Approaches considered

- **ExcelJS for read + write (chosen).** Full style support (fills, borders, fonts, alignment), merged cells, column widths, hyperlinks, and sheet protection — all features this slice needs. One library across the rewrite.
- **SheetJS for read, ExcelJS for write.** Rejected — two libraries, two cell models; not worth it.
- **Replace the Excel edit loop with an in-app editor.** This was Option 2 from the earlier brainstorm; deliberately deferred/rejected for this rewrite to preserve current UX. (A future enhancement, not this slice.)

---

## Architecture

```
features/schedule/
  domain/
    scheduleMatches.ts        — port of scheduleMatches (greedy allocation) + getSlotsForCategory{Group,Knockout}
    importFinalSchedule.ts    — port of ImportFinalSchedule + cell-address parsing
  excel/
    draftScheduleWorkbook.ts  — port of draft_schedule.go populate* writers (ExcelJS)
    color.ts                  — port of utils/color (HSL→hex)
shared/excel/
  address.ts                  — port of utils/excelhelper (cell-name ↔ coordinates)
  styles.ts                   — reusable ExcelJS style builders (header/match/datetime)
```

---

## Components

- **`scheduleMatches.ts`** — deterministic greedy scheduler producing the `Schedule` struct (deterministic because allocation is greedy with no randomness; **only the colors are random** — see Production-risk).
- **`draftScheduleWorkbook.ts`** — builds the ExcelJS workbook: `schedule`, `matches` (protected), `Tournament Info`, per-category entry sheets; applies styles, widths, merges, and internal hyperlinks from schedule cells to the matches sheet.
- **`color.ts`** — HSL→RGB hex generator (port of `utils/color`).
- **`importFinalSchedule.ts`** + **`address.ts`** — reads the edited workbook, resolves cell addresses, rebuilds the groups/knockout maps.

---

## Data flow

Generate: `scheduleMatches(tournament)` → `Schedule` → `draftScheduleWorkbook` → `.xlsx` blob (download via slice-0 fallback path). The user edits it externally.
Import: edited `.xlsx` → `readWorkbook` → `importFinalSchedule` → groups/knockout maps → merged into the active tournament (persisted by slice 0). No server.

---

## Error handling

- Unparseable edited workbook / missing expected sheets or cells → typed error ("could not read final schedule: …"); document unchanged.
- `scheduleMatches` producing zero slots for a category → logged and skipped (matches Go's `slog.Info` skip behavior), not fatal.
- Invalid cell address on import → error per the existing guards in `getMatchFromCellAddr`.

---

## Testing

- **`scheduleMatches` value-equality (primary, deterministic):** run `testdata/tournament.json` through both Go and TS; assert the resulting `Schedule` (time-slots, tables, match assignments, date-times) is **identical**. The algorithm is deterministic, so this compares exactly.
- **Draft `.xlsx` structural diff:** generate the draft from Go and TS; parse both with ExcelJS and compare **all cell values, sheet structure, merged ranges, column widths, and non-color styles**. Colors are compared for *format validity only* (must be `#RRGGBB`), **not exact value** — see Production-risk.
- **Round-trip cross-validation:** Go-exported draft → TS-import, and TS-exported draft → Go-import; assert the merged tournaments agree. This proves the TS write and read are individually correct against the Go oracle.

---

## Production-risk areas

- **HIGH.** This slice concentrates the rewrite's Excel fidelity risk:
  - **Color non-determinism (the key gotcha).** `utils/color.GenerateColors` seeds with `time.Now()` and adds random jitter, so the Go output's colors vary run-to-run. Byte-exact `.xlsx` comparison is therefore **impossible** and would produce false failures. Validation must be *structural* (values, layout, non-color styles) with colors excluded. The TS port should additionally make color generation **deterministic** (fixed seed or dropped jitter) so future TS↔TS runs are reproducible — a deliberate, documented behavior change from Go, acceptable because colors are decorative.
  - **Feature surface:** styles, merged cells, column widths, internal hyperlinks, and **sheet protection** (`ProtectSheet`) all must work in ExcelJS. Each is supported but each is a fidelity checkpoint.
  - **Cell-address parsing on import** (`AC21` → row/col and back) — port `utils/excelhelper`; covered by the round-trip cross-test.
- Mitigations: the round-trip cross-validation against the Go oracle is the safety net; structural (not byte) comparison avoids the color false-failure trap.

---

## Feature acceptance

- **Given** `testdata/tournament.json`, **when** the user generates a draft schedule and exports it in-browser, edits it in a spreadsheet, and re-imports it, **then** the merged final schedule agrees structurally with the current Go round-trip — with no server involved.

---

## Out of scope

- Round-robin chart and scoresheet exports (slice 4); Go removal (slice 5); an in-app schedule editor (explicitly deferred).
