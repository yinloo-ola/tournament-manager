# Pure-Frontend Rewrite — Slice 0: Foundation (App Shell, Single Model, Document Storage)

**Status:** Brainstorm → pending plan
**Date:** 2026-08-01
**Scope:** One PR. Establishes the document-management foundation for the pure-frontend rewrite. No feature logic is ported here; this slice is what every later slice plugs into.

---

## Requirements

These are the testable behaviors this PR delivers. Later slices (entry import, schedule, exports, cutover) are separate design docs.

1. **Open from file.** A user can open a tournament from a `.json` file chosen via the browser file picker. On Chromium browsers this uses the File System Access API (the app remembers the file handle); elsewhere it falls back to a standard `<input type=file>` upload. The parsed tournament loads as the active document.
2. **New tournament.** A user can start a new, empty tournament (sensible defaults, as today's `store/state.ts` does).
3. **Crash-recovery autosave.** The active tournament is persisted to IndexedDB on every change (debounced). A full page reload restores the most recent state even if no file was explicitly saved.
4. **Save to file.** A user can save the active tournament back to the `.json` file it was opened from (File System Access API → writes in place, with permission re-grant on reload). Where the API is unavailable, save produces a downloaded `.json` (today's behavior). Starting from a "new" doc, save creates a new file.
5. **Recent tournaments list.** The app keeps a "recent" list in IndexedDB (name, last-modified, source kind) shown on the home screen. The user can open a recent entry and remove entries. The list self-prunes to a bounded size (no hand-rolled expiry timers).
6. **Single canonical model.** One module (`shared/model/`) defines Tournament, Category, Entry, Match, Group, Schedule, etc. — shape **and** behavior — with `serialize()`/`parse()` functions that round-trip losslessly and rehydrate `Entry` class instances (preserving the `name` getter). This replaces the hand-maintained `types.ts` and the Go `model/` mirror as the single source of truth.

---

## Problem

The repo is a Go backend + embedded Vue SPA. Two structural pains motivate the rewrite:

- **Model drift (sharp pain):** `web/src/types/types.ts` is a hand-maintained copy of the Go `model/` package (the file literally comments *"Constants matching the Go model"*). Every Go model change requires a manual TS edit; drift is silent.
- **Feature jumble + split-brain:** the frontend is organized only by technical layer (`views/`, `components/`, `calculator/`, `client/`, `store/`, `types/`), so one feature is smeared across many folders; meanwhile domain logic is split between frontend (`calculator/draw.ts`) and backend (`generate_rounds.go`) with no rule for which lives where.

Nothing in the backend requires a server — no database, auth, persistence, or external APIs; every endpoint is a stateless transform of user-supplied data. So the agreed direction is a **pure-frontend TS rewrite** that eliminates the backend entirely: one type system kills model drift; a feature-sliced codebase kills the jumble.

This rewrite is too large for one PR, so it is split into independent, separately-shippable slices (each its own design doc), with the Go app retained as a **reference oracle** during migration and removed only at the final cutover slice. **Slice 0 is the foundation** the rest plug into.

---

## Approaches considered (storage model)

The dominant open question for this slice was *where data lives*. Options evaluated:

- **localStorage + hand-rolled expiry/deletion** — works, but localStorage is a key-value bag with no lifecycle, a ~5MB cap, synchronous API, and is wiped by "clear browser data." Needing "expiry + manual deletion" is a smell of fighting the abstraction. **Rejected.**
- **IndexedDB only** — large quota, async, good for structured records; but data is trapped in one browser/origin with no portability or user-owned backup.
- **File only (document model)** — matches the existing mental model (the app already does JSON import/export; a tournament behaves like a document). Portable, backupable, no quota. But a browser crash mid-edit loses work if there's no in-memory safety net.
- **File as source of truth + IndexedDB autosave (chosen)** — the tournament is a `.json` document the user owns (open/save via File System Access API, with upload/download fallback). IndexedDB is only a crash-recovery safety net and the backing store for the "recent" list. Combines portability with never-lose-work durability, with no expiry logic to maintain.

**Execution strategy (chosen over big-bang):** port and validate feature-by-feature against the Go oracle (golden-file/byte-diff for Excel outputs, value-equality for merged data), keeping Go as fallback until cutover. This slice is purely structural + storage, so it carries no port risk.

---

## Architecture

### Target feature-sliced structure (what this slice establishes)

```
web/src/
  app/                     # app shell
    main.ts                # createApp + Pinia + router + UnoCSS (relocated)
    router/                # routes (relocated from router/)
    documentStore.ts       # reactive tournament ref + autosave watcher (replaces store/state.ts)
  features/
    tournament-doc/        # THIS SLICE: document lifecycle
      storage/             # file (FSA API + fallback), IndexedDB autosave, recents
      ui/                  # HomeView (open/recent/new), minimal doc view
  shared/
    model/                 # SINGLE source of truth: types + Entry class + serialize/parse
    ui/                    # (later slices relocate widgets/ here)
    excel/                 # (later slices: ExcelJS wrappers)
  (existing views/ components/ calculator/ client/ widgets/ store/ types/
   remain in place during transition; each later slice relocates its own feature)
```

### Backward-compatibility contract (critical)

The current app is driven by a single `ref<Tournament>` exported from `store/state.ts` that every feature component reads/writes. The new `app/documentStore.ts` **must export a `tournament` ref with the same shape and the same module path semantics** so that *existing feature components keep working unchanged* during the transition. Slice 0 swaps the store's innards (adds file backing + autosave) without changing what its consumers see. Later slices relocate each feature into `features/<feature>/` as they migrate off Go.

### Model as the single source of truth

`shared/model/` carries not just shape but **behavior**:

- `Entry` remains a class with the `name` getter and a `from()` factory (mirrors Go's `Entry.Name()`).
- `serialize(tournament)` / `parse(json)` provide the canonical conversion, consolidating today's scattered logic: the `Entry.from()` rehydration currently living in `calculator/tournament.ts` (`injectEntriesTournament`) and the download logic (`exportTournamentJson`) move into the model + storage layer. After this slice, no other module re-implements JSON (de)serialization of a tournament.

The Go `model/` package is retained untouched as the reference oracle; it is deleted only at cutover.

---

## Components

- **`shared/model/`** — canonical types, the `Entry` class (with `name` getter + `from()`), and `serialize()`/`parse()`. `parse()` rehydrates `Entry` instances wherever they appear (categories, groups, knockout matches).
- **`features/tournament-doc/storage/fileAccess.ts`** — File System Access API wrapper (open picker → read text; save → write to remembered handle; permission re-grant on reload). Feature-detected; returns a `null` capability where unsupported.
- **`features/tournament-doc/storage/fileFallback.ts`** — upload-on-open (`<input type=file>`) and download-on-save (`Blob` + anchor click). This is today's `exportTournamentJson` behavior, relocated.
- **`features/tournament-doc/storage/autosave.ts` (IndexedDB)** — debounced write of the serialized active tournament on change; load-latest on startup (crash recovery). Tiny wrapper over IndexedDB (no heavy ORM).
- **`features/tournament-doc/storage/recents.ts` (IndexedDB)** — recent-documents records (name, last-modified, source kind, optional file-handle reference); bounded size with FIFO prune; open/remove operations.
- **`app/documentStore.ts`** — the reactive `ref<Tournament>` (drop-in replacement for `store/state.ts`) plus a watcher that triggers autosave on change, and actions: `openFromFile`, `newTournament`, `save`, `loadRecent`, `resumeOnStartup`.
- **`features/tournament-doc/ui/HomeView.vue`** — open / recent / new entry points (replaces current HomeView).
- **`features/tournament-doc/ui/DocView.vue`** — minimal display of the loaded tournament (name, categories) proving the round-trip. (Full tournament/match UI relocates in slice 1.)

A small **`FileSystem` port interface** abstracts the file layer so the File System Access vs. fallback split is injectable and unit-testable without a real browser picker.

---

## Data flow

- **Open:** HomeView → `fileAccess.open()` (or fallback upload) → text → `model.parse()` → `documentStore.tournament = parsed` → record in `recents`.
- **Edit + autosave:** any component mutates `documentStore.tournament.value` → watcher (debounced) → `model.serialize()` → IndexedDB autosave write. No server.
- **Save:** `documentStore.save()` → `model.serialize()` → `fileAccess.write()` (in place) or fallback download. Update `recents` last-modified.
- **Crash recovery:** on startup, if no file explicitly opened, `autosave.loadLatest()` → `model.parse()` → restore into store; offer to resume.
- **Recent:** HomeView reads `recents.list()`; open/remove are IndexedDB ops.

---

## Error handling

- **File System Access API unsupported** (Firefox/Safari): feature detection falls back to upload/download transparently; no error surfaced to the user. The recent list still works (source kind recorded as "downloaded").
- **Permission denied / revoked** on save: re-prompt for permission; if still denied, fall back to a download and inform the user the on-disk file was not updated.
- **Corrupt / unparsable `.json`:** `parse()` returns a typed error; UI shows a clear "could not open this file" message and does not clobber the current document.
- **IndexedDB quota exceeded:** autosave catches the error, logs it, and surfaces a non-blocking warning ("autosave paused — please save to a file"); the document itself is unaffected.
- **Empty/zero-byte file or wrong type:** treated as a parse error with a friendly message.

---

## Testing

- **Unit — model:** `parse(serialize(t))` deep-equals `t` for representative fixtures (empty, singles, doubles, team, with groups and knockout rounds); rehydrated `Entry` instances expose the correct `name` getter (regression for current `injectEntriesTournament` behavior).
- **Unit — storage ports:** `fileAccess`, `fileFallback`, `autosave`, `recents` tested against an injected `FileSystem`/fake-IndexedDB double; covers open, save, permission-regrant, quota error, recent add/remove/prune.
- **Unit — autosave debounce:** change bursts coalesce to a single IndexedDB write.
- **Integration:** open a fixture `.json` → assert loaded state matches; mutate → reload → assert restored from autosave; save → assert serialized output byte-for-byte matches `model.serialize()` of the source.
- **Feature acceptance** (below) exercised at the integration gate.

---

## Production-risk areas

- **Data durability is the load-bearing risk of this slice.** A bug in autosave, parse, or the File System Access permission flow can lose a user's tournament. Mitigations: lossless round-trip tests with real fixtures; autosave never throws into the UI path; parse errors never clobber the active document; and explicit-save (file write) remains the user's authoritative action with autosave only a safety net.
- **Browser support variance:** File System Access API availability/permission semantics differ across browsers; the fallback path must be validated, not assumed.
- This slice introduces no Excel I/O, no concurrency/batch, no auth — those risks belong to later slices.

---

## Feature acceptance

The definition of done for this slice — the requirements compose into this end-to-end behavior:

- **Given** a tournament previously saved as a `.json` file (and present in the recent list), **when** the user opens it from the home screen, edits a category, reloads the browser tab, then chooses Save, **then** the on-disk file reflects the edits, the recent-list last-modified timestamp updates, and the whole flow involves no server.

Secondary scenario (crash recovery):

- **Given** an open tournament with unsaved edits and no explicit save, **when** the browser tab is closed and the app reopened, **then** the most recent autosaved state is offered for resume — with no server involved.

---

## Out of scope (later slices)

- Relocation of draw/matches/entry/schedule/export UI into `features/*` (slice 1 onward).
- Porting any Go logic; adding ExcelJS (slices 2–4).
- Removing the Go backend / static embed (cutover slice 5).
