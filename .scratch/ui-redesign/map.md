# Map: UI/UX Redesign — Material 3

Labels: `wayfinder:map`

## Destination

A Material 3 redesign of the Tournament Manager SPA — covering both the visual system (color, typography, spacing, elevation, components) and the information architecture (how a user moves between setup → draw → matches → schedule). Built directly in the Vue 3 + UnoCSS codebase, seeded from a sport-competition blue, hand-rolled (no component library). Navigation pattern decided as a dedicated upfront decision. All current features preserved; this is a restyle + restructure, not a feature rebuild.

## Notes

- **Design language**: Material 3 (M3). Surfaces are tonal, color grows from a seed, components follow M3 specs (filled/outline/text buttons, proper elevation, FABs, navigation rail/app-bar patterns). Reference: m3.material.io.
- **Seed color**: sport-competition blue (#1A56DB direction) — authoritative, scoreboard-adjacent, high contrast on white. The exact seed is finalized in the design-system ticket, but the family is blue, not green.
- **Build approach**: hand-rolled UnoCSS widgets + a design-token layer. No PrimeVue / Naive UI / Vuetify / Radix. Accessibility patterns (focus, dialog, menu) are implemented by us.
- **Process**: build directly in code (not static mockups) — except the navigation pattern, which gets its own prototype/grilling ticket first.
- **Single model unchanged**: `web/src/shared/model/index.ts` is the domain truth. The redesign touches only presentation + routing/IA, never the model or feature domain logic.
- **Skills every session consults**: `/grilling`, `/domain-modeling` for IA decisions; `/prototype` only for the navigation exploration.
- **What we're NOT doing**: no new features (in-app scoring, etc.), no backend, no fetch, no changing the Excel/domain logic. Scope is presentation + navigation. `alert()`-to-toast replacement is in scope (it's a UX/feedback-system change, not a feature).

## Decisions so far

- [01 Navigation pattern](issues/01-navigation-pattern.md) — **Single top app bar shell, no nav rail.** Home becomes the empty-state launcher of the one shell (not a route). `Save` is a prominent filled button; the other 5 document actions (Load + 4 exports/imports) collapse into one `Document ▾` menu. A leading ← back button appears only when drilled into a category. Interactive prototype at `prototypes/nav-shell.html`.
- [02 Design system foundation](issues/02-design-system-foundation.md) — **Token layer shipped: `web/src/styles/tokens.css` + UnoCSS theme extension.** Seed `#1A56DB`. All colors are CSS variables bound through `theme.colors` so utilities like `bg-primary`, `text-on-surface-variant`, `border-outline-variant` resolve to M3 vars. M3 typography/elevation/shape/motion tokens defined. Dark-mode-ready via vars (not shipped). Naming is pure M3 semantic (no aliases). Verified: type-check + build + 235/235 tests pass.
- [03 Widget primitives restyled](issues/03-widget-primitives-restyled.md) — **All 9 widgets restyled to M3.** Buttons gained `variant`/`tone` props (filled/tonal/text; outlined primary/error) so callers stop hardcoding colors — the root cause of the drift. Inputs/selects use M3 text-field tokens with the working floating-label mechanics preserved. ModalDialog got a real focus trap + scrim + canonical motion. DropdownMenu/MenuItem/GridTable tokenized (killed literal `#ccc` + `lightblue`). 6 call sites migrated. Verified: type-check + build + 235/235 tests + live browser check.
- [04 Home screen redesign](issues/04-home-screen-redesign.md) — **Home redesigned as the M3 launcher (empty state of the single shell).** App bar with brand only; hero + Import/Create CTAs; recents with an empty state (was previously hidden) + hover-to-remove + relative timestamps + downloaded-source indicator. **Fixed a pre-existing router bug**: no `/` route existed, so Home was never reachable — added `/` → HomeView + catch-all redirect. Verified: type-check + build + 235/235 tests + live browser check.
- [05 Tournament setup screen redesign](issues/05-tournament-setup-screen.md) — **Setup screen redesigned inside the app-bar shell; the 6 buried hamburger actions are now surfaced — the core IA win.** `Save` is a prominent filled button; the other 5 actions live in a labeled `Document ▾` menu. CategoryCard gained a lifecycle status chip (no entries / draw pending / draw done) for at-a-glance progress, plus an empty state. Category-adding moved to a dedicated tonal button. All source-grep + component-wiring test contracts preserved. Verified: type-check + build + 235/235 tests + live browser check.
- [06 Matches screen redesign](issues/06-matches-screen-redesign.md) — **Matches screen redesigned in the app-bar shell with M3 tabs.** GroupMatchesTab + GroupsTab restyled to M3 data tables (killed all lime/gray). KnockoutMatchesTab gained a **visual bracket layer** — rounds as columns of match cards with human-readable round names (Quarter-finals/Semi-finals/Final) + bye/empty handling — above the M3 data table that satisfies the `tbody tr` test contract. All three tabs got empty states. Tab contracts preserved. Verified: type-check + build + 235/235 tests + live browser check.
- [07 Snackbar/toast system](issues/07-snackbar-toast-system.md) — **M3 snackbar shipped; all 25 `alert()` calls eliminated.** `useToast` composable (module singleton) + `SnackbarHost` widget (M3 spec: inverse-surface, elevation-3, 4s auto-dismiss, one-at-a-time, action button, slide-up motion). Migrated every call site across 4 files to non-blocking toasts with info/success/error tones. **Bonus**: fixed a layering violation — `schedule.ts` (domain) was calling `alert()` directly; now returns false and the caller toasts. 3 tests updated to assert `toast.error` instead of `alert`. Verified: type-check + build + 235/235 tests + zero-alert grep audit + host mounted in live DOM.
- [08 Motion language](issues/08-motion-language.md) — **M3 restraint locked; full `prefers-reduced-motion` support added.** No new motion — the existing dialog/menu/snackbar enter-exit + hover/press micro-feedback is the complete vocabulary (deliberately no route fades, tab transitions, or list staggers). Added the missing accessibility baseline: a single `@media (prefers-reduced-motion: reduce)` block in `tokens.css` collapses all `--md-duration-*` vars to ~0ms (cascading to every scoped style + UnoCSS utility) plus a global `*` neutralization rule. Documented the motion language in the token file. Verified: type-check + build + 235/235 tests + built-CSS audit confirms the media query ships.

## Not yet specified

**The destination is reached — all 8 tickets resolved. The fog below is genuine residual work outside this effort's scope, recorded for a future effort:**

- **Loading states for slow Excel import/export** — empty states shipped on all screens (04/05/06); error feedback shipped via snackbar (07). The remaining gap is *progress* indication during slow Excel read/write (skeletons vs. spinners). Small; waits on a need.
- **Responsive strategy** — the redesign uses responsive grids throughout; the app is genuinely desktop-first (dense tables, brackets). Whether to support tablet/narrow is a real decision for a future effort.
- **Accessibility depth** — focus trap shipped (03), reduced-motion shipped (08). Remaining: keyboard nav for the drag-drop `GridTable`, screen-reader semantics for the bracket. Genuine WCAG-AA gaps for a future a11y effort.
- **Dark mode** — the token layer is var-based and dark-ready (02); the work is authoring the dark `:root` values. Explicitly deferred — would be a fresh effort.

*(Toast/snackbar and motion-language fog graduated to tickets 07 and 08 once the design system landed.)*

*(App-shell chrome fog cleared by decision 01 — one top app bar, no rail.)*

## Out of scope

<!-- empty — nothing ruled out yet beyond the implicit destination boundary -->
