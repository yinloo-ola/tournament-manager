# 04 — Home screen redesign

Type: `wayfinder:task`
Status: resolved
Blocked by: 01, 02, 03

## Question

Redesign `HomeView.vue` — the entry/landing screen — to Material 3, inside the navigation shell from #01 and consuming tokens + widgets from #02/#03.

Today it's a centered column: two big buttons (Import / Create) and a "Recent tournaments" list with Open/Remove text links. Functional but barren — no hierarchy, no branding, no empty state.

Decisions this ticket resolves:

1. **Layout** — hero/branding presence (is there a wordmark or app identity on first launch?), the prominence split between Import vs. Create, and how recents are presented (list vs. cards).
2. **Empty state** — what the user sees with zero recents (today: the section is hidden). M3 has empty-state guidance.
3. **Entry into the shell** — how this screen relates to the chosen navigation (is Home a destination in the rail/bar, or a pre-shell gate?).

Implement directly in code. This is the first screen users touch, so it sets the visual tone for the rest of the redesign.

## Answer

**Decision: HomeView redesigned as the M3 launcher — the empty state of the single app-bar shell (decision 01). Fixed a pre-existing router bug where Home was never reachable.**

### What was built

**Layout** — three sections inside the one app-bar shell:
1. **App bar** (decision 01): brand only (`🏆 Tournament Manager` in `title-large` + `text-primary`), no document actions — those only appear once a tournament is open. `surface-container` + `elevation-1`, sticky.
2. **Hero**: large `🏆` + `display-small` heading + tagline ("Round-robin groups & knockout brackets for racquet sports"). Sets the visual tone for the redesign.
3. **Primary CTAs**: `Import Tournament` (filled, primary, with folder icon + loading state) and `Create New Tournament` (outlined, with plus icon). Side-by-side on `sm+`, stacked on mobile.
4. **Recent tournaments** with two states (see below).

**Empty state** (the decision-01 UX win) — the old code *hid* the recents section when empty. The redesign surfaces it: a dashed-border `surface-container-low` panel with a muted `📄` and "No tournaments yet — import a file or create a new one to get started." This gives first-time users guidance instead of a blank page.

**Recents list** — each recent is an `elevation-1` card with hover lift, a doc icon, the name (`title-medium`), a relative-time line ("5m ago" / "2h ago" / "3d ago" via a local helper), and a `sourceKind === 'downloaded'` indicator. The remove button is a ghost icon that appears on hover/focus (discoverable but unobtrusive). Re-opening uses a real `<button>` with proper disabled + title states for the no-file-handle case.

**Entry into the shell** — confirmed by decision 01: Home is the landing, not a peer destination. Opening/creating a tournament routes to `/tournament` and the app bar there gains the document actions.

### Router fix (pre-existing bug surfaced by this ticket)
The old router had routes for `/tournament` and `/tournament/matches/:shortName` **only** — no `/` and no catch-all. HomeView was never reachable through navigation; landing on `#/` rendered a blank `<RouterView>`. Fixed: added `/` → `HomeView` as the landing, plus a `/:pathMatch(.*)*` catch-all redirecting to `/`. Now any unmatched hash drops the user at the launcher rather than a blank page.

### Preserved contracts
- `[data-test="create-new"]` still resets the doc and navigates to `/tournament` (verified by `HomeView.test.ts`).
- `[data-test="recent-remove"]` remove flow intact (verified by `HomeView.recents.test.ts`).
- The populated-recents branch renders both file and downloaded entries (covered by the recents test that records two and asserts both render).
- Import flow + error message contract (`[data-test="error"]`) preserved; added a non-blocking `error-container` styled message (full toast system is ticket 07).
- Added an `importing` loading state on the Import button ("Opening…") — minor UX improvement, no contract change.

### Verification
- `npm run type-check` — clean.
- `npm run build` — clean (1.93s).
- `npm run test:run` — **235/235 pass**, including both HomeView test files.
- **Live browser check**: Home renders at `#/` — app bar (brand only), hero, both CTAs, and the empty state all present and correct. Create New navigates to `/tournament`. (Populated-recents rendering verified via the test suite since the file-picker flow isn't drivable in the IAB; screenshot capture was attempted but the image wasn't surfaced back in this run — DOM evidence is corroborated and consistent.)

### What this does NOT decide
- The `/tournament` app bar with the surfaced document actions (Save + Document ▾) — that's ticket 05, where the decision-01 action layout actually lands.
- Full toast/snackbar replacing the inline error — ticket 07.
- The Matches screen header/back arrow — ticket 06.
