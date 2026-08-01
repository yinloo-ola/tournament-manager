# Implementation Plan: Pure-Frontend Foundation (Slice 0)

## Overview
Design: docs/plans/2026-08-01-pure-frontend-foundation-design.md

Establishes the document-management foundation for the pure-frontend rewrite: a single canonical model, a feature-sliced app shell, and a file-as-document + IndexedDB-autosave storage layer. No feature logic is ported here; this slice is what every later slice plugs into. The new `documentStore` must remain a drop-in replacement for today's `store/state.ts` (`tournament` ref, same shape) so existing feature components keep working unchanged during the transition.

Requirements are listed in build order (dependencies first).

---

## Requirement 1: Single canonical model

### Acceptance criteria
- Given a representative tournament fixture (singles, with groups and knockout rounds), when `serialize()` then `parse()` is applied, then the result deep-equals the original.
- Given a parsed tournament, when reading an entry's display name anywhere it appears (category entries, group match entries, knockout match entries), then it returns the computed name — proving `Entry` instances are rehydrated as class instances with the `name` getter (regression for today's `injectEntriesTournament`).
- Given `testdata/tournament.json`, when parsed, then every entry nested in categories, groups, and knockout matches is an `Entry` class instance.
- Given edge fixtures (empty tournament, doubles, team), when round-tripped through serialize/parse, then the result is lossless.
- Given the rest of the app, when it needs a tournament type, then it imports from `shared/model` — no other module re-implements tournament (de)serialization (`types.ts` is superseded).

### Integration tests
- `should round-trip a tournament losslessly through serialize/parse` — `parse(serialize(t))` deep-equals `t` for singles/doubles/team fixtures.
- `should rehydrate Entry class instances with a working name getter` — parsed entries are `Entry` instances whose `.name` returns the expected display name.
- `should rehydrate entries nested in groups and knockout matches` — group/knockout match entries are `Entry` instances after parse.
- `should be the single model source` — (structural) the app imports `Tournament`/`Entry` from `shared/model`; the legacy `types.ts` no longer defines them.

### Checkpoints: full
### Review: parallel

### Production-risk notes
- Data durability: `parse` must never silently corrupt. The lossless round-trip test is the guardrail; carry the existing `testdata/tournament.json` as the canonical fixture.

---

## Requirement 2: New tournament

