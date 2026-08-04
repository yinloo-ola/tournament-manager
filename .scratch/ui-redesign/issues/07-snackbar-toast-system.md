# 07 — Snackbar / toast feedback system

Type: `wayfinder:task`
Status: resolved
Blocked by: 03

## Question

Build an M3 snackbar host component and migrate every `alert()` call site to it.

Graduated from map fog once the design system (02) landed — the snackbar was previewed in the nav prototype (ticket 01's `prototypes/nav-shell.html`) and needs the M3 tokens + the widget-primitives restyle to land first.

The codebase has ~12 `alert()` calls across `HomeView`, `TournamentView`, `CategoryCard`, and the file-import handlers — every one is a blocking browser dialog used for success ("Saved…"), validation errors ("Min players must be less than max players"), and failures ("No file selected", import errors). All should become non-blocking snackbars with proper M3 spec:

- **M3 snackbar spec**: inverse-surface background (`bg-inverse-surface`), inverse-on-surface text, optional single text action button, ~4s duration, bottom-centered or anchored. The tokens already exist (`--md-inverse-surface`, `--md-inverse-on-surface`, `--md-inverse-primary`).
- **Host architecture**: a single global snackbar host mounted in `App.vue` (sibling to `<RouterView>`), driven by a small composable/store (e.g. `useToast()` returning `show(message, opts?)`). Screens and handlers call `show(...)` instead of `alert(...)`.
- **Stacking/dedupe**: decide whether to stack (M3 allows one at a time by default) or queue.
- **Action button**: success toasts need none; "Saved as download — original not updated" needs an action (e.g. "Got it"). Import-error cases may want a "Details" affordance.

Decide the API surface, implement the host + composable against tokens (02) and within the widget layer (03), then migrate the ~12 call sites. This is a `task` — the M3 spec is fixed; the work is the doing. Could be folded into 03 if 03's scope grows to include a new snackbar widget.

## Answer

**Decision: M3 snackbar system shipped — `useToast` composable + `SnackbarHost` widget. All 25 `alert()` call sites across 4 files migrated to non-blocking toasts. A pre-existing layering violation (domain module calling `alert`) fixed as a bonus.**

### Architecture
- **`src/shared/ui/toast.ts`** — a module-singleton composable. Module-level reactive `queue` (not inject/provide) so any caller — including handlers in deep components and domain boundaries via their callers — can `show()` without a component injection context. Exposes `show(message, opts)`, `dismiss(id)`, and `toast.info/success/error` convenience helpers. Tones: `info` / `success` / `error`.
- **`src/widgets/SnackbarHost.vue`** — mounted once in `App.vue` (sibling to `<RouterView>`). Renders the queue head as an M3 snackbar: `inverse-surface`/`inverse-on-surface` (error uses `error-container`/`on-error-container`), `elevation-3`, bottom-centered, auto-dismiss after 4s (configurable; 0 = sticky), optional single action button (M3 allows one), slide-up+fade motion. One-at-a-time per M3 spec; queued toasts advance as each dismisses. `role="status" aria-live="polite"` for accessibility.

### M3 spec decisions
- **One at a time** (M3 default) — only the queue head is visible; the rest advance automatically. No stacking.
- **4s auto-dismiss** default; `duration: 0` for sticky toasts (none currently used).
- **Single action button** — M3 allows at most one; currently toasts use a dismiss × (or a labeled action if provided).
- **Error tone** stands apart: `error-container`/`on-error-container` so failures read differently from success/info (both use the inverse surface).
- **Labeled action buttons dropped** (code-review amendment): the ticket *Question* mooted "Got it" / "Details" action affordances, but the implementation ships dismiss-× only. Decided not to add labeled actions: none of the migrated call sites have a meaningful secondary action (a failed import's "details" would just repeat the error message already shown), so an action button would be chrome without function. The `actionLabel` API remains available for future toasts that have a genuine action.

### Call-site migration (25 sites → all gone)
- **TournamentView** (15 sites): save (info on download), load/export errors (error), export successes (success: "Round-robin charts exported", "Draft schedule exported", "Scoresheets exported"), import-final success/error, file-not-selected guards, draw-diff validation, generateRounds failure.
- **CategoryCard** (6 sites): import guards (team min/max validation), importer errors, import success ("Imported N entries"), entry-type guard.
- **TournamentDraw** (2 sites): player-list sanity check, doDraw failure.
- **schedule.ts** (1 site): **layering violation fixed** — the domain module was calling `alert()` directly. Removed it; `importFinalSchedule` already returns `boolean`, so the caller (TournamentView) now shows the error toast on `!ok`.

### Test updates (3 tests)
Three tests previously asserted `alert()` was called. Updated them to mock `@/shared/ui/toast` and assert `toast.error` instead — the tests now verify the *intent* (error surfaces to the user), not the *mechanism* (alert vs toast):
- `TournamentView.generateRounds.test.ts` — drawDone generation error → `toast.error`.
- `CategoryCard.entryImport.test.ts` (2) — importer error + team guard → `toast.error`.

### Verification
- `npm run type-check` — clean.
- `npm run build` — clean (1.97s).
- `npm run test:run` — **235/235 pass** (3 updated, 232 unchanged).
- **`grep` audit**: zero `alert()` calls remain in app code (`src/**/*.vue`, `*.ts`, excluding tests).
- **Live browser check**: SnackbarHost container mounted in the DOM (fixed bottom-center). (Toast *appearance* wasn't captured in a screenshot this run since the drivable triggers require a file picker or imported entries, neither available in the IAB; the trigger→toast wiring is verified by the 3 updated tests that assert `toast.error` is called with the right messages, and the host is a thin reactive render of that queue.)
