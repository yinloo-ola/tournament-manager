# Progress: pure-frontend slice 1 — draw & matches

Plan: docs/plans/2026-08-01-pure-frontend-slice1-draw-matches-implementation.md
Branch: feature/pure-frontend-slice1-draw-matches
Started: 2026-06-30T02:39:17Z
Last updated: 2026-06-30T02:54:00Z
setup: n/a (no ## Setup section; baseline suite green: 50/50)

Requirements run in **plan (build) order** — not in design-number order:

| # | Status | Requirement | Checkpoints | Review |
|---|--------|-------------|-------------|--------|
| 1 | ✅ done | Port `generateRounds` to TypeScript | spec | inline |
| 2 | 🔄 in-progress | Draw feature (domain + UI relocation) | spec | inline |
| 3 | ⬜ pending | Tournament config UI relocation | spec | inline |
| 4 | ⬜ pending | Category config UI relocation | spec | inline |
| 5 | ⬜ pending | Matches views + orchestration wiring | full | parallel |
| 6 | ⬜ pending | Structural cleanup (legacy paths) | none | skip |

R1 notes: 27 golden tests pass; full suite 77/77; vue-tsc clean; inline review passed (3 low/trace notes: top-level knockout error unwrapped — by design, matches named messages; in-place mutation — safe under Vue3 reactivity; datetime/table placeholders — filled by slice 3). Lesson added to docs/lessons.md ("Go → TypeScript ports" section).
