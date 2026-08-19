# Knockout participant resolution lives in lineup-manager, not here

tournament-manager will gain **no participant-resolution capability** for its
knockout brackets: no assignment UI, no group standings, no results entry. KO
brackets stay what they are today — a purely geometric, participant-less
structure that generation builds and the scheduler places onto tables and
times. Resolving who occupies each KO slot happens in the **lineup system**
(lineup-manager), where the administrator enters the first knockout round's
teams and then selects match winners (a lone team advances directly), so
each later round's slots fill by propagation. lineup-manager is also the
declared future home for results management, of which this is the first
step.

## Why

Bracket participants only matter downstream — for lineup submission — and
lineup-manager already owns teams, ties, and everything managers see.
Building resolution here would duplicate that (an assignment UI over the
same teams, plus an update path to push changes across the seed contract)
for a workflow the organizer performs once per round. Staying results-free
also preserves this repo's pure-frontend, no-backend stance (ADR-0001) and
the one-way file handoff (ADR-0002). The cost: this app's KO display stays
"—" until the tournament is over, and the seed contract must carry a stable
bracket-slot identity so lineup-manager can name the slots it fills.

## Consequences

- The lineup seed export (contract v2, specced from lineup-manager's
  `.scratch/ko-import/` wayfinder map) exports unresolved KO ties with a
  stable bracket-position identity — category + round + match position —
  never teams+time (which change as slots resolve). The seed is one-shot:
  exported after the final schedule, with no re-import/update path. It also
  carries feed structure — which match's winner fills which next-round slot
  — since propagation happens in lineup-manager.
- The existing hazard where re-generating rounds resets KO entry
  assignments (`generateRoundsForTournament` runs on every draw-modal close
  and draft re-export) is moot: nothing is ever assigned here.
- "A1 feeds QF1"-style slot-source conventions stay on paper; no data
  surface for them will be added.
