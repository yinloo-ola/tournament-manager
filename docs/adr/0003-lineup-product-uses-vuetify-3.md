# Lineup product frontend uses Vuetify 3

_To be relocated to the lineup-submission product's own repository once created._

The lineup-submission product's frontend will be built with **Vue 3 + Vuetify
3** rather than the hand-rolled Material 3 widget set used by tournament-manager.
The lineup product is a separate, manager-facing app whose UI is dominated by
auth screens, forms, and data tables with live validation feedback — exactly
where a component library pays off most. Vuetify 3 was chosen because it is the
most popular Vue 3 library, it is Material (loose visual kinship with
tournament-manager's M3 language, so the team's existing Material vocabulary
transfers), and it ships batteries-included data tables, forms, and validation.

## Why not hand-rolled (like tournament-manager)

tournament-manager deliberately avoids a component library because its
organizer-facing UI is bespoke and document-centric. That rationale does not
carry to the lineup product: re-hand-rolling tables/forms/auth would be slow
with little payoff for a CRUD-style manager portal. The trade-off accepted here
is a heavier bundle and less pixel-level control — the right trade for this
product. Considered alternatives: PrimeVue (stronger data tables, less
Material), Naive UI (lighter, smaller community).
