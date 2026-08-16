# Tournament Manager

A pure-frontend tournament management tool for racquet sports. Runs entirely in the browser — no backend, no server, no network calls. Manage the full tournament lifecycle: configuration, entry import, draw, scheduling, and document export.

Live on GitHub Pages.

## Features

- **Event formats**: Singles, Doubles, and Team categories
- **Tournament structure**: round-robin group stage followed by a single-elimination knockout bracket
- **Entry import**: read entries (players, pairs, or teams with rosters) from `.xlsx` files, parsed in-browser via ExcelJS — with a downloadable Entry Template per Entry Type (fill-in sheets, rules, and worked examples) and plain-language, row-numbered error messages for bad uploads
- **Draw**: weighted random group allocation with seeding priority, zigzag distribution, and club separation
- **Scheduling**: automatic round and match scheduling against available tables, with draft schedule export/import
- **Document export**: round-robin charts, schedules, and scoresheets as `.xlsx`
- **Persistence**: save/load tournaments as `.json` via the File System Access API, with IndexedDB autosave for crash recovery

## Tech Stack

- **Vue 3** (Composition API) + **TypeScript** + **Pinia**
- **Vite** build → static site (deployed to GitHub Pages)
- **UnoCSS** with Material 3 design tokens (`web/src/styles/tokens.css`)
- **ExcelJS** for in-browser Excel read/write

## Getting Started

Requires Node.js 20+.

```bash
cd web
npm install

npm run dev        # start Vite dev server
npm run build      # type-check + production build → web/dist/
npm run preview    # preview the production build

npm run test:run   # run test suite (vitest)
npm run type-check # vue-tsc type checking only
npm run lint       # eslint (with --fix)
npm run format     # prettier
```

## Repository Layout

```
web/
  src/
    app/                 Application shell, router, document store
    features/            Feature-sliced domain modules
      tournament-doc/    Open/save/autosave
      tournament-config/ Tournament + category configuration
      draw/              Draw algorithm + group allocation
      matches/           Round generation (round-robin + knockout)
      entry/             Entry import from Excel
      schedule/          Schedule generation + draft export/import
      roundrobin/        Round-robin chart .xlsx export
      scoresheet/        Scoresheet template clone + substitution
      lineup-seed/       Lineup system seed export
    shared/              Domain model, Excel helpers, UI composables
    store/state.ts       Global reactive tournament state
    views/               Page-level Vue components
    widgets/             Reusable M3-styled UI primitives
  testdata/              Test fixtures
docs/                    Architecture, functionality, agent guide, ADRs
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Functionality](docs/FUNCTIONALITY.md)
- [AI agent guide](docs/AI_AGENT_GUIDE.md)
- [Lineup submission context](CONTEXT.md) and [ADRs](docs/adr/)

## Key Principles

- **Single model**: `web/src/shared/model/index.ts` is the only domain type definition.
- **No fetch**: zero network calls in app code — everything runs client-side.
- **Feature-sliced**: each domain is self-contained under `web/src/features/`.
- **Golden baselines**: frozen reference outputs in `__tests__/golden/` serve as the permanent regression baseline.
