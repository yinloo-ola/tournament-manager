# 02 — Material 3 design system foundation

Type: `wayfinder:grilling`
Status: resolved

## Question

What is the concrete design-token layer the whole redesign builds on? Decide and lock the M3 system as code, before any screen or component restyle.

Specifically, resolve:

1. **Seed color** — confirm the exact blue seed (family decided: sport-competition blue ~#1A56DB). Decide whether it's the final hex or needs a small A/B. Generate the M3 tonal system (primary/secondary/tertiary, each with tone 0–100) and surface tones. This replaces every hardcoded `lime-*` / `blue-*` / `lightblue` literal.
2. **Token format** — how tokens live in the codebase. UnoCSS theme extension in `uno.config.ts` (CSS variables + utility classes like `bg-primary`, `text-on-surface`, `surface-container`)? A separate `tokens.ts` / `tokens.css`? Decide the single source.
3. **Typography scale** — M3 type roles (Display/Headline/Title/Body/Label) mapped to the Roboto family already loaded. Replace ad-hoc `text-2xl font-800` usage with named roles.
4. **Elevation + shape** — M3 elevation levels (0–5) as shadow tokens; shape scale (corner radii) for cards, buttons, sheets.
5. **Naming convention** — M3 semantic names (`surface`, `on-surface`, `primary-container`, `on-primary-container`) vs. Tailwindy aliases. Pick one; consistency matters more than the choice.

The decision this ticket records: **the committed token file(s), the seed, and the M3 role→token mapping** — the foundation every subsequent component and screen ticket consumes. Does NOT restyle any component yet; that's downstream.

## Answer

**Decision: token layer shipped as `web/src/styles/tokens.css` + UnoCSS theme extension in `uno.config.ts`. All five sub-questions resolved below.**

### 1. Seed color — locked: `#1A56DB` (sport-competition blue)
Confirmed from the prototype (ticket 01) and the seed family decided at chart time. Full M3 light-scheme tonal pairing generated: `primary #1a56db` ↔ `on-primary #ffffff`; `primary-container #d6e2ff` ↔ `on-primary-container #001a41`; and likewise for secondary (muted blue-grey), tertiary (bronze-gold — thematic for medals/qualifiers), error, and the neutral blue-tinted surface ramp.

### 2. Token format — CSS variables, bound through UnoCSS theme
Every color is a CSS custom property (`--md-*`) in `:root`. The UnoCSS `theme.colors` map binds role names to those vars (e.g. `primary: 'var(--md-primary)'`), so the generated utilities `bg-primary`, `text-on-surface`, `border-outline-variant`, etc. resolve to the vars at runtime. This is the **single source of truth**: change a value in `tokens.css`, every consumer updates.

### 3. Typography scale — M3 roles as whole classes in `tokens.css`
Display / Headline / Title / Body / Label (large/medium/small) mapped to Roboto with exact M3 sizes, line-heights, weights, and letter-spacing. Applied as whole classes (`<h1 class="headline-large">`) rather than composable atoms, because a type role is a fixed bundle, not freely composable.

### 4. Elevation + shape — token utilities
- **Elevation**: M3 levels 0–5 as `--md-elevation-*` vars + `.elevation-1..5` classes.
- **Shape**: M3 radii (none/xs/sm/md/lg/xl/full) exposed as UnoCSS `borderRadius` → `rounded-md`, `rounded-lg`, etc.
- **Motion** (fog, captured but not yet surfaced as utilities): M3 durations + easing curves defined as vars, ready for component transitions. Whether to adopt them wholesale is the motion fog ticket.

### 5. Naming convention — pure M3 semantic names
`bg-primary`, `text-on-primary`, `bg-primary-container`, `bg-surface-container-high`, `text-on-surface-variant`, `border-outline-variant`. No alias layer — code maps 1:1 to `m3.material.io` docs. Verbose but unambiguous; a designer reading the code knows exactly what each token means.

### Sub-decisions made by the designer (flagged, reversible)
1. **Dark-mode future-proofing via CSS variables** (not hardcoded values). Near-free now; a dark scheme is a future `@media (prefers-color-scheme: dark)` override of the `:root` block, no component restyle. Keeps the dark-mode fog alive.
2. **Pure M3 names over aliases or Tailwind-flavored names.** Coherence with M3 is the point of this ticket; aliases add translation friction.

### Verification
- `npm run type-check` — clean.
- `npm run build` — clean (117 modules, 2.02s). Confirmed the generated CSS ships BOTH the `:root` var definitions (`--md-primary: #1a56db`, `--md-surface-container-low: #f5f3fa`, …) AND the consuming utilities (`.bg-surface-container-low{background-color:var(--md-surface-container-low)}`, `.rounded-md{border-radius:var(--md-shape-md)}`).
- `npm run test:run` — **235/235 pass**, no regressions.
- `App.vue` root now uses `bg-surface-container-low text-on-surface` as the first real consumer; `main.ts` imports `tokens.css` before mount.

### What lives where (the contract)
- `web/src/styles/tokens.css` — **all** token values: color vars, elevation, shape, motion, and the typography class definitions. The only place hex lives.
- `web/uno.config.ts` — the **bridge**: `theme.colors` / `theme.borderRadius` / `theme.transitionTimingFunction` / `theme.transitionDuration` bind M3 role names → CSS vars so they become UnoCSS utilities.

### What this unblocks / does NOT decide
- **Unblocks**: 03 (widget restyle — widgets can now consume tokens). Indirectly unblocks 04/05/06 once 03 lands.
- **Does NOT decide**: per-widget M3 specs (→ 03), screen layouts (→ 04/05/06), the toast/snackbar pattern (→ graduates now that tokens exist — see map fog graduation), or dark-mode values (→ future fog).
