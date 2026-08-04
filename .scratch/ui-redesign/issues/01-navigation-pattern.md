# 01 — Navigation pattern

Type: `wayfinder:grilling` + `wayfinder:prototype`
Status: resolved

## Question

What is the primary navigation pattern for the redesigned app? This is the single most consequential IA decision — it shapes every screen ticket that follows.

Today the app is: `Home (2 buttons) → Tournament (hamburger menu buries Save/Load/4 exports, flat category grid) → Matches (tabs: Group Matches / Groups / Knockout)`. There are exactly 3 routes. The tournament lifecycle is **linear-ish**: configure → import entries → draw → (export round-robin / draft schedule) → (import final schedule) → run matches. But a user may jump back to reconfigure mid-tournament.

Grill the user to choose between the realistic candidates for a 3-screen desktop-first tool with a linear-ish-but-revisitable workflow:

1. **Persistent navigation rail** (M3 pattern) — left rail with Home / Tournament / Matches destinations; actions (Save/Export/Import) move to a top app bar or overflow. Always-visible orientation.
2. **Top app bar + contextual actions** — single bar, breadcrumb/back navigation, actions as buttons (not buried in hamburger). Lighter, fewer destinations to justify a rail.
3. **Step/wizard chrome** — wizard-style progress through the tournament lifecycle (Configure → Draw → Schedule → Matches), with the ability to jump back. Most prescriptive; best if the lifecycle is truly sequential.
4. **Command palette** (supplement, not primary) — a `Cmd+K` palette for the export/import actions, primary nav stays simple. Worth raising as a complement to whichever primary wins.

Produce a rough prototype (`/prototype` skill) of the chosen pattern in real HTML/UnoCSS so the user can react to the actual feel before downstream screen tickets are built against it. The decision this ticket records: **the primary nav pattern, and where global actions (Save/Export/Import) live within it.**

This ticket is the root of the frontier — most screen tickets block on it because they need to know the shell they sit inside.

## Answer

**Decision: single top app bar shell (Google-Docs-style), no navigation rail.**

### The shell
- **One persistent top app bar** across the whole app. No left navigation rail — the app has only 2 functional destinations (`/tournament` setup, `/tournament/matches/:shortName`), and M3's navigation rail is spec'd for 3–7 peer destinations. A 2-item rail would be chrome-for-chrome's-sake and waste horizontal real estate that brackets/tables need.
- **Home is not a separate route.** The launcher (Import / Create / Recents) is the *empty state of the single shell* — i.e. the app bar + content area when no tournament document is open. Opening/creating a tournament is a state transition that fills the bar and swaps the content, not a route navigation. (Router implication: the `/` Home route collapses into a "no doc open" condition of `/tournament`. Exact routing is an implementation detail for the screen tickets.)
- **Back affordance:** a leading **← icon button** appears in the bar on the setup screen and the matches screen, returning to the launcher (`/`) and the setup screen respectively. *(Amended by ticket 05: the setup screen also gained a back-to-launcher arrow for consistent shell navigation. The original "matches route only" scoping was revised during implementation.)*

### Where the 6 buried actions live
- **`Save`** is a prominent standalone **filled** button in the bar — it is the authoritative action (per the autosave code comment: "Explicit file save remains the authoritative action"), distinct from background autosave.
- **The other 5 actions** (Load + Export RR Charts + Export Draft Schedule + Import Final Schedule + Export Scoresheets) collapse into **one labeled `Document ▾` tonal menu**, with dividers separating file-ops (Load) from spreadsheet-ops (the 4 exports/imports). All are tournament-document-scoped, so they group naturally and surface only when a tournament is open.
- Rationale for one menu over two: Load is really "import a .json," so it groups with the other imports; splitting into `Save ▾` + `Export ▾` would be busier without aiding recognition.

### Sub-decisions made by the designer (flagged, reversible)
1. **Launcher = empty state of the shell** (not a distinct route) — chosen for shell coherence; one-line router change to revert.
2. **Save prominent + one `Document ▾` menu** — low-regret default given Save's authoritative status.

### Asset
Interactive prototype demonstrating all 3 states of the one bar:
`prototypes/nav-shell.html` — open in a browser. Cycles: launcher → tournament open (actions appear) → category drill-in (back arrow appears). M3-ish styling inlined from the blue seed for feel; real tokens are locked in ticket 02.

### What this unblocks / does NOT decide
- **Unblocks**: 04 Home, 05 Setup, 06 Matches — all three can now be built inside this shell. 02 (design system) is still independently required; 03 (widgets) blocks on 02 only.
- **Does NOT decide**: the exact M3 token values (→ 02), widget specs (→ 03), CategoryCard lifecycle-status design (→ 05), or bracket presentation (→ 06). The snackbar/toast pattern previewed in the prototype graduates to its own fog ticket once 02 lands.
