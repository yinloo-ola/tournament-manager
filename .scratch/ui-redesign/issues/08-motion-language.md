# 08 — Motion / transition language

Type: `wayfinder:grilling`
Status: resolved
Blocked by: 03

## Question

Adopt M3 motion tokens consistently across the redesigned components, replacing today's ad-hoc animations.

Graduated from map fog — the tokens are already defined in `tokens.css` (`--md-duration-short/medium/long` = 200/300/450ms; `--md-easing-standard/emphasized/decelerated`), and exposed in UnoCSS theme as `ease-standard` / `duration-short` etc. The decision now is *where and how* to apply them.

Today the codebase uses scattered ad-hoc motion: `bounce-in` keyframes on `DropdownMenu` and `ModalDialog`, `fade` on the modal, `active:scale-[.97]` press affordances. No system. M3 prescribes specific durations and easings per motion type (small vs. expanding vs. full-screen; enter vs. exit differ).

Decisions this ticket resolves:

1. **Component motion inventory** — which components get motion and of what kind: dialog open/close (emphasized decelerate enter / emphasized accelerate exit), menu open/close, button press (scale), card hover, snackbar enter, route transitions. Not everything should animate; M3 is restrained.
2. **Replace `bounce-in`** — the current bouncy modal/menu animation is un-M3. M3 uses scale+fade with emphasized easing, not overshoot. Decide whether to keep any personality or go fully canonical.
3. **Reduced-motion accessibility** — `@media (prefers-reduced-motion: reduce)` should neutralize non-essential motion. Decide the contract (zero motion? instant only?).
4. **Expose as utilities** — whether motion needs more UnoCSS shortcuts (e.g. `transition-motion-short`) beyond the duration/easing tokens already in theme.

Grill the user on restraint level, then lock the motion rules. Light on implementation until components exist (→ blocked by 03), since most application is per-component during restyle.

## Answer

**Decision: M3 restraint — no new motion added; the existing motion (dialog/menu/snackbar enter-exit + hover/press micro-feedback) is the complete vocabulary. Added full `prefers-reduced-motion` support — the real work of this ticket and the biggest accessibility gap.**

### 1. Restraint level — locked: restrained, no new motion
M3's philosophy is that motion signals state change, never decorates. This is a tournament-management data tool, not a game. The motion already in place from the widget restyle (ticket 03) + snackbar (ticket 07) is exactly the right amount:
- **Dialog open/close** — scale(0.85) + fade, `emphasized` easing (ModalDialog)
- **Menu open/close** — scale(0.92) + fade, `decelerated` easing (DropdownMenu)
- **Snackbar enter** — translateY(16px) + fade, `emphasized` easing (SnackbarHost)
- **Hover/press micro-feedback** — `transition-colors`/`transition-all` with `duration-short ease-standard`; press `active:scale-[.97]` on buttons

**Deliberately NOT added:** route fades (Home↔Setup↔Matches), tab-switch transitions, list/grid stagger animations, bracket build-up. All would be decoration without earning their keep in a data tool.

### 2. `bounce-in` removal — already done
The ad-hoc `bounce-in` keyframes (overshoot animation) were removed in tickets 03/05 when ModalDialog and DropdownMenu were restyled to canonical M3 scale+fade motion. No `bounce-in` remains in the codebase.

### 3. Reduced-motion accessibility — ADDED (the real work)
The biggest gap: zero `prefers-reduced-motion` support existed. Now shipped in `tokens.css`:

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --md-duration-short: 0.01ms;   /* cascades to every var(--md-duration-*) */
    --md-duration-medium: 0.01ms;  /* reference — dialogs, menus, snackbars */
    --md-duration-long: 0.01ms;
  }
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Why this works as one block:** every transition in the app references the `--md-duration-*` vars (scoped `<style>` in ModalDialog/DropdownMenu/SnackbarHost) or UnoCSS `duration-*`/`transition-*` utilities (buttons, cards, inputs). Collapsing the duration vars cascades automatically; the global `*` rule catches the rest (press-scale, hover color shifts, `active:scale-[.97]`). State still changes — the dialog still opens, the snackbar still appears — just without movement. This is the M3 accessibility baseline.

**Contract:** under reduced motion, ALL non-essential motion is neutralized. Essential state changes still happen instantly. No half-measures (no "shorten but don't eliminate").

### 4. Utilities — no new shortcuts needed
The existing UnoCSS theme bindings (`duration-short`/`ease-standard` etc. from ticket 02) plus direct `var(--md-duration-*)` references in scoped styles are sufficient. No `transition-motion-short` composite utility is warranted — it would obscure rather than clarify.

### Documentation
Added a motion-language comment block to the `:root` tokens in `tokens.css` documenting the vocabulary (short/medium/long durations + when to use each), the restraint principle, and the reduced-motion contract — so future contributors follow the rules without re-deriving them.

### Verification
- `npm run type-check` — clean.
- `npm run build` — clean (1.96s).
- `npm run test:run` — **235/235 pass**.
- **Built CSS audit**: the `@media (prefers-reduced-motion: reduce)` block ships correctly — `:root` duration overrides + the global `*` neutralization rule (`animation-duration:.01ms!important`, `transition-duration:.01ms!important`) both present in the minified output. The 4 scoped `var(--md-duration-short)` references cascade to `.01ms` under the media query.

### What this does NOT decide
- Nothing — this was the last ticket on the map. The redesign's motion language is locked.
