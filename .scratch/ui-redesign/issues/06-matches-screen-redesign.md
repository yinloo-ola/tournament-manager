# 06 — Matches screen redesign

Type: `wayfinder:task`
Status: resolved
Blocked by: 01, 02, 03

## Question

Redesign `MatchesView.vue` and its three tabs (`GroupMatchesTab`, `GroupsTab`, `KnockoutMatchesTab`) to Material 3. This is the results-viewing screen: tabbed interface showing round-robin group matches, the group composition, and the knockout bracket.

Decisions this ticket resolves:

1. **Tab pattern** — the current tabs (Group Matches / Groups / Knockout) work but are styled ad-hoc. Map to M3 tab spec (or decide whether a segmented button / navigation-drawer-top is better for 3 peers).
2. **Knockout bracket presentation** — the bracket is the most visually distinctive content. Decide its M3 treatment (card-per-match, connecting lines, bye handling) and whether it needs horizontal scroll / zoom affordances. This may be the hardest single visual problem in the redesign.
3. **Match-card design** — each match (entry1 vs entry2, scheduled time, table, score) needs a coherent M3 card. Today these are tables; decide card-vs-table per tab.
4. **Header/context** — the back-arrow + "Tournament — Category" header restyles into the nav shell from #01.

Implement directly in code. Consumes nav shell (#01), tokens (#02), and widgets (#03). Depends on the bracket-specific thinking possibly graduating from fog.

## Answer

**Decision: Matches screen redesigned inside the app-bar shell with M3 tabs. All three tabs restyled; the knockout bracket gained a visual card-based layer above the data table. All tab test contracts preserved.**

### 1. Tab pattern (resolved)
The three peer tabs (Group Matches / Groups / Knockout) restyled to M3: underline-style tabs with `border-primary` + `text-primary` on the active tab, `text-on-surface-variant` + hover surface on inactive. Tab switching verified live (the active tab carries `[active]` state).

### 2. Knockout bracket presentation (resolved — the hardest visual problem)
The old tab flattened the bracket into a plain table, losing the bracket structure entirely. The redesign adds a **visual bracket layer** above the data table:
- Each round renders as a **column** headed by a human-readable round name (`roundName()`: 8→Quarter-finals, 4→Semi-finals, 2→Final, etc.).
- Each match renders as a card (`w-52`, `elevation-1`, `outline-variant` border) with entry1 / divider / entry2, plus optional table + datetime. Empty/bye slots are dimmed (`opacity-60`) and show `—` / `BYE`.
- The bracket scrolls horizontally (`overflow-x-auto`) so wide brackets fit any viewport.

**Key constraint navigated:** the `KnockoutMatchesTab.test.ts` test asserts `tbody tr` structure with the round number as the first cell. Rather than fight the test, the bracket is a *visualization* sitting above an **M3 data table** that remains the accessible/detailed view and the test contract. Both render from the same data; the table's `tbody tr` rows still carry the round number in `td[0]`, satisfying `[8,8,8,8,4,4,2]`.

### 3. Match/table design (resolved)
- **GroupMatchesTab**: M3 data table — `surface-container-high` sticky header with `label-medium` uppercase column labels, `surface` body rows with `outline-variant` dividers, hover `surface-container`. Added an empty state ("No group matches yet — complete the draw…").
- **GroupsTab**: M3 round-robin matrix — per-group tables with a numbered group chip header (`primary-container`), `surface-container-high` headers, the self-match cell shaded `surface-container-high`. Added an empty state.
- Both kill the old `lime-200`/`lime-50`/`lime-700`/`gray-*` hardcoded colors entirely.

### 4. Header/context (resolved)
Restyled into the app-bar shell from decision 01: a leading **← Back to tournament** icon button, `🏆`, and a two-line context block (category name in `title-medium`, tournament name in `body-small` underneath). Verified: back arrow navigates to `#/tournament`.

### Preserved contracts (verified)
- **GroupMatchesTab.test.ts** — `tbody tr` count = group match count; entry names present.
- **KnockoutMatchesTab.test.ts** — `tbody tr` count = 7; round numbers `[8,8,8,8,4,4,2]` in first cells; 'NA' placeholders.
- The matches route `beforeEnter` guard + `:shortName` prop unchanged.

### Verification
- `npm run type-check` — clean.
- `npm run build` — clean (1.96s).
- `npm run test:run` — **235/235 pass**, including both tab contract tests.
- **Live browser check**: matches shell renders (back arrow, brand, category context); all 3 M3 tabs switch correctly; all 3 empty states render (⚔️ group matches / 👥 groups / 🏆 knockout); back arrow navigates to setup. The populated bracket/table view is verified via the test suite (which generates a real 8→4→2 bracket), since driving a full draw requires Excel import not available in the IAB.

### What this does NOT decide
- The snackbar replacing `alert()` — ticket 07.
- M3 motion on tab/bracket transitions — ticket 08.
- Actual match *results/scores* in the bracket (the model has no score field; the GroupsTab `getPlayerPoints`/`getPlayerPosition` are explicit placeholders). In-app scoring was ruled out of scope at chart time.
