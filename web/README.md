# Tournament Manager — web

Pure-frontend tournament management tool for racquet sports (Singles, Doubles,
Team). Round-robin group stages feed single-elimination knockout brackets. All
logic runs in the browser — **no backend, no server**. Excel import/export uses
[ExcelJS](https://github.com/exceljs/exceljs) entirely client-side.

Built with **Vue 3** (Composition API) · **TypeScript** · **Pinia** ·
**UnoCSS** · **Vite**, with a **Material 3** design-token system
(`src/styles/tokens.css` + UnoCSS theme bridge). Deployed as a static site to
GitHub Pages.

## Getting started

Requires Node 20+ and npm.

```sh
cd web
npm install
npm run dev          # Vite dev server → http://localhost:5173
```

Routing is hash-based, so the landing URL is
`http://localhost:5173/#/tournament`.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check + production build → `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run type-check` | `vue-tsc --build --force` |
| `npm run test` | Vitest in watch mode |
| `npm run test:run` | Vitest one-shot (used in CI) |
| `npm run lint` | ESLint with `--fix` |
| `npm run format` | Prettier over `src/` |

## Architecture

- **Single domain model** — `src/shared/model/` is the only source of truth for
  tournament types and the `Entry` class.
- **Feature-sliced** — each domain (`tournament-doc`, `tournament-config`,
  `draw`, `matches`, `entry`, `schedule`, `roundrobin`, `scoresheet`) is
  self-contained under `src/features/`.
- **No network calls** — everything is client-side. Persistence uses the File
  System Access API (`.json` documents) plus IndexedDB crash-recovery autosave.

See the root `docs/` for the full picture:

- [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) — module layout and data flow
- [`docs/FUNCTIONALITY.md`](../docs/FUNCTIONALITY.md) — features and behavior
- [`docs/AI_AGENT_GUIDE.md`](../docs/AI_AGENT_GUIDE.md) — guide for AI contributors
- [`AGENTS.md`](../AGENTS.md) — build/test commands and conventions

## Deployment

`npm run build` outputs `dist/`, deployed to GitHub Pages via
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml). Vite `base`
is set to `/tournament-manager/` and `dist/index.html` is copied to
`dist/404.html` as an SPA fallback.