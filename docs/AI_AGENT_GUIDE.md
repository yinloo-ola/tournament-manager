# Tournament Manager — AI Agent Guide

## Purpose

This document provides essential context for AI coding agents working on this codebase. It covers domain knowledge, conventions, key files, common pitfalls, and workflow guidance.

---

## Domain Context

This is a **tournament management system** for racquet sports (table tennis, badminton, etc.). The tournament format is:

1. **Group Stage** — Round-robin play within small groups. Every entry plays every other entry once. Top *N* entries from each group advance.
2. **Knockout Stage** — Single-elimination bracket among qualified entries. Bracket sizes are powers of 2, with byes in the first round as needed.

**Entries** can be:
- **Singles** — One player per entry.
- **Doubles** — Two players per entry (a pair).
- **Team** — Variable number of players per entry (e.g., 2–5).

Each **match** has two entries (entry1Idx, entry2Idx), a scheduled date/time, a table assignment, and a duration.

---

## Architecture

This is a **pure-frontend** Vue 3 + TypeScript application. There is no backend, no server, no Go code, and no API. All logic — entry import, round generation, scheduling, Excel export/import — runs in the browser. The app deploys as static files (GitHub Pages or any static host).

The codebase uses a **feature-sliced** architecture under `web/src/features/`, with a single shared model in `web/src/shared/model/index.ts`.

---

## Key Concepts

### Entry Indexing

- Entries are referenced by **0-based index** into the `Category.Entries` array.
- **`EntryEmptyIdx = -1`**: A placeholder meaning "no entry assigned yet" (used in knockout bracket slots).
- **`EntryByeIdx = -2`**: A virtual "bye" entry used to pad odd-sized groups to even for round-robin scheduling.

### Groups & Rounds

- A `Group` contains `EntriesIdx` (indices of entries in the group) and `Rounds` (a 2D array: `Match[][]`).
- `Rounds[roundIdx][matchIdx]` gives a specific match.
- Group round-robin uses a **circle method** where player 0 is fixed and others rotate.

### Knockout Rounds

- `KnockoutRound.Round` holds the round size (e.g., 2 = Final, 4 = Semi-Final, 8 = Quarter-Final).
- Rounds are ordered from largest to smallest in the array.

---

## Codebase Conventions

| Convention | Details |
|---|---|
| **Feature-sliced** | Each domain under `features/` (tournament-doc, tournament-config, draw, matches, entry, schedule, roundrobin, scoresheet). Features depend only on `shared/` and `store/`, not on each other. |
| **Single model** | `shared/model/index.ts` is the **only** domain type definition. The `Entry` class has a `name` getter — use `Entry.from()` to rehydrate after JSON deserialization. |
| **Composition API** | All components use `<script setup lang="ts">`. |
| **State** | Single reactive `ref<Tournament>` in `store/state.ts`. No Pinia actions/getters — logic lives in feature modules. |
| **Excel** | All Excel read/write uses **ExcelJS** (not excelize or tealeg/xlsx — those were the former Go libraries, now deleted). |
| **No fetch** | There are **zero** `fetch()` calls in app code. All operations are synchronous local functions or use browser APIs (File System Access, Blob download). |
| **Styling** | UnoCSS utility classes bound to **Material 3 semantic color roles** via the theme bridge in `uno.config.ts`. Tokens (the only place hex lives) are in `src/styles/tokens.css` as CSS variables. Use `bg-primary`, `text-on-surface-variant`, `border-outline-variant`, etc. — **never hardcode hex or Tailwind color names** (`bg-blue-600`, etc.). Motion uses `--md-duration-*` / `--md-easing-*` tokens with `prefers-reduced-motion` support. |
| **Feedback** | All user-facing success/error messages use **M3 snackbars** via `useToast()` (`shared/ui/toast.ts`) — `toast.success(...)`, `toast.error(...)`, `toast.info(...)`. **Never use `alert()`** — there are zero `alert()` calls in the codebase; adding one is a regression. |
| **Testing** | Vitest. Tests live in `__tests__/` dirs next to each module. Golden baselines in `__tests__/golden/`. Test fixtures in `web/testdata/`. |

---

## Critical Files Reference

