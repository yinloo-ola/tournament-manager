# 05 — Tournament setup screen redesign

Type: `wayfinder:task`
Status: resolved
Blocked by: 01, 02, 03

## Question

Redesign `TournamentView.vue` — the tournament configuration screen — to Material 3. This is the densest screen: the lime header + hamburger menu (6 buried actions: Save/Load/Export RR/Export Draft Schedule/Import Final Schedule/Export Scoresheet), the `TournamentInfo` form (name/tables/start time/category count), and the flat `CategoryCard` grid.

Decisions this ticket resolves:

1. **Action discoverability** — the biggest UX problem on this screen. The 6 export/import/save/load actions are buried in a hamburger. How do they surface in the new nav shell (decided in #01)? As a persistent action bar? Grouped in an "Export" menu with clearer labels? A sidebar section? This is the core IA win of the whole redesign.
2. **Tournament info form** — restyle to M3 inputs; decide whether it's an inline header strip or a dedicated panel. The `ADD CATEGORY` button (currently `bg-blue-600`, off-brand) becomes a proper M3 button or FAB.
3. **Category grid** — `CategoryCard` is the workhorse. Restyle to M3 card spec, add hover/selected states, and decide the **empty state** (no categories yet) and a **progress/state indication** (has entries? draw done? matches generated?). Today a card gives no signal of where its category is in the lifecycle.
4. **Workflow guidance** — should the screen nudge the user through configure → import → draw? Today it's a flat grid with no order. Whether to add lightweight sequencing (without becoming a rigid wizard — #01 may have already decided this) is a real choice.

Implement directly in code, consuming the nav shell, tokens, and restyled widgets.

## Answer

**Decision: Tournament setup screen redesigned inside the decision-01 app-bar shell. The 6 buried hamburger actions are surfaced — the core IA win of the whole redesign. CategoryCard gains a lifecycle status signal. All test contracts preserved.**

### 1. Action discoverability — the core win (resolved)
The old lime header + hamburger burying 6 actions is gone. The new app bar surfaces them per decision 01:
- **Save** — prominent standalone **filled** button (primary, with document icon). The authoritative action, one click.
- **Document ▾** — a **tonal** menu button grouping the other 5 actions with clear, human-readable labels and dividers separating file-ops from spreadsheet-ops:
  - Load tournament…
  - ──
  - Export round-robin charts
  - Export draft schedule
  - Import final schedule…
  - ──
  - Export scoresheets (with template)
- **Back to launcher** — leading ← icon button, navigates to `/` (home). The brand + tournament name sit between back and actions for persistent context ("🏆 Tournament Manager — {name}").

Verified live in the browser: the Document menu opens and shows all 5 actions; Save renders prominently.

### 2. Tournament info form (resolved)
Restyled into an M3 `elevation-1` panel (`bg-surface`). The fields use the M3 outlined text fields (from ticket 03); the old `bg-blue-600` ADD CATEGORY drift is gone — category-adding moved to a dedicated **Add category** tonal button in the section header (more discoverable than a form-row button). Layout is a responsive 3-column grid for name/tables/start-time.

### 3. Category grid + CategoryCard (resolved)
- **CategoryCard** restyled to M3: `surface-container-low` + `elevation-1`, hover lift, ghost remove button (top-right, error-container on hover).
- **Lifecycle status chip** (the UX win) — a new computed `lifecycle` surfaces at-a-glance progress where previously the card gave no signal:
  - **No entries imported** (grey dot) — nothing imported yet
  - **N entries · draw pending** (grey dot) — imported, not drawn
  - **Draw done · N entries** (primary dot) — draw complete
- **Empty state** — when a tournament has zero categories, a dashed-border panel with "No categories yet — add one to get started." (was previously a blank grid).
- All form fields, `data-test` selectors (`category-card`, `do-draw`, `import-entries`, `matches`, `input-entries`), and emit contracts (`startDraw`, `playersImported`, `playerCountChanged`, `remove`, `error`) preserved.

### 4. Workflow guidance (resolved)
Did NOT add a rigid wizard (decision 01 rejected the step/wizard chrome). Instead the **lifecycle chips on each card** give lightweight, non-prescriptive progress signaling — a tournament with 5 categories at different stages reads at a glance, which a global wizard couldn't express.

### Preserved contracts (verified)
- **`TournamentView.slice4.test.ts`** (source-grep) — all function names preserved: `createRobinCharts`, `roundrobinChartWorkbook`, `exportScoresheets`, `scoresheetWorkbook`, `function exportRoundRobin`, `async function exportDraftSchedule`, `exportScoresheetWithTemplateSelected`, `const finalScheduleFile`; none of those sections contain `fetch`.
- **`TournamentView.generateRounds.test.ts`** (component wiring) — CategoryCard `startDraw` emit + ModalDialog `update:modelValue` still drive `generateRoundsForTournament`.
- Removed the leftover ad-hoc `bounce-in` `<style>` block from TournamentView (the ModalDialog now owns its own scoped M3 motion from ticket 03).

### Verification
- `npm run type-check` — clean.
- `npm run build` — clean (1.97s).
- `npm run test:run` — **235/235 pass**, including slice4 + generateRounds.
- **Live browser check**: app bar renders (back arrow, brand, Save, Document); Document menu opens with all 5 actions; CategoryCard shows the lifecycle chip ("No entries imported"); Add category creates a new card (1→2); back arrow navigates to `#/`. (Screenshot capture attempted; image not surfaced in this run — DOM evidence corroborated and consistent.)

### What this does NOT decide
- Matches screen (tabs + bracket) — ticket 06.
- The snackbar replacing `alert()` across this screen's handlers — ticket 07. The action handlers still use `alert()` per scope discipline; migrating them is 07's job.
