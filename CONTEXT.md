# Tournament Manager

## Language

Cross-product vocabulary — **Tournament, Team, Player, Team Event, Team Match, Match, Game, Team Match Format, Lineup, Team Manager, Administrator** — is defined authoritatively in [`../lineup-manager/CONTEXT.md`](../lineup-manager/CONTEXT.md). Use those terms as-is wherever the concepts coincide: in code comments, docs, and on-screen copy.

This supersedes the Tie/Rubber vocabulary this file once carried: a Tie is a **Team Match**, a Rubber is a **Match**, a Tie Format is a **Team Match Format**.

Terms unique to this app crystallise below as they resolve:

**Entry**:
A player, doubles pair, or team registered to compete in one category of a tournament. Entries arrive by uploading a filled Entry Template.
_Avoid_: registration, signup, participant

**Entry Type**:
Which kind of Entry a category holds — Singles, Doubles, or Team. Fixes which Entry Template and importer apply.
_Avoid_: event type, discipline

**Entry Template**:
The blank workbook an organizer downloads for an event type, fills in, and uploads to import a category's entries. Never a format of play — lineup-manager's Team Match Format is a different concept, and is itself never called a template.
_Avoid_: entry form, sample file, import sheet

**Manager Email**:
The Team Manager's address carried by a Team entry — required in the Team Entry Template, one per team, and never shared by two teams in a tournament: it becomes that manager's login in the lineup system.
_Avoid_: contact email, manager contact
