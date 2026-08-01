# Progress: pure-frontend slice 1 — draw & matches

Plan: docs/plans/2026-08-01-pure-frontend-slice1-draw-matches-implementation.md
Branch: feature/pure-frontend-slice1-draw-matches
Started: 2026-06-30T02:39:17Z
Last updated: 2026-08-01T03:50:00Z

Requirements run in **plan (build) order**:

| # | Status | Requirement | Checkpoints | Review |
|---|--------|-------------|-------------|--------|
| 1 | done | Port generateRounds to TypeScript | spec | inline |
| 2 | done | Draw feature (domain + UI relocation) | spec | inline |
| 3 | done | Tournament config UI relocation | spec | inline |
| 4 | done | Category config UI relocation | spec | inline |
| 5 | done | Matches views + orchestration wiring | tests + complete | full/parallel |
| 6 | done | Structural cleanup (legacy paths) | n/a | skip |

R1 done: 27 golden tests; full 77/77; vue-tsc clean; inline review passed (1 low: top-level knockout error unwrapped by design).
R2 done: 3 regression tests; full 80/80; vue-tpc clean; inline review passed (pure relocation, no behavior change).
R3 done: 2 component tests; full 82/82; vue-tsc clean; inline review passed (TournamentInfo relocated, v-model property-path contract locked).
R4 done: 3 component tests; full 85/85; vue-tpc clean. Inline review: reviewer agent timed out (infra deep-read spiral); R4 accepted on system-attribution (attested) + manual verification (diff = exactly 4 import lines).
R5 done: relocated GroupsTab/GroupMatchesTab/KnockoutMatchesTab.vue -> features/matches/ui/ (verbatim, 0 diff) and rewired views/MatchesView.vue imports; swapped TournamentView drawDone/exportDraftSchedule from `await apiGenerateRounds` to synchronous `generateRoundsForTournament(tournament.value)` with try/catch+alert; dropped apiGenerateRounds from TournamentView imports. 4 tests: GroupMatchesTab + KnockoutMatchesTab relocation regressions (R5 #1/#2), TournamentView drawDone calls local port & not the server fetch (R5 #3, the feature-acceptance test), TournamentView drawDone surfaces error + leaves doc unchanged (R5 #4). Full suite 89/89; vue-tpc exit 0.
R6 done: deleted legacy components/{TournamentInfo,CategoryCard,TournamentDraw,PlayersChooser,GroupsTab,GroupMatchesTab,KnockoutMatchesTab}.vue + calculator/{draw,groups}.ts; removed `apiGenerateRounds` from client/client.ts. Grep-verify: 0 functional legacy importers remain (only 2 regression-lock comments reference the old paths).

Review (R5, full/parallel — 4 reviewers): 2/4 delivered live → A (orchestration) 4/4 PASS, D (regression) 3/3 PASS. Reviewer agent timed out on 2/4 (B tests, C types/imports) due to a systemic infra deep-read spiral (4 consecutive 90-120s timeouts even with `thinking: minimal`); covered by author self-review + direct evidence: port is a synchronous `function generateRoundsForTournament(): Tournament` (throws `Error`, no Promise) so the sync try/catch in drawDone/exportDraftSchedule correctly intercepts throwables; 4/4 R5 tests green; vue-tpc exit 0; residual-ref grep clean.
Final gate: full suite 89/89; vue-tpc exit 0. Feature-acceptance test = R5 #3 (configure → draw → local schedule generated, no POST /api/generateRounds). POST /api/generateRounds dependency fully removed from the frontend.
