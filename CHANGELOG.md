# Changelog

## [Unreleased]

## [1.1.0] - 2026-08-04

### Added — Material 3 redesign
- **M3 design-token system** (`web/src/styles/tokens.css` + UnoCSS theme bridge in `uno.config.ts`): seed `#1A56DB`, full tonal ramp (primary/secondary/tertiary/error + 5 surface containers + outline + inverse), elevation levels 0–5, shape radii, motion easings/durations, and the M3 typography scale. All colors are CSS variables (dark-mode-ready).
- **Single top-app-bar shell**: one persistent app bar; Home is the empty-state launcher (not a separate route). The 6 actions previously buried in a hamburger are surfaced: prominent **Save** button + **Document ▾** menu (Load / Export RR charts / Export draft schedule / Import final schedule / Export scoresheets). Router fix: added `/` route + catch-all redirect (Home was previously unreachable).
- **Snackbar system** (`shared/ui/toast.ts` + `widgets/SnackbarHost.vue`): M3 snackbar — inverse-surface, elevation-3, 4s auto-dismiss, one-at-a-time, slide-up motion, `role="status"`. Module-singleton `useToast()` composable.
- **Visual knockout bracket** (`KnockoutMatchesTab`): rounds as columns of match cards with human-readable round names + bye/empty handling, above the data table.
- **MatchesTable widget**: shared six-column match data table extracted from the group + knockout tabs.
- **`prefers-reduced-motion` support**: a single media-query block collapses all `--md-duration-*` vars + a global `*` neutralization rule.

### Changed
- **All 9 widget primitives restyled to M3**: buttons gained `variant`/`tone` props (`SimpleButton`: filled/tonal/text; `OutlinedButton`: primary/error) — kills hardcoded color drift at its root. Inputs/selects use M3 text-field tokens with floating-label mechanics preserved. `ModalDialog` gained a real focus trap (Tab cycling, Esc-to-close, focus restore). `DropdownMenu`/`MenuItem`/`GridTable` tokenized.
- **All 25 `alert()` calls eliminated**: migrated to non-blocking toasts (info/success/error) across 4 files. Bonus: fixed a layering violation — `schedule.ts` (domain) was calling `alert()` directly; now returns `false` and the caller toasts.
- **Home, Setup, Matches screens** redesigned inside the app-bar shell with M3 tokens, empty states, and (on CategoryCard) a lifecycle status chip.
- **Domain refactor** (from code review): `roundName()` moved from the component to `features/matches/domain/roundName.ts`; `relativeTimeFromNow()` moved from HomeView to `calculator/date.ts`.
- **E2E test** (`scripts/browser-test.sh`) updated for the redesigned UI: toast-capture MutationObserver, Document-menu selectors, unambiguous modal-close + remove-card selectors. All 12 phases pass.

### Notes
- 235 unit tests green, 12/12 e2e phases pass, `vue-tsc` clean, `vite build` clean.
- Zero `alert()` calls remain; zero hardcoded colors in widgets/draw UI.
- Planning artifacts (wayfinder map + 8 decision tickets + nav-shell prototype) under `.scratch/ui-redesign/`.

## [1.0.0] - 2026-08-04

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
