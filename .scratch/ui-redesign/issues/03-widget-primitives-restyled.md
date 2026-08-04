# 03 — Widget primitives restyled to M3

Type: `wayfinder:task`
Status: resolved
Blocked by: 02

## Question

Restyle the existing widget primitives in `web/src/widgets/` to Material 3 specs, consuming the token layer from #02. These are the building blocks every screen uses, so they must be done (and consistent) before screen-level restyles.

The current widgets and their M3 targets:

- `OutlinedButton.vue` / `SimpleButton.vue` → M3 **Filled / Outlined / Text / Tonal** button variants (today there's drift: `bg-blue-600` in TournamentInfo, `lime-600`/`lime-800` in HomeView). Unify into a coherent button API.
- `OutlinedInput.vue` / `LabeledInput.vue` / `LabeledSelect.vue` → M3 **Filled / Outlined text field** with proper label, focus state, error state. Today's focus/error states are thin.
- `ModalDialog.vue` → M3 **dialog** (basic / full-screen) with proper focus trap, scrim, entrance/exit motion. Today's is functional but not M3-spec.
- `DropdownMenu.vue` → M3 **menu** with proper elevation, dividers, and click-outside (already partly there).
- `MenuItem.vue` → M3 menu item states.
- `GridTable.vue` → the hardest one: it uses literal `lightblue` selection and raw `<style scoped>`. Decide its M3 treatment (selection color from token, drag affordance) — and whether it should stay a bespoke widget or become a more general M3-styled table.
- New: **Snackbar/Toast** host (M3 snackbar) — needed to replace `alert()` across the app. This may spin into its own fog-graduated ticket; note it here.

Decide the per-widget M3 mapping, implement against tokens (no hardcoded colors), and keep the existing component API where possible to minimize churn in screen files. This is a `task` ticket — the decisions (which variant per widget) are small and local; the work is the doing.

## Answer

**Decision: all 9 widget primitives restyled to M3 specs consuming the token layer (02), and the 6 button call sites migrated off hardcoded colors. The root cause of the color drift — callers stuffing colors via `class` — is fixed by making the M3 variant a prop.**

### Per-widget M3 mapping

| Widget | M3 treatment | Key change |
|--------|-------------|------------|
| `SimpleButton` | M3 **filled / tonal / text** via new `variant` prop (default filled) | Callers no longer pass `bg-blue-600`/`bg-lime-700` — they pass `variant="filled"`. Pill shape (`rounded-full`), `h-10`, `bg-primary text-on-primary`, hover/focus elevation, press scale, full disabled state. |
| `OutlinedButton` | M3 **outlined** with new `tone` prop (`primary` default / `error`) | `border-outline text-primary`; error tone for destructive. Replaces per-call-site border-color drift. |
| `OutlinedInput` | M3 **outlined text field** with floating label | Kept the working peer/scale floating-label mechanics; swapped `border-gray-500`→`border-outline`, `text-gray-900`→`text-on-surface`, `focus:border-blue-600`→`focus:border-primary`. Added the M3 focus-state padding compensation. |
| `LabeledInput` | M3 **filled text field** (underline style) | Same floating-label mechanics; tokens throughout. |
| `LabeledSelect` | M3 **filled select** (underline, matching LabeledInput) | Tokens throughout. |
| `ModalDialog` | M3 **basic dialog** | Added a real **focus trap** (capture focus on open, cycle Tab within, restore on close, Esc to close), scrim at M3 spec (`rgba(0,0,0,0.32)`), `surface-container-high` + `elevation-3` + `rounded-xl`, `role="dialog" aria-modal="true"`. Replaced the bouncy `bounce-in` with canonical M3 scale+fade (`emphasized` easing). |
| `DropdownMenu` | M3 **menu** | Kept click-outside/toggle mechanics; `surface-container` + `elevation-2` + `rounded-sm`. Replaced `bounce-in` with M3 decelerated scale-from-anchor. |
| `MenuItem` | M3 menu item | `text-on-surface`, hover `surface-container-high`, `rounded-xs`, `duration-short ease-standard`. Divider uses `outline-variant`. |
| `GridTable` | tokens in scoped CSS | Killed the literal `#ccc` → `var(--md-outline-variant)` and `lightblue` selection → `var(--md-primary-container)`. |

### Call-site migration (the drift fix)
6 buttons across 3 files dropped hardcoded colors and switched to props:
- `CategoryCard`: DO DRAW + IMPORT ENTRIES → `OutlinedButton` (default primary tone); Matches → `SimpleButton variant="filled"`. Debug `text-red-700` → `text-error`.
- `TournamentInfo`: ADD CATEGORY → `SimpleButton variant="filled"`.
- `TournamentDraw`: AUTO DRAW → `SimpleButton variant="filled"`; CLEAR DRAW → `OutlinedButton tone="error"`.

### Scope discipline (deliberately NOT done here)
Screen-level chrome (the `bg-lime-200`/`text-lime-900` headers, HomeView's `bg-lime-600` buttons, `text-red-600` error text in views) is **out of this ticket's scope** — it belongs to the screen redesign tickets (04 Home, 05 Setup, 06 Matches). The snackbar widget is ticket 07.

### Verification
- `npm run type-check` — clean.
- `npm run build` — clean (1.94s). Built CSS resolves token utilities to M3 vars: `.bg-primary{background-color:var(--md-primary)}`, `.text-on-surface-variant{color:var(--md-on-surface-variant)}`, `.border-outline`, `.bg-surface-container-high`, `.bg-primary-container`.
- `npm run test:run` — **235/235 pass**, no regressions.
- **Literal-color audit**: `grep` for `lime|blue|red|gray|<num>|#ccc|lightblue` in `widgets/` returns only comments documenting the old drift — no actual styles use literals anymore.
- **Live browser check** (dev server + in-app browser): all restyled widgets render; hamburger opens the M3 menu and all 6 items show; click-outside closes it; focusing an input floats the label with `peer-focus:text-primary`. (Screenshot capture was attempted but the image was not surfaced back in this run; DOM/behavioral evidence is corroborated and consistent. The user can visually confirm at the dev URL.)

### What this unblocks
- **04 Home, 05 Setup, 06 Matches** — all three screen tickets were blocked on 01+02+03; all three blockers are now resolved. The frontier is fully open.
- **07 Snackbar** (blocked by 03) — now unblocked.
- **08 Motion** (blocked by 03) — now unblocked.
