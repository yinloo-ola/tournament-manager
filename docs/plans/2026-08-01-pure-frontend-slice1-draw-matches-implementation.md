# Implementation Plan: Pure-Frontend Slice 1 — Draw & Matches

## Overview
Design: `docs/plans/2026-08-01-pure-frontend-slice1-draw-matches-design.md`

Port the `generateRounds` round-robin + knockout algorithm from Go to TypeScript and relocate the tournament-config, draw, and matches features into feature-sliced folders, removing the frontend's dependency on `POST /api/generateRounds`.

**Ordering rationale.** Requirements are ordered by dependency so each slice compiles and its tests pass independently. The algorithm port (R4) is the only new logic and is the foundation for the end-to-end wiring (R5). UI relocations (R1–R3) only touch `TournamentView.vue` imports. The structural cleanup (R6) runs last, gated by a grep that no legacy import remains.

**Intended branch** (created during `pwk-executing-tasks`, not here — this phase is read-only): `feature/pure-frontend-slice1-draw-matches`.

**New file layout** (per the design's `## Architecture`):
- `features/matches/domain/generateRounds.ts` — PORT
- `features/matches/ui/` → `GroupsTab.vue`, `GroupMatchesTab.vue`, `KnockoutMatchesTab.vue`
- `features/draw/domain/` → `draw.ts`, `groups.ts`
- `features/draw/ui/` → `TournamentDraw.vue`, `PlayersChooser.vue`
- `features/tournament-config/ui/` → `TournamentInfo.vue`, `CategoryCard.vue`
- Tests live in a `__tests__/` dir next to each module (matches the `vitest.config.ts` include glob `src/**/__tests__/**/*.test.ts`).

**Key field mapping** (Go → TS, from `model/model.go` vs `@/shared/model`): `Entry1Idx`→`entry1Idx`, `Entry2Idx`→`entry2Idx`, `DurationMinutes`→`durationMinutes`, `Round`→`round`, `Matches`→`matches`. `EntryByeIdx = -2`, `EntryEmptyIdx = -1` — both already exported from `@/shared/model`. The TS `Match` type carries extra fields (`datetime`, `table`, …) that `generateRounds` leaves unset; golden assertions project to `{entry1Idx, entry2Idx, durationMinutes}` only.

**Production-risk areas** (carried from the design): **Low.** Pure logic + relocation — no Excel, no persistence, no concurrency. The one subtlety is the circle-method index rotation (`getRoundPlayersIndices`); it is fully covered by golden-value tests derived from the existing Go test data, so drift is caught mechanically.

---

## Requirement 4: Port `generateRounds` to TypeScript

`features/matches/domain/generateRounds.ts` — port of `endpoint/schedule/internal/generate_rounds.go`. This is the single new module and the riskiest line, so it lands first and is proven against the Go test data before anything wires to it.

### Acceptance criteria
- Given tournament config with entries assigned to groups, when `generateRoundsForTournament(t)` runs, then every group with ≥2 entries receives a complete round-robin `rounds` array and every category receives `knockoutRounds` built to the next power of two, **with no network call** (no `fetch`, no `apiGenerateRounds`).
- Given a group already carrying generated rounds (non-empty `Rounds`), when `generateRoundsForTournament` runs, then the existing round *count* is validated against a freshly computed round count and its `entry1Idx`/`entry2Idx` are overwritten (round length mismatch throws "number of rounds for group N is not equal").
- Given a group with a single entry, when `generateGroupRounds` runs, then it returns `nil`/`[]` (no matches, no throw).
- Given the Go `nextPowerOfTwo` inputs, when ported, then outputs match the Go table exactly (including `0→1`, `1→1`, `2→2`, `3→4`, …).
- Given a group with fewer entries than qualifiers, when `generateKnockoutRounds` runs, then it throws `Error("not enough players")`.
- Given an internally inconsistent round set (the Go `isRoundValid` failure path), when `generateGroupRounds` runs, then it throws (Go `panic` → TS `throw`), surfaced as "could not generate matches for this category" by the orchestrator.
- Given `getRoundPlayersIndices` for even player counts 4…98 across all valid rounds, when ported, then each round produces a complete pairing of all players (a true round-robin). *(Direct port of the Go `Test_getRoundPlayersIndices` equivalence check against the rotation-based reference; the reference half is dropped per the design's dead-code list.)*
- **Dead code dropped:** `getRoundPlayersIndicesWithRotation`, `generateSlice`, `rotateInPlace`, `reverse` are NOT ported (they are not on the active path).

### Integration tests
- `should match the Go golden output for the 6-player round-robin` — given `entriesIdx=[0,1,2,3,4,5]`, `durationMinutes=30`, when `generateGroupRounds` runs, then projecting each match to `{entry1Idx,entry2Idx,durationMinutes}` deep-equals the 5×3 golden matrix copied verbatim from `Test_generateRounds` (independent expected — not a self round-trip).
- `should match the Go golden output for 4-player getRoundMatches across rounds 0,1,2` — given `entriesIdx=[0,1,2,3]`, when `getRoundMatches` runs per round, then the projected matches equal the three `Test_getRoundMatches` cases.
- `should compute nextPowerOfTwo matching the Go table` — given `{0,1,2,3,4,5,7,8,9,15,16,63,127,129,1025}`, then outputs equal `{1,1,2,4,4,8,8,8,16,16,16,64,128,256,2048}`.
- `should build knockout brackets matching the Go structural golden` — given the four success cases from `Test_generateKnockoutRounds` (2g×2q, 4g×1q, 3g×2q, 5g×4q), then each round's `round` number and `matches.length` equal Go and every match is `{entry1Idx:EntryEmptyIdx, entry2Idx:EntryEmptyIdx}`.
- `should throw when a group has fewer players than qualifiers` — given 1 group with 1 entry and `numQualifiedPerGroup=2`, when `generateKnockoutRounds` runs, then it rejects with "not enough players".
- `should produce rounds and knockoutRounds for a multi-group tournament identical to Go` — given a tournament whose groups carry the Go golden inputs, when `generateRoundsForTournament(t)` runs, then each group's rounds equal the 6-player golden and knockoutRounds match the 2g×2q structural golden (end-to-end oracle through the top-level entry point).

### Checkpoints: spec
### Review: inline

### Production-risk notes
- Circle-method rotation is subtle; mitigated by golden-value tests ported verbatim from `generate_rounds_test.go`. The dead-code helpers (`getRoundPlayersIndicesWithRotation`, `generateSlice`, `rotateInPlace`, `reverse`) are intentionally not ported — omitting them is part of parity (do not re-introduce).

---

## Requirement 3: Draw feature

Relocate the existing client-side draw logic and its UI into `features/draw/`. No algorithm changes — pure move + import rewire.

### Acceptance criteria
- Given a configured category with entries and populated groups, when `doDraw` runs (via `TournamentDraw` → `PlayersChooser`), then every group slot is filled with a distinct entry index (multiset of assigned indices equals the input entries) and no slot remains `EntryEmptyIdx`.
- Given a drawn tournament, when `clearDraw` runs, then all group `rounds` have both entry indices set to `EntryEmptyIdx` and all `entriesIdx` slots are `EntryEmptyIdx`.
- Given player count and main/remainder sizes, when `calculatorGroups` runs, then `numGroupsMain × playersPerGrpMain + numGroupsRemainder × playersPerGrpRemainder ≥ player count` (enough slots), and for a balanced input total slots equal the player count exactly (no overflow, no deficit). The relocated function preserves the legacy output for these inputs (pure move, no algorithm change).
- The relocated `TournamentDraw.vue`/`PlayersChooser.vue` render identically to their `@/components` versions (no visual or behavioral regression); `TournamentView.vue` imports them from `features/draw/ui/`.

### Integration tests
- `should assign every player exactly once with no empty slots` — given a 6-entry category across 2 groups, when `doDraw` runs with `sleepDur=0`, then `hasEmptyPlayer(groups)` is false and the union of assigned indices equals `[0,1,2,3,4,5]`.
- `should reset all rounds and entries on clearDraw` — given a drawn category, when `clearDraw` runs, then every round match and every `entriesIdx` entry is `EntryEmptyIdx`.
- `should compute group counts preserving legacy capacity` — given 6 players, main=4, rem=3 (balanced), when `calculatorGroups` runs, then `numGroupsMain + numGroupsRemainder == 2` and total slots `numGroupsMain×4 + numGroupsRemainder×3 == 6` (exact, no empty slots).

### Checkpoints: spec
### Review: inline

### Production-risk notes
- None beyond relocation integrity. R6 deletes the legacy `calculator/draw.ts` and `calculator/groups.ts`; this slice updates `TournamentView.vue`, `TournamentDraw.vue`, `CategoryCard.vue` to import from `features/draw/domain` so the deletion is safe.

---

## Requirement 1: Tournament config UI

Relocate `components/TournamentInfo.vue` → `features/tournament-config/ui/TournamentInfo.vue`. Editable fields: tournament **name**, **number of tables**, **start time**.

### Acceptance criteria
- Given a stored tournament, when `TournamentInfo` mounts, then the name, tables, and start-time inputs display the current values.
- Given `TournamentInfo` mounted, when the user edits name/tables/start time, then the reactive store updates immediately and `saveTournamentDocument` is invoked (autosave through the slice-0 doc store).
- `TournamentView.vue` imports `TournamentInfo` from `features/tournament-config/ui/`.

### Integration tests
- `should render current tournament name, tables, and start time` — given a tournament in the document store, when `TournamentInfo` is mounted, then the inputs show the stored values.
- `should update the model and persist on edit` — given `TournamentInfo` mounted, when the user edits the name, then the store's `tournament.value.name` reflects the change and `saveTournamentDocument` was called.

### Checkpoints: spec
### Review: inline

### Production-risk notes
- Pure relocation; persistence is handled by the existing slice-0 doc store (no new write path).

---

## Requirement 2: Category config UI

Relocate `components/CategoryCard.vue` → `features/tournament-config/ui/CategoryCard.vue`. Editable fields: **entry type**, **group sizing** (main/remainder), **duration minutes**, **qualifiers per group**, **team min/max players**.

### Acceptance criteria
- Given a category, when `CategoryCard` mounts, then entry type, group-sizing, duration, qualifiers, and (for Team) min/max players display current values.
- Given a category with a loaded CSV/JSON file, when the user imports entries, then `players-imported` emits an array of `Entry` instances (factory remains permissive; `validateEntry` runs only at the `parse`/ingestion boundary per `docs/lessons.md`).
- Given a category, when entries count changes, then groups are repopulated via `calculatorGroups` and existing rounds are cleared (`clearGroup`).
- `TournamentView.vue` and `TournamentDraw.vue` import `calculatorGroups`/`getGroup` from `features/draw/domain/groups`.

### Integration tests
- `should render category config fields` — given a category, when `CategoryCard` is mounted, then entry type, group sizes, duration, and qualifiers show the category's values.
- `should emit rehydrated Entry instances on players-imported` — given a pasted CSV/JSON, when import completes, then the emitted array items are `instanceof Entry` (pair `toEqual` with `toBeInstanceOf(Entry)` per `docs/lessons.md`).
- `should recompute groups when player count changes` — given a category, when entries grow/shrink, then `clearGroup` repopulates the right number of groups (via `calculatorGroups`) and clears rounds.

### Checkpoints: spec
### Review: inline

### Production-risk notes
- Relocation only. Confirms the permissive-factory-vs-strict-`parse` lesson is respected (no strict validation added to `Entry.from` here).

---

## Requirement 5: Matches views + orchestration wiring

Relocate `GroupsTab.vue`, `GroupMatchesTab.vue`, `KnockoutMatchesTab.vue` → `features/matches/ui/` and wire `TournamentView.vue` to the local generator (depends on R4 being in place).

### Acceptance criteria
- Given a category with rounds and knockout rounds populated by `generateRoundsForTournament`, when `GroupsTab`/`GroupMatchesTab`/`KnockoutMatchesTab` render, then group round-robin matches and the knockout bracket display (round numbers descend 32→16→8→4→2; empty slots render as placeholders).
- Given `TournamentView.vue`, when a draw completes (`drawDone`), then `generateRoundsForTournament(tournament.value)` is called **synchronously** (no `await`, no `apiGenerateRounds` fetch), and the resulting tournament has populated `groups[].rounds` and `knockoutRounds`.
- `apiGenerateRounds` is no longer imported by `TournamentView.vue`; it is removed from `client.ts` in R6.
- Given a category lacking enough qualifiers, when generation runs, then the UI surfaces the thrown error message and the document is left unchanged.

### Integration tests
- `should render group round-robin matches for a drawn category` — given a category whose groups have rounds (seeded by `generateRoundsForTournament`), when `GroupMatchesTab` is mounted, then each match row shows two entry names and the match duration.
- `should render the knockout bracket with descending rounds` — given knockout rounds produced by `generateKnockoutRounds`, when `KnockoutMatchesTab` is mounted, then rounds render in order 8→4→2 (or 32→…→2) with empty-slot placeholders for `EntryEmptyIdx` matches.
- `should generate rounds locally on draw completion and not call the server` — given `TournamentView` with a completed draw, when `drawDone` resolves, then `generateRoundsForTournament` was called, the tournament has non-empty rounds + knockoutRounds, and `fetch('/api/generateRounds')` was **not** invoked (fetch mocked; assert no call).
- `should surface a generation error and leave the document unchanged` — given a category with insufficient qualifiers, when `drawDone` runs, then an alert shows the error message and `tournament.value` is unchanged.

### Checkpoints: full
### Review: parallel

### Production-risk notes
- This is the end-to-end wiring slice; the behavioral surface (sync vs `await`, error surfacing, leaving the doc unchanged on failure) justifies a `full` checkpoint and `parallel` (four-reviewer) review.

---

## Requirement 6: Structural cleanup (legacy paths)

Remove the relocated code from the legacy `calculator/`, `components/`, and `views/` paths and delete the now-unused client function, gated by a no-remaining-import check.

### Acceptance criteria
- Given R1–R5 complete, when the cleanup runs, then these files are deleted:
  - `web/src/calculator/draw.ts`, `web/src/calculator/groups.ts`
  - `web/src/components/{TournamentInfo,CategoryCard,TournamentDraw,PlayersChooser,GroupsTab,GroupMatchesTab,KnockoutMatchesTab}.vue`
  - the `apiGenerateRounds` export is removed from `web/src/client/client.ts`
- No source under `web/src` imports the deleted symbols: `grep -rn "calculator/draw\|calculator/groups\|apiGenerateRounds"` returns empty across `.ts`/`.vue`, and none of the 9 deleted files exist.

### Integration tests
- `should have no remaining imports of relocated legacy paths` — given the tree after R1–R5, when grepping `src` for `calculator/draw`, `calculator/groups`, and `apiGenerateRounds`, then zero matches are found and the relocated modules load from `features/*`.

### Checkpoints: none
### Review: skip

### Production-risk notes
- Pure deletion; zero behavioral surface. The hard gate is the grep above — if any relocation missed an import, the build (and this check) fails, so this is safe to run at `none`/`skip`.

---

## Feature acceptance

- `should configure, draw, and generate a full local schedule with no server involvement` — Given `testdata/tournament.json` (or a synthetic tournament carrying the Go golden group inputs in its categories), when the user loads config, draws entries into groups, and `drawDone` completes, then every category has complete round-robin `groups[].rounds` and a `knockoutRounds` bracket identical to the Go `generateRounds` output, and no HTTP request to `/api/generateRounds` was made (fetch mocked).

## Notes on test philosophy (from `docs/lessons.md`)
- Golden expecteds for the port are copied **verbatim** from `generate_rounds_test.go` (independent of the TS implementation — never a self round-trip).
- Component assertions pair `toEqual` (deep field check) with `toBeInstanceOf` for class identity.
- `Entry.from` stays permissive; strict validation lives only at `parse`/`rehydrate` ingestion boundaries.