| File | Role |
|---|---|
| `shared/model/index.ts` | **Single source of truth** — Tournament, Category, Entry (class), Match, Group types + parse/serialize/rehydrate |
| `store/state.ts` | Global reactive `ref<Tournament>` |
| `features/matches/domain/generateRounds.ts` | Round-robin (circle method) + knockout bracket generation |
| `features/schedule/domain/scheduleMatches.ts` | Greedy time-slot scheduler |
| `features/schedule/excel/draftScheduleWorkbook.ts` | Draft schedule .xlsx writer (ExcelJS) |
| `features/schedule/domain/importFinalSchedule.ts` | Edited .xlsx reader/merger |
| `features/roundrobin/excel/roundrobinChartWorkbook.ts` | Round-robin chart .xlsx writer |
| `features/scoresheet/excel/scoresheetWorkbook.ts` | Scoresheet template clone + substitution |
| `shared/excel/cloneSheet.ts` | Deep-copy worksheet helper (ExcelJS has no copySheet) |
| `shared/excel/readWorkbook.ts` | ExcelJS → `string[][]` raw cell values |
| `styles/tokens.css` | **Material 3 design tokens** — seed color, tonal surfaces, elevation, shape, motion, typography. The only place hex lives. |
| `uno.config.ts` | UnoCSS theme bridge — binds M3 role names (`primary`, `on-surface-variant`, …) to CSS vars so `bg-primary` etc. generate as utilities |
| `shared/ui/toast.ts` | `useToast()` composable — snackbar singleton. Use `toast.success/error/info` for all user feedback. |
| `widgets/SnackbarHost.vue` | M3 snackbar host (mounted once in `App.vue`; renders the toast queue) |
| `widgets/MatchesTable.vue` | Shared six-column match data table (used by Group + Knockout tabs) |
| `features/matches/domain/roundName.ts` | Knockout round size → display name (2=Final, 4=Semi-finals, …) |
| `app/documentStore.ts` | Document open/save orchestration |

---

## Common Pitfalls

1. **Entry class vs plain object**: After parsing tournament JSON, always call `Entry.from()` (via `rehydrate()`) to convert plain objects into `Entry` class instances. Otherwise, the `name` getter won't work.

2. **Entry index confusion**: Entry indices are 0-based within a category's entries array. When reading from Excel (which uses 1-based SN), remember to adjust.

3. **ExcelJS internals**: The `_columns` array is 0-indexed while the public API (`getColumn(n)`) is 1-based. `mergeCells` propagates master style to all cells in the range by default — use `mergeCellsWithoutStyle` when cloning.

4. **Knockout round ordering**: KnockoutRounds are ordered largest-round-first (e.g., R16, QF, SF, F). The `Round` field stores the round *size*, not the round number.

5. **No server**: Do not add `fetch()` calls or API endpoints. All features must work offline in the browser.

6. **No `alert()`**: All user feedback goes through `useToast()` snackbars. There are zero `alert()` calls — adding one is a regression. The snackbar is non-blocking, accessible (`role="status"`), and auto-dismisses.

7. **No hardcoded colors**: Use M3 token utilities (`bg-primary`, `text-on-surface-variant`, etc.), never raw hex or Tailwind color names. Hex lives only in `src/styles/tokens.css`.

---

## Build & Test Commands

```bash
cd web
npm run dev          # Vite dev server
npm run build        # vite build → dist/
npm run type-check   # vue-tsc --build --force
npm run test:run     # vitest run (all tests)
```

---

## Typical AI Agent Tasks

### Adding a new feature
1. Add types/behavior to `shared/model/index.ts` if domain types change.
2. Create a feature module under `features/<name>/` with domain logic and/or Excel handlers.
3. Wire the UI in the appropriate `views/` component.
4. Write tests in `features/<name>/__tests__/`.

### Modifying Excel import/export
1. All Excel code uses ExcelJS — check the existing helpers in `shared/excel/`.
2. Test with fixtures in `web/testdata/` and compare against golden baselines in `__tests__/golden/`.

### Adding a new UI component
1. Check if a suitable widget exists in `widgets/` first — the M3-styled primitives (buttons, inputs, dialogs, menus, tables, snackbar) cover most needs.
2. Use `<script setup lang="ts">` with UnoCSS **M3 token utilities** (`bg-primary`, `text-on-surface-variant`, `border-outline-variant`, `rounded-lg`, `elevation-1`, etc.). Never hardcode hex or Tailwind color names.
3. For buttons, use the existing widgets with their variant/tone props: `SimpleButton` (`variant="filled|tonal:text"`), `OutlinedButton` (`tone="primary|error"`). Only sizing/layout should be styled by the caller.
4. Surface user feedback via `useToast()` (`toast.success/error/info`) — **never `alert()`**.
5. Keep business logic in feature modules (`features/<name>/domain/`), not in components.