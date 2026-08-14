# Lineup submission is a separate product; Supabase is its source of truth

The team-lineup-submission feature will be built as a **separate, standalone
system in its own repository** — its own Vue/TypeScript frontend plus a
**Supabase** backend (Postgres + Auth + RLS) — rather than as a feature slice
inside this tournament-manager repo. This repo (tournament-manager) stays the
pure-frontend, local-`.json`, no-backend admin tool for draw / schedule /
scoresheets, unchanged. The new system's **Supabase database is the single
source of truth** for teams, player rosters, ties, rubbers, constraints,
managers, and lineups.

## Why

Building it separate honors the user's "as standalone as possible" goal and
keeps this repo's deliberate "no backend" stance (ADR-0001 territory) intact
for the organizer-facing tool. It also lets the lineup product evolve, deploy,
and scale (many managers hitting Supabase concurrently) independently of the
offline admin tool. The cost is some duplication of the team/player domain
model across two repos and a need to seed the new system with team-event data.

## Data handoff (decided)

The new system obtains its team-event data (teams, rosters, scheduled ties) via
a **one-time file export** from this repo, which seeds Supabase; thereafter
Supabase owns it. The two products share no code and no database — only the
file-format contract. This repo gains one new export action. Rejected
alternative: fully self-contained entry in the new system, which would
re-implement the scheduler and re-key rosters.
