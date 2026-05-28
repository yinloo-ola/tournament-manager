# Tournament Manager — Architecture Documentation

## Overview

Tournament Manager is a **monorepo** application consisting of a **Go backend** (Gin HTTP server) and a **Vue 3 frontend** (SPA). The frontend is compiled to static files and embedded into the Go binary via `embed.FS`, resulting in a **single self-contained binary** deployment.

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    Single Go Binary (port 8082)                  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              Embedded Vue SPA (embed.FS)                   │  │
│  │   gin-static serves /dist for all non-API routes          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                           │                                      │
│  ┌────────────────────────┼──────────────────────────────────┐   │
│  │           Gin Router (/api/*)                             │   │
│  │                                                        │   │
│  │  ┌─────────┐  ┌──────────────┐  ┌──────────────────┐   │   │
│  │  │  entry   │  │ roundrobin   │  │    schedule      │   │   │
│  │  │ Service  │  │  Service     │  │    Service       │   │   │
│  │  └────┬────┘  └──────┬───────┘  └────────┬─────────┘   │   │
│  │       │              │                    │              │   │
│  │  ┌────▼────┐  ┌──────▼───────┐  ┌────────▼─────────┐   │   │
│  │  │ endpoint │  │  endpoint    │  │   endpoint       │   │   │
│  │  │ /entry/ │  │ /roundrobin/ │  │  /schedule/      │   │   │
│  │  │ internal│  │  internal    │  │   internal       │   │   │
│  │  └────┬────┘  └──────┬───────┘  └────────┬─────────┘   │   │
│  └───────┼──────────────┼────────────────────┼─────────────┘   │
│          │              │                    │                  │
│  ┌───────▼──────────────▼────────────────────▼─────────────┐   │
│  │                    model/                                │   │
│  │         (Tournament, Category, Entry, Match, etc.)       │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         │                                       │
│  ┌──────────────────────▼───────────────────────────────────┐   │
│  │                   utils/                                  │   │
│  │     color, excelhelper, list, pointer                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Backend (Go)

### Framework & Libraries

| Library | Purpose |
|---|---|
| `gin-gonic/gin` | HTTP router & middleware |
| `soulteary/gin-static` | Serve embedded SPA static files |
| `xuri/excelize/v2` | Read/write Excel (.xlsx) files |
| `tealeg/xlsx/v3` | Alternative Excel library (used for round-robin chart generation) |
| `stretchr/testify` | Test assertions |

### Entry Point: `cmd/main.go`

- Initializes structured JSON logging via `slog` (info level by default, debug when `GIN_MODE=debug`).
- Sets up Gin router with `/api` route group.
- Serves embedded Vue SPA on all non-API routes via `gin-static`.
- Starts HTTP server on `:8082` with graceful shutdown (SIGINT/SIGTERM, 5s timeout).

### Directory Structure

```
cmd/                  Application entry point (main.go, log.go)
model/                Shared domain models
  model.go            Core types: Tournament, Category, Entry, Match, Group, Player
  schedule.go         Schedule & TimeSlot types for match scheduling
endpoint/             HTTP handlers organized by domain
  iowriter.go         IoWriter interface abstraction for Excel output
  entry/              Entry import endpoints
    entry.go          Service & Gin handlers for importSingles/Doubles/Team
    internal/
      singles.go      Parse singles entries from Excel
      doubles.go      Parse doubles entries from Excel (2-sheet format)
      team.go         Parse team entries from Excel (2-sheet format)
  roundrobin/         Round-robin chart export
    roundrobin.go     Service & handler
    internal/chart.go Build round-robin chart Excel workbook
  schedule/           Schedule management endpoints
    schedule.go       Service & handlers for draft/final/scoresheet/generate rounds
    internal/
      generate_rounds.go  Round-robin & knockout round generation algorithms
      draft_schedule.go   Draft schedule creation (time-slot scheduling + Excel export)
      final_schedule.go   Import final schedule from edited Excel
      export_scoresheet.go Per-match scoresheet generation with template substitution
utils/                Shared utilities
  color/color.go      HSL-based color generation for Excel category color-coding
  excelhelper/excel.go Cell address parsing (e.g., "AC21" → row 21, col "AC")
  list/list.go        Generic doubly-linked list (not currently used in production)
  pointer/pointer.go  Generic pointer helpers (Of, OrNil, Nil)
  generate_mock_excel.go  Test utility for generating mock Excel data
testdata/             Test fixtures
  tournament.json     Sample tournament structure for tests
  *.xlsx              Sample Excel files for import testing
web/                  Vue 3 frontend (built to web/dist/)
  static.go           Go embed directive for dist/
```

### Design Patterns

- **Service-per-domain**: Each API domain (`entry`, `roundrobin`, `schedule`) has a `Service` struct implementing Gin handler methods.
- **Internal packages**: Implementation details are hidden in `internal/` subdirectories, exposing only clean handler functions.
- **IoWriter interface**: Abstraction over Excel writing (both `excelize.File` and `tealeg/xlsx.File` implement it) for polymorphic Excel output.
- **Embedded SPA**: The compiled Vue frontend is embedded into the Go binary via `//go:embed all:dist`, enabling single-binary deployment.

### Key Algorithms

#### Round-Robin Scheduling (`generate_rounds.go`)
- **Circle method**: Player 0 is fixed; other players rotate with a bounce/reflection algorithm at boundaries.
- Handles odd player counts via a virtual "bye" entry.
- Validates round consistency (match counts, matches per round).

#### Knockout Bracket Generation (`generate_rounds.go`)
- Computes `next power of 2` to determine bracket size.
- Calculates byes and first-round match count.
- Creates placeholder match slots for all rounds down to the final.

#### Match Scheduling (`draft_schedule.go`)
- **Greedy time-slot allocation**: Matches are assigned to time slots across tables. When a table is occupied in a slot, the match moves to the next slot.
- Group stage matches from different groups are interleaved across tables for variety.
- Categories are scheduled sequentially (all group stages, then all knockout stages).

#### Draw Algorithm (Frontend `draw.ts`)
- Weighted random with seeding priority.
- Zigzag group-traversal pattern for even distribution.
- Club separation constraint (best-effort).

---

## Frontend (Vue 3)

### Tech Stack

| Library | Purpose |
|---|---|
| Vue 3 (Composition API) | UI framework |
| Pinia | State management (used via ref in store) |
| Vue Router | Client-side routing (hash history) |
| UnoCSS | Utility-first CSS |
| TypeScript | Type safety |
| PapaParse | CSV parsing (available as dependency) |
| Vite | Build tooling |
| vue-devtools | Development debugging |

### Directory Structure

```
web/src/
  App.vue              Root component (RouterView)
  main.ts              App bootstrap
  router/index.ts      Route definitions
  store/state.ts       Global reactive tournament state (Pinia ref)
  client/client.ts     API client functions (fetch wrappers)
  types/types.ts       TypeScript types mirroring Go models
  views/
    HomeView.vue       Landing page (Import / Create New)
    TournamentView.vue Main tournament management page
    MatchesView.vue    Per-category matches view
    ScheduleView.vue   Schedule view (placeholder)
  components/
    CategoryCard.vue   Category configuration + import + draw trigger
    TournamentInfo.vue Tournament-level settings (name, tables, start time)
    TournamentDraw.vue Interactive draw visualization
    TournamentDraw.vue Groups + knockout tabs
    PlayersChooser.vue  Manual player-to-group assignment
    GroupMatchesTab.vue Group stage match display
    KnockoutMatchesTab.vue Knockout bracket display
  widgets/             Reusable UI primitives
    DropdownMenu.vue, MenuItem.vue, ModalDialog.vue
    GridTable.vue, LabeledInput.vue, LabeledSelect.vue
    OutlinedButton.vue, OutlinedInput.vue, SimpleButton.vue
  calculator/          Pure business logic (no Vue dependencies)
    draw.ts            Draw algorithm (weighted random + club separation)
    groups.ts          Group calculation, empty-group helpers
    schedule.ts        Final schedule import/merge logic
    tournament.ts      Tournament JSON export/import helpers
    date.ts            Date formatting utilities
    player_display.ts  Player display name formatting
```

### State Management

- Uses a **single reactive `ref<Tournament>`** exported from `store/state.ts`.
- No complex Pinia store setup — the tournament state is a plain reactive object.
- The `injectEntriesTournament` function ensures that plain JSON objects from the API are converted back into `Entry` class instances (preserving the `name` getter).

### Routing

| Path | Component | Description |
|---|---|---|
| `/tournament` | `TournamentView.vue` | Main tournament editor |
| `/tournament/matches/:shortName` | `MatchesView.vue` | Matches detail for a category (with guard) |

Uses **hash-based routing** (`createWebHashHistory`) — compatible with the embedded SPA setup where all non-API routes serve `index.html`.

### Frontend–Backend Communication

All API calls go through `client/client.ts` using the native `fetch` API:
- **JSON body** for tournament data (generate rounds, export schedules).
- **FormData** for file uploads (import entries, import final schedule, scoresheet template).
- **Blob responses** for Excel file downloads (trigger browser file save via `URL.createObjectURL`).
- Client-side validation (`validTournament`) checks for duplicate categories, empty short names, missing durations, etc. before sending requests.

---

## Build & Development

### Backend

```bash
# Run with hot reload (via air)
air

# Direct build
go build -o ./tmp/main ./cmd
GIN_MODE=debug ./tmp/main
```

- `.air.toml` configures hot reload for `.go` files (excludes `web/`, `testdata/`).
- Debug mode sets `slog` to debug level.

### Frontend

```bash
cd web
bun install        # or npm install
bun run dev        # Vite dev server
bun run build      # Builds to web/dist/ (required before Go build)
```

The Go binary must be rebuilt after frontend changes to pick up the new `dist/` files via `embed.FS`.

---

## Deployment

The application compiles to a **single Go binary** containing both the backend API and the frontend SPA. Deployment consists of:

1. Build the frontend (`cd web && bun run build`)
2. Build the Go binary (`go build -o tournament-manager ./cmd`)
3. Run the binary (`./tournament-manager`)

No database, no external dependencies, no reverse proxy required.
