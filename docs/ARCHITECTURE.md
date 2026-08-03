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
| UnoCSS | Utility-first CSS |
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
      excel/
        readWorkbook.ts   ExcelJS → string[][] (raw cell values)
        cloneSheet.ts     Deep-copy worksheet (values + styles + merges + dims)
        address.ts        Cell name splitting (A1 → {col, row})
    store/state.ts        Global reactive ref<Tournament>
    views/                Page-level Vue components
      HomeView.vue        Landing page (open/create)
      TournamentView.vue  Main tournament management (all exports wired here)
      MatchesView.vue     Per-category matches
      ScheduleView.vue    Schedule placeholder
    widgets/              Reusable UI primitives
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