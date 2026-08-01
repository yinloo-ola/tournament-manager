# Pure-Frontend Rewrite — Slice 1: Tournament Config, Draw & Matches (incl. generateRounds port)

**Status:** Brainstorm → pending plan
**Date:** 2026-08-01
**Depends on:** Slice 0 (foundation: `shared/model`, document store, feature-sliced skeleton).
**Scope:** One PR. Makes tournament configuration, the draw, round generation, and match views fully client-side; removes the app's dependency on the `generateRounds` endpoint.

---

## Requirements

1. **Tournament config** (name, number of tables, start time) is editable in-app — relocates today's `TournamentInfo.vue`.
2. **Category config** (entry type, group sizing, duration, qualifiers per group, min/max players for teams) is editable — relocates `CategoryCard.vue`.
3. **Draw** — assign entries to groups via the existing client-side algorithm (`calculator/draw.ts`, `calculator/groups.ts`) and the draw UI (`TournamentDraw.vue`, `PlayersChooser.vue`). Already client-side today; this slice relocates it into the feature structure.
4. **Generate rounds (port).** Port `endpoint/schedule/internal/generate_rounds.go` to TypeScript: group round-robin scheduling (circle method with bye handling) **and** knockout-bracket construction, producing the same `category.groups[].rounds` and `category.knockoutRounds` the Go endpoint returns today. This replaces the `apiGenerateRounds` fetch.
5. **Matches views** — display group round-robin matches and the knockout bracket (relocates `GroupsTab.vue`, `GroupMatchesTab.vue`, `KnockoutMatchesTab.vue`), driven entirely by locally-generated data.
6. All of the above live under feature-sliced folders (`features/tournament-config/`, `features/draw/`, `features/matches/`); no code remains in the legacy `calculator/`, `components/`, `views/` paths for these features.

---

## Problem

Today the "draw + matches" feature is split-brain: the **draw** (assigning players to groups) runs in the browser (`draw.ts`), but **round generation** (the matches *within* groups and the knockout bracket) is a server call (`POST /api/generateRounds`). That forces a network round-trip for pure computation and is one of the FE/BE split-brain cases the rewrite dissolves. The generation logic is pure (no I/O, no Excel), so it ports to TS directly.

---

## Approaches considered

- **Relocate + port into feature slices (chosen).** Move the existing client-side logic into `features/*` and port the one Go algorithm (`generate_rounds.go`) alongside. One coherent PR; the only new logic is the algorithm port.
- **Port first, relocate later.** Keep current folder layout, just swap the `apiGenerateRounds` call for a local function, defer the feature-slice reorg. Rejected — does half the job and leaves the jumble this rewrite exists to fix.
- **Feature-slice everything in slice 0.** Rejected — slice 0 is intentionally scoped to the document/storage foundation; feature relocation belongs here.

---

## Architecture

```
features/
  tournament-config/   ui/ (TournamentInfo, CategoryCard)   — relocated
  draw/                domain/ (draw.ts, groups.ts) + ui/ (TournamentDraw, PlayersChooser) — relocated
  matches/             domain/ (generateRounds.ts)          — PORTED from Go
                       ui/ (GroupsTab, GroupMatchesTab, KnockoutMatchesTab) — relocated
```

`features/matches/domain/generateRounds.ts` is the single new module. The orchestration in `TournamentView.vue` changes from `await apiGenerateRounds(tournament)` to a synchronous local call `generateRoundsForTournament(tournament)` returning the same shape.

---

## Components

- **`generateRounds.ts` (port of `generate_rounds.go`):**
  - `generateRoundsForTournament(tournament)` — top-level; for each category generates group rounds then knockout rounds.
  - `generateGroupRounds(entriesIdx, duration)` — circle method: even-player rotation with the "bouncing" boundary reflection; odd player count → append a bye (`EntryByeIdx`); validates round consistency; swaps a specific round to the end.
  - `getRoundPlayersIndices(round, numPlayers)` — the core index rotation (the well-commented bouncing algorithm — port verbatim, it is subtle).
  - `generateKnockoutRounds(groups, numQualified)` — `nextPowerOfTwo`, byes, bracket of empty (`EntryEmptyIdx`) matches down to the final.
  - **Dead-code drop:** the Go file also contains `getRoundPlayersIndicesWithRotation`, `generateSlice`, `rotateInPlace`, `reverse` — these are not on the active path (the bouncing `getRoundPlayersIndices` is). Drop them; do not port.
- **Behavior parity note:** Go `panic`s on invalid round generation; in TS this becomes a thrown `Error` caught by the UI.

---

## Data flow

Configure tournament/category → draw entries into groups (client-side, existing) → `generateRoundsForTournament(tournament)` populates `groups[].rounds` and `knockoutRounds` locally → matches views render. **No server, no fetch.** Result is persisted via the slice-0 document store/autosave.

---

## Error handling

- Invalid group sizing or insufficient qualifiers → thrown error with the same messages Go emits ("not enough players", "number of rounds for group N is not equal"); UI shows the message and leaves the document unchanged.
- Round-generation internal inconsistency (the Go `panic` path) → thrown error surfaced as "could not generate matches for this category."

---

## Testing

- **`generateRounds` oracle test (primary):** the existing Go test `generate_rounds_test.go` (530 lines) is a ready-made golden-value oracle. Port a representative subset: given identical `entriesIdx` inputs, assert the TS `[][]Match` (entry indices + duration) equals the Go output exactly. Cover even/odd player counts and several group sizes.
- **Draw/groups unit tests:** existing logic; assert draw determinism is preserved (or unchanged randomness behavior) and group-sizing math matches.
- **Integration:** configure → draw → generateRounds → assert the resulting tournament JSON equals the Go endpoint's response for the same input tournament (using `testdata/tournament.json` as a fixture).

---

## Production-risk areas

- **Low.** This is pure logic plus relocation — no Excel, no persistence, no concurrency.
- The one subtlety is the circle-method rotation; it is fully covered by golden-value tests drawn from the existing Go test data, so drift is caught mechanically.

---

## Feature acceptance

- **Given** a configured category with entries and a completed draw, **when** round generation runs, **then** every group has a complete round-robin match schedule and a knockout bracket is produced — identical to the current Go `generateRounds` output — with no server involved.

---

## Out of scope

- Entry import (slice 2), schedule generation/Excel (slice 3), chart/scoresheet Excel (slice 4), Go removal (slice 5).
