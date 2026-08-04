# Tournament Manager — Architecture Documentation

## Overview

Tournament Manager is a **pure-frontend** web application built with **Vue 3 + TypeScript**. All logic runs client-side in the browser — there is no backend server, no API, and no binary. Data persists as `.json` files via the File System Access API (with IndexedDB autosave), and Excel imports/exports run entirely in-browser via ExcelJS.

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Browser (Static SPA)                      │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                    web/dist/                            │  │
│  │    Static assets served by GitHub Pages (or any host)   │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────▼───────────────────────────────┐  │
│  │              Vue 3 SPA (TypeScript)                     │  │
│  │                                                        │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │  │
│  │  │  features/   │  │   shared/    │  │    app/      │  │  │
│  │  │  (domain)    │  │  (model,     │  │  (router,    │  │  │
│  │  │              │  │   excel)     │  │   store)     │  │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────────────┘  │  │
│  │         │                 │                             │  │
│  │  ┌──────▼─────────────────▼───────────────────────────┐ │  │
│  │  │           File System Access API + IndexedDB        │ │  │
│  │  │     (.json document persistence + autosave)         │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

No server process. No network calls. No database.

---

## Tech Stack

| Library | Purpose |
|---|---|
| Vue 3 (Composition API) | UI framework |
| TypeScript | Type safety — single source of truth for domain model |
| Pinia | State management (via reactive `ref` in store) |
| Vue Router | Client-side routing (hash history) |
| UnoCSS | Utility-first CSS, bound to M3 semantic color roles via the theme bridge in `uno.config.ts` |
| Material 3 design tokens | Token layer in `src/styles/tokens.css` — seed color, tonal surfaces, elevation, shape, typography, motion. All colors are CSS variables (dark-mode-ready) |
| `@iconify-json/line-md` | Icon set (via UnoCSS `preset-icons`) |
| ExcelJS | In-browser Excel (.xlsx) read/write |
| PapaParse | CSV parsing |
| Vite | Build tooling → static `dist/` |

---

## Directory Structure

```
web/
  src/
    app/                  Application shell, router, document store
      documentStore.ts    Open/save orchestration (File System Access API + IndexedDB)
      router/index.ts     Route definitions
    features/             Feature-sliced modules (one per domain)
      tournament-doc/     Document open/save/autosave/recents
        openDocument.ts   Parse + validate tournament JSON
        saveDocument.ts   Serialize + write file
        storage/          File Access API, IndexedDB, recents
      tournament-config/  Tournament + category configuration UI
      draw/               Draw algorithm + group allocation
        domain/draw.ts    Weighted random + zigzag + club separation
        domain/groups.ts  Group calculation helpers
      matches/            Round generation + match display
        domain/generateRounds.ts  Round-robin (circle method) + knockout bracket
        domain/roundName.ts       Knockout round size → display name (Final, Semi, …)
      entry/              Entry import from Excel
        domain/importSingles.ts   Singles .xlsx parser
        domain/importDoubles.ts   Doubles .xlsx parser
        domain/importTeam.ts      Team .xlsx parser
      schedule/           Schedule generation + draft export + final import
        domain/scheduleMatches.ts    Greedy time-slot scheduler
        domain/importFinalSchedule.ts  Edited .xlsx reader/merger
        excel/draftScheduleWorkbook.ts Draft schedule .xlsx writer (ExcelJS)
        excel/color.ts               Deterministic HSL→hex color generation
      roundrobin/         Round-robin chart export
        excel/roundrobinChartWorkbook.ts  Chart .xlsx writer (ExcelJS)
      scoresheet/         Scoresheet template export
        excel/scoresheetWorkbook.ts  Template clone + placeholder substitution
    shared/               Cross-cutting concerns
      model/index.ts      **Single source of truth** — Tournament, Category,
                          Entry (class with name getter), Match, Group, etc.
                          Includes parse(), serialize(), rehydrate(), validateTournament()
      ui/toast.ts         useToast composable — M3 snackbar singleton (module-level
                          reactive queue; show/dismiss + info/success/error helpers)
      excel/
        readWorkbook.ts   ExcelJS → string[][] (raw cell values)
        cloneSheet.ts     Deep-copy worksheet (values + styles + merges + dims)
        address.ts        Cell name splitting (A1 → {col, row})
    store/state.ts        Global reactive ref<Tournament>
    styles/tokens.css     **Material 3 design tokens** — the only place hex lives.
                          Seed color, tonal surfaces, elevation, shape, motion,
                          typography. CSS variables consumed via UnoCSS theme bridge.
    views/                Page-level Vue components
      HomeView.vue        Launcher (empty state of the app-bar shell — open/create/recents)
      TournamentView.vue  Tournament setup (app bar: Save + Document ▾ menu; category grid)
      MatchesView.vue     Per-category matches (M3 tabs + knockout bracket)
    widgets/              Reusable M3-styled UI primitives
      SimpleButton.vue    M3 filled/tonal/text button (variant prop)
      OutlinedButton.vue  M3 outlined button (tone prop: primary/error)
      OutlinedInput.vue   M3 outlined text field (floating label)
      LabeledInput.vue    M3 filled text field (floating label)
      LabeledSelect.vue   M3 filled select (floating label)
      ModalDialog.vue     M3 dialog (focus trap, scrim, scale+fade motion)
      DropdownMenu.vue    M3 menu (scale-from-anchor motion)
      MenuItem.vue        M3 menu item / divider
      GridTable.vue       Drag-and-drop group allocation grid
      MatchesTable.vue    Shared six-column match data table
      SnackbarHost.vue    M3 snackbar host (mounted once in App.vue; renders toast queue)
  testdata/               Test fixtures + frozen golden baselines
    tournament.json       Sample tournament
    scoresheet template.xlsx  Scoresheet template
    *.xlsx                Entry import test files
  __tests__/golden/       Committed golden outputs (regression baseline)
```

