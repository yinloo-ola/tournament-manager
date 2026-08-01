# Progress: pure-frontend slice 1 — draw & matches

Plan: docs/plans/2026-08-01-pure-frontend-slice1-draw-matches-implementation.md
Branch: feature/pure-frontend-slice1-draw-matches
Started: 2026-06-30T02:39:17Z
Last updated: 2026-06-30T11:08:30Z
setup: n/a (no ## Setup section; baseline suite green: 50/50)

Requirements run in **plan (build) order**:

| # | Status | Requirement | Checkpoints | Review |
|---|--------|-------------|-------------|--------|
| 1 | done | Port generateRounds to TypeScript | spec | inline |
| 2 | done | Draw feature (domain + UI relocation) | spec | inline |
| 3 | done | Tournament config UI relocation | spec | inline |
| 4 | done | Category config UI relocation | spec | inline |
| 5 | in-progress | Matches views + orchestration wiring | full | parallel |
| 6 | pending | Structural cleanup (legacy paths) | none | skip |

R1 done: 27 golden tests; full 77/77; vue-tsc clean; inline review passed (1 low: top-level knockout error unwrapped by design).
R2 done: 3 regression tests; full 80/80; vue-tsc clean; inline review passed (pure relocation, no behavior change).
R3 done: 2 component tests; full 82/82; vue-tsc clean; inline review passed (TournamentInfo relocated, v-model property-path contract locked).
R4 done: 3 component tests; full 85/85; vue-tsc clean. Inline review running.
R5 (in progress): matches views relocation + apiGenerateRounds -> generateRoundsForTournament wiring in TournamentView.
R6 pending: delete legacy calculator/{draw,groups}.ts, components/TournamentInfo|CategoryCard|TournamentDraw|PlayersChooser.vue (and GroupsTab/GroupMatchesTab/KnockoutMatchesTab after R5), remove apiGenerateRounds from client.ts.
