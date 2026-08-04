# Changelog

## [Unreleased]

### Added — pure-frontend rewrite (Slice 0: foundation)
- **Canonical model** (`web/src/shared/model`): types, the `Entry` class, and `serialize`/`parse`/`rehydrate` as the single source of truth. `types.ts` is now a re-export shim (existing `@/types/types` imports unchanged).
- **Document store** (`web/src/app/documentStore`): the reactive tournament document ref + `newTournament()`. Drop-in successor to the old `store/state.ts`.
- **Tournament-as-document storage** (`web/src/features/tournament-doc`):
  - Open/save `.json` via the File System Access API, with upload/download fallback for non-Chromium browsers.
  - IndexedDB **crash-recovery autosave** (debounced deep watch; never throws into the UI; self-heals corrupt records on resume).
  - Bounded **recent-tournaments** list (IndexedDB, upsert-by-name, FIFO-pruned).
- **HomeView rebuilt**: Import / Create New / recents list (open + remove).
- **TournamentView SAVE** now writes in place when a file handle is held (permission re-grant, download fallback), instead of download-only.
- **Vitest** test stack (`vitest`, `@vue/test-utils`, `jsdom`, `fake-indexeddb`); 45 tests, type-check clean.

### Added — Entry import (Slice 2)
- **Excel ingestion core** (`web/src/shared/excel`, `web/src/features/entry`): a thin `readWorkbook` raw-value wrapper over ExcelJS, plus `importSingles` / `importDoubles` / `importTeam` that validate at the ingestion boundary and throw a typed `ParseError`.
- **CategoryCard + TournamentView wiring**: per-category entry import surfaced in the UI for all three event types.
- **Structural cleanup**: dropped legacy `apiImport*Entry` client functions once all call sites moved local.

### Added — Schedule (Slice 3)
- **Scheduler primitives**: deterministic HSL→hex color generation and cell-address splitting helpers.
- **Draft schedule round-trip, fully client-side**: `scheduleMatches` (greedy scheduler), `draftScheduleWorkbook` (multi-sheet `.xlsx` writer via ExcelJS), and `importFinalSchedule` (xlsx reader + match-merge).
- **TournamentView wiring** + structural cleanup of dead client functions.

### Added — Chart & scoresheet exports (Slice 4)
- **`cloneSheet`**: deep-copy helper (values + styles + merges + dims), accounting for ExcelJS internals (`_columns` is 0-indexed while the public API is 1-based).
- **Round-robin chart export**: `roundrobinChartWorkbook` (port of the Go `CreateRobinCharts`), with a frozen Go-oracle golden baseline.
- **Scoresheet export**: `scoresheetWorkbook` (port of `ExportScoresheet`) using `cloneSheet` + placeholder substitution.
- **TournamentView wiring** to the local chart/scoresheet pipeline; legacy `client.ts` removed.

### Changed — Cutover (Slice 5)
- **Relocated** test fixtures under `web/testdata/` with all test path references updated.
- **Deleted the entire Go backend**: `cmd/`, `endpoint/`, `model/`, `utils/`, `go.mod`, `go.sum`, `.air.toml`, `web/static.go`; removed the Vite dev-server proxy. (`git tag last-go-backend @ c969414` marks the final commit carrying Go code.)
- **Static-site deploy**: GitHub Pages workflow + SPA fallback + Vite `base` path configured.
- **Docs rewritten** for the pure-frontend architecture: `ARCHITECTURE.md`, `FUNCTIONALITY.md`, `AI_AGENT_GUIDE.md`, `AGENTS.md`.

### Notes
- Completes the pure-frontend rewrite (slices 0–5). The app is now a static SPA deployed to GitHub Pages — **no backend, no server, no Go**; all logic runs in-browser and Excel I/O uses ExcelJS. Draw/matches (slice 1) was delivered in an earlier slice. 235 tests green, `vue-tsc` clean.