### Acceptance criteria
- Given the home screen with no document open, when the user chooses "New", then a new tournament with sensible defaults loads as the active document (today's `store/state.ts` defaults: empty name, `numTables` 0, default start time, one Singles category with default group sizing).
- Given a newly created tournament, when the user edits it, then the document store holds the edits reactively and existing feature components bound to the `tournament` ref still reflect them (backward-compatibility contract).

### Integration tests
- `should create a new tournament with default values` — `newTournament()` yields the expected default `Tournament`.
- `should expose the tournament as a reactive ref consumable by existing components` — mutating `tournament.value` reflects in a component bound to it.

### Checkpoints: spec
### Review: inline

---

## Requirement 3: Recent tournaments list

### Acceptance criteria
- Given the home screen, when rendered, then it shows the recent-tournaments list read from IndexedDB (name, last-modified, source kind).
- Given a recent entry, when the user opens it, then that tournament loads as the active document from its stored source.
- Given a recent entry, when the user removes it, then it disappears from the list and is deleted from IndexedDB — the underlying file on disk is NOT deleted.
- Given the list is at its bounded maximum, when a new entry is added, then the oldest is pruned (FIFO) and the list never exceeds the bound.
- Given a browser without the File System Access API (fallback mode), when a document is opened via upload, then its recent entry records source kind as "downloaded".

### Integration tests
- `should list recent tournaments from IndexedDB`
- `should open a recent tournament into the active document`
- `should remove a recent entry from list and IndexedDB without deleting the source file`
- `should prune the oldest entry (FIFO) when the bound is exceeded`

### Checkpoints: full
### Review: inline

### Production-risk notes
- Recent entries may hold optional file-handle references. Pruning must remove only metadata — never orphan the in-memory handle of the currently-open document.

---

## Requirement 4: Crash-recovery autosave

### Acceptance criteria
- Given an active tournament, when it changes, then its serialized state is written to IndexedDB (debounced).
- Given a burst of rapid changes within the debounce window, when they settle, then only a single IndexedDB write occurs (coalesced).
- Given the app reopens after a close/crash with no explicit save, when it starts, then the most recent autosaved state is offered/loaded for resume.
- Given a "new", never-saved tournament, when it changes, then it is also autosaved (so new docs are recoverable).
- Given an IndexedDB quota error during an autosave write, when the write fails, then the error is caught, a non-blocking warning is shown, and the active document is unaffected (no throw into the UI path).

### Integration tests
- `should persist the active tournament to IndexedDB on change`
- `should coalesce a burst of changes into a single IndexedDB write`
- `should restore the most recent state on reopen after no explicit save`
- `should surface a non-blocking warning and not throw on IndexedDB quota error`

### Checkpoints: full
### Review: parallel

### Production-risk notes
- Data durability: autosave is the crash-recovery safety net only (explicit save remains authoritative). It must never throw into the UI path and must be debounced to avoid write thrash.

---

## Requirement 5: Open from file

### Acceptance criteria
- Given a Chromium browser with the File System Access API, when the user opens a `.json` tournament, then the picker shows, the file is read and parsed, the tournament loads as the active document, and the file handle is remembered.
- Given a browser without the File System Access API, when the user opens a `.json`, then a standard file upload reads, parses, and loads it (fallback) with no error surfaced.
- Given a corrupt or unparsable `.json`, when opened, then a clear "could not open this file" error is shown and the current active document is NOT clobbered.
- Given a successfully opened file, when opened, then a recent entry is recorded or updated in the recents list.
- Given an empty/zero-byte or wrong-type file, when opened, then it is treated as a parse error with a friendly message.

### Integration tests
- `should open and load a valid .json tournament via the File System Access path` (with an injected `FileSystem` double)
- `should fall back to upload when the File System Access API is unavailable`
- `should show an error and preserve the current document when opening a corrupt .json`
- `should record/update a recent entry on successful open`

### Checkpoints: full
### Review: inline

### Production-risk notes
- Parse errors must never clobber the active document. The `FileSystem` port abstraction is what makes the File-System-Access vs. fallback split unit-testable without a real browser picker.

---

## Requirement 6: Save to file

### Acceptance criteria
- Given an active tournament opened from a file (File System Access API), when the user saves, then the on-disk `.json` is updated in place with the serialized tournament.
- Given permission was revoked since open, when the user saves, then permission is re-prompted; if still denied, save falls back to a download and informs the user the on-disk file was not updated.
- Given a browser without the File System Access API, when the user saves, then a `.json` download is produced (today's behavior).
- Given a "new" tournament that has never been saved, when the user saves, then a new file is created (or a download produced in fallback mode).
- Given a successful save, when complete, then the recents list's last-modified timestamp for this document is updated, and the written bytes equal `serialize()` of the active tournament.

### Integration tests
- `should write the active tournament back to the opened file in place (File System Access path)`
- `should re-prompt for permission and fall back to download if denied`
- `should produce a download when the File System Access API is unavailable`
- `should update the recents last-modified timestamp on save`

### Checkpoints: full
### Review: parallel

### Production-risk notes
- Data durability: explicit save is the user's authoritative action. The written `.json` must equal `serialize()` of the source (byte-for-byte) so a reload reproduces the document exactly.

---

## Feature acceptance
Derived from the design doc. One end-to-end test exercising the requirements together (no server involved throughout):

- `should open, edit, reload, and save a tournament end-to-end with no server` — Given a tournament previously saved as a `.json` file and present in the recent list, when the user opens it from the home screen, edits a category, reloads the browser tab, then chooses Save, then the on-disk file reflects the edits, the recent-list last-modified timestamp updates, and autosave preserved the edit across the reload.
- `should recover unsaved edits after a crash with no server` — Given an open tournament with unsaved edits and no explicit save, when the browser tab is closed and the app reopened, then the most recent autosaved state is offered for resume.
