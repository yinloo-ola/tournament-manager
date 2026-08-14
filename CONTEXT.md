# Tournament Manager — Lineup Submission

The team-lineup-submission extension to Tournament Manager: team managers log
in, pick players from their roster for each game of a team fixture, and submit
a lineup before a cutoff. An administrator can fill in or overwrite any lineup.

## Language

**Tie**:
One team-versus-team fixture in a Team category (e.g. *Team A vs Team B*). Corresponds to a team `Match` produced by the scheduler.
_Avoid_: team match, fixture, team game

**Rubber**:
A single game inside a Tie. A singles rubber fields one player per side; a doubles rubber fields two. A Tie is an ordered list of Rubbers.
_Avoid_: game, match, sub-match, individual match

**Tie Format**:
The template attached to a Team category — an ordered list of Rubbers, each with its format (singles/doubles) and eligibility Constraint. Every Tie in the category is expanded from this format.
_Avoid_: rubbers list, category template, tie template

**Constraint**:
The eligibility rule on a Rubber, decomposed into two independent parts: a per-player eligibility test (allowed genders + inclusive age bounds, evaluated as of a reference date) and — for doubles only — a Pair Rule. Composing the two covers every case from Men's Singles to Veteran Mixed Doubles.
_Avoid_: rule, filter, restriction, condition

**Pair Rule**:
The doubles-only part of a Constraint: how two already-eligible players may combine — any, same-gender, or mixed (one of each). Singles Rubbers have no Pair Rule.
_Avoid_: pairing rule, combination rule

**Lineup**:
One team's assignment of roster players to each Rubber of a specific Tie.
_Avoid_: selection, picks, assignment, roster

**Submission**:
A team committing a Lineup for a Tie before the Submission Cutoff.
_Avoid_: entry, lodgement, filing

**Team Manager**:
The person who logs in to submit and edit one team's lineups.
_Avoid_: captain, coach, team admin, manager (ambiguous with admin)

**Submission Cutoff**:
The deadline after which a Team Manager can no longer change a Tie's Lineup. Derived per Tie from its scheduled start minus a lead time; enforced server-side. An Administrator may still edit after the cutoff.
_Avoid_: deadline, lock time, closing time

**Administrator**:
The organizer/referee role that provisions managers, defines the team-event structure, and may fill or overwrite any Lineup — bound by the same Constraints as a Team Manager. The only role that can edit after a Submission Cutoff.
_Avoid_: admin (ambiguous with team admin), organiser, referee

_Note: this context describes a separate lineup-submission product (see docs/adr/0002-…). This glossary will relocate to that product's repository when it is created._