---

## Architecture Principles

### Feature-Sliced

Each domain (draw, matches, entry, schedule, roundrobin, scoresheet) is a self-contained feature under `features/`. Features depend only on `shared/` and `store/`, never on each other (except via explicit imports in `views/`).

### Single Model

`shared/model/index.ts` is the **only** definition of the domain types. There is no Go model to keep in sync. The `Entry` class carries behavior (the `name` getter) and must be rehydrated via `Entry.from()` after JSON deserialization.

### Pure-Frontend Pipeline

All operations that were formerly server-side now run in-browser:
- **Entry import:** `.xlsx` → ExcelJS parse → typed `Entry[]`
- **Round generation:** synchronous circle-method algorithm
- **Schedule:** greedy scheduler → ExcelJS `.xlsx` writer → blob download
- **Chart/scoresheet:** ExcelJS workbook generation → blob download
- **No `fetch()` calls anywhere in app code**

### Document Persistence

Tournaments are saved as `.json` files using the File System Access API (`showSaveFilePicker`) with a fallback download path. An IndexedDB autosave provides crash recovery. File handles are persisted across reloads for in-place saving.

### UI & Navigation (Material 3)

The app uses a **single top app-bar shell** (no navigation rail) — appropriate for a 2-destination, document-centric tool:

- **Home** is the *empty state of the shell* (not a separate route): when no tournament is open, the content area shows the launcher (Import / Create / Recents). Opening or creating a tournament is a state transition that fills the app bar and swaps the content. The `/` route + catch-all redirect land here.
- **Tournament setup** (`/tournament`): the app bar shows brand + tournament name, a prominent **Save** button, and a **Document ▾** menu grouping the 5 file/export/import actions (Load, Export RR charts, Export draft schedule, Import final schedule, Export scoresheets). These were previously buried in a hamburger menu.
- **Matches** (`/tournament/matches/:shortName`): M3 tabs (Group Matches / Groups / Knockout); the knockout tab renders a visual bracket layer (rounds as columns of match cards) above the data table.

**Feedback:** all user-facing success/error messages render as **M3 snackbars** via `useToast()` (`shared/ui/toast.ts`) + `SnackbarHost` (mounted in `App.vue`). There are zero `alert()` calls in the codebase. The snackbar is a module-singleton queue (one-at-a-time, 4s auto-dismiss, `role="status"`).

**Motion:** M3 restraint — motion signals state change, never decorates. Tokenized durations/easings (`--md-duration-*`, `--md-easing-*`) with full `prefers-reduced-motion` support (a single media-query block collapses all durations to ~0ms).

---

## Build & Development

```bash
cd web
npm install
npm run dev          # Vite dev server
npm run build        # Builds to web/dist/
npm run type-check   # vue-tsc --build --force
npm run test:run     # vitest run (all tests)
```

No Go toolchain required. No backend to start.

---

## Deployment

The application deploys as **static files**. The GitHub Actions workflow (`.github/workflows/deploy.yml`) builds `web/` and deploys `dist/` to GitHub Pages. Any static host (Netlify, Vercel, nginx) works equally well — serve the `dist/` directory.

No server process, no binary, no database, no reverse proxy.