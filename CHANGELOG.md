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

### Notes
- Slice 0 of a 6-slice pure-frontend rewrite. The Go backend is untouched (removed in the cutover slice); legacy `client.ts` / `calculator/` paths still coexist as the strangler fallback. See `docs/plans/2026-08-01-pure-frontend-slice*-design.md` for the remaining slices.
