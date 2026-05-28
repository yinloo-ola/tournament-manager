# Tournament Manager

## Project Overview

Full-stack tournament management tool for racquet sports. Single Go binary (Gin backend + embedded Vue 3 SPA). Supports Singles, Doubles, and Team events with round-robin group stages followed by single-elimination knockout brackets.

## Tech Stack

- **Backend**: Go 1.23, Gin, excelize/v2, tealeg/xlsx/v3
- **Frontend**: Vue 3 (Composition API), TypeScript, Pinia, UnoCSS, Vite
- **Deployment**: Single binary — Vue app built to `web/dist/` and embedded via `//go:embed`

## Repository Layout

```
cmd/                    → Go entrypoint (main.go, log.go)
model/                  → Shared domain types (Tournament, Category, Entry, Match, Group, Schedule)
endpoint/               → HTTP handlers organized by domain
  iowriter.go           → IoWriter interface for Excel output
  entry/internal/       → Excel→Entry parsers (singles.go, doubles.go, team.go)
  roundrobin/internal/  → Round-robin chart Excel builder
  schedule/internal/    → Round generation, scheduling, scoresheet export, schedule import
utils/                  → color, excelhelper, list, pointer helpers
web/src/
  types/types.ts        → TypeScript types mirroring Go models (keep in sync!)
  store/state.ts        → Single reactive ref<Tournament> (global state)
  client/client.ts      → All API fetch wrappers
  calculator/           → Pure business logic (draw.ts, groups.ts, schedule.ts, date.ts)
  components/           → Page-level Vue components
  widgets/              → Reusable UI primitives
  views/                → Route-level views
```

## Commands

```bash
# Backend (hot reload)
air                                    # uses .air.toml config, runs on :8082

# Frontend
cd web && bun install && bun run dev    # Vite dev server
cd web && bun run build                 # Builds to web/dist/ — MUST rebuild before Go build

# Tests
go test ./...
```

## API Routes (all POST, all under /api)

| Endpoint | Input | Output |
|---|---|---|
| `/api/importSinglesEntry` | multipart file (.xlsx) | JSON Entry[] |
| `/api/importDoublesEntry` | multipart file (.xlsx) | JSON Entry[] |
| `/api/importTeamEntry` | multipart file + minPlayers + maxPlayers | JSON Entry[] |
| `/api/generateRounds` | JSON Tournament | JSON Tournament (with rounds filled) |
| `/api/exportRoundRobinExcel` | JSON Tournament | .xlsx blob |
| `/api/exportDraftSchedule` | JSON Tournament | .xlsx blob |
| `/api/importFinalSchedule` | multipart file (.xlsx) | JSON {categoriesGroupsMap, categoriesKnockoutRoundsMap} |
| `/api/exportScoresheetWithTemplate` | multipart: tournament JSON + template .xlsx | .xlsx blob |

Non-API routes serve the embedded Vue SPA.

## Key Domain Concepts

- **Entry indexing**: 0-based into `Category.Entries[]`. `-1` = empty slot (knockout placeholder). `-2` = virtual bye (round-robin padding).
- **KnockoutRound.Round**: Stores the round *size* (2=Final, 4=SF, 8=QF), not the round number. Array is ordered largest-first.
- **Group rounds**: `Group.Rounds[roundIdx][matchIdx]`. Generated via circle method (player 0 fixed, others rotate with bounce at boundaries).
- **Schedule TimeSlots**: Each slot has N table slots (N = numTables). A table slot is either a `*Match` or `nil` (free).

## Critical Conventions

1. **Two Excel libraries**: `excelize/v2` (used in schedule/, entry/internal/) and `tealeg/xlsx/v3` (used in roundrobin/). Do NOT mix their APIs within a single file.
2. **Type sync**: Go models in `model/model.go` must stay in sync with `web/src/types/types.ts`. JSON tags must match.
3. **Entry deserialization**: After fetching tournament JSON from the API, always call `injectEntriesTournament()` to restore `Entry` class instances (otherwise the `name` getter breaks).
4. **1-based vs 0-based**: Excel files use 1-based row/SN numbering. Internal indices are 0-based. The import code subtracts 1; the export code adds 1.
5. **Logging**: Use `slog` with structured fields: `slog.Info("msg", "key", value)`. Debug level enabled when `GIN_MODE=debug`.
6. **Errors**: Wrap with `fmt.Errorf("context: %w", err)`. Surface to client via `c.AbortWithError()` or JSON error response.
7. **Frontend state**: No Pinia store complexity — single `ref<Tournament>` in `store/state.ts`. Business logic is stateless in `calculator/`.
8. **Style**: UnoCSS utility classes. No custom CSS unless necessary.

## Common Pitfalls

- Modifying the draft schedule Excel format without updating `final_schedule.go` (the import parser depends on hyperlinks and cell layout).
- Forgetting to `bun run build` the frontend before rebuilding the Go binary — the old `dist/` stays embedded.
- Changing `entriesPerGrpMain`/`entriesPerGrpRemainder` after groups are populated — the frontend locks these fields once a draw exists.
- Assuming knockout `Round` is a round number — it's the bracket size.

## Testing

- Test data lives in `testdata/` (tournament.json, sample .xlsx files).
- Use `stretchr/testify` for assertions.
- Round generation logic has detailed unit tests in `generate_rounds_test.go` and `draft_schedule_test.go`.
- Mock Excel generation utility in `utils/generate_mock_excel.go`.
