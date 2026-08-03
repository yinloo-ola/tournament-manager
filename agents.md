# Tournament Manager

## Project Overview

Pure-frontend tournament management tool for racquet sports. Vue 3 + TypeScript SPA — no backend, no server, no Go. Supports Singles, Doubles, and Team events with round-robin group stages followed by single-elimination knockout brackets. All logic runs in-browser; Excel imports/exports use ExcelJS.

## Tech Stack

- **Frontend**: Vue 3 (Composition API), TypeScript, Pinia, UnoCSS, Vite
- **Excel**: ExcelJS (in-browser .xlsx read/write)
- **Storage**: File System Access API (.json files) + IndexedDB autosave
- **Deployment**: Static site (GitHub Pages) — `vite build` → `web/dist/`

## Repository Layout

```
web/
  src/
    app/                 → Application shell, router, document store
    features/            → Feature-sliced domain modules
      tournament-doc/    → Open/save/autosave
      tournament-config/ → Tournament + category configuration
      draw/              → Draw algorithm + group allocation
      matches/           → Round generation (round-robin + knockout)
      entry/             → Entry import from Excel (singles/doubles/team)
      schedule/          → Schedule generation + draft .xlsx export + final import
      roundrobin/        → Round-robin chart .xlsx export
      scoresheet/        → Scoresheet template clone + substitution
    shared/              → Cross-cutting: model (single source of truth), excel helpers
    store/state.ts       → Global reactive ref<Tournament>
    views/               → Page-level Vue components
    widgets/             → Reusable UI primitives
  testdata/              → Test fixtures
docs/                    → Architecture, functionality, AI agent guide, lessons

No Go, no backend, no server, no go.mod, no cmd/endpoint/model/utils.
```

## Build & Test

```bash
cd web
npm install
npm run dev          # Vite dev server
npm run build        # vite build → dist/
npm run type-check   # vue-tsc --build --force
npm run test:run     # vitest run
```

## Key Principles

- **Single model**: `web/src/shared/model/index.ts` is the only domain type definition.
- **No fetch**: Zero network calls in app code — everything runs client-side.
- **Feature-sliced**: Each domain is self-contained under `features/`.
- **Golden baselines**: Frozen Go-generated reference outputs in `__tests__/golden/` serve as the permanent regression baseline (the Go oracle was deleted in Slice 5 cutover; `git tag last-go-backend` marks the last commit with Go code).