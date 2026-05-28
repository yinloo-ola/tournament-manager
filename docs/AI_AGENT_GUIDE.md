# Tournament Manager — AI Agent Guide

## Purpose

This document provides essential context for AI coding agents (e.g., Cursor, Copilot, pi) working on this codebase. It covers domain knowledge, conventions, key files, common pitfalls, and workflow guidance.

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

## Key Concepts for AI Agents

### Entry Indexing

- Entries are referenced by **0-based index** into the `Category.Entries` array.
- **`EntryEmptyIdx = -1`**: A placeholder meaning "no entry assigned yet" (used in knockout bracket slots before results are filled in).
- **`EntryByeIdx = -2`**: A virtual "bye" entry used internally to pad odd-sized groups to even for round-robin scheduling. Bye matches are skipped during round generation.

### Groups & Rounds

- A `Group` contains `EntriesIdx` (indices of entries in the group) and `Rounds` (a 2D array: `[][]Match`).
- `Rounds[roundIdx][matchIdx]` gives a specific match.
- Group round-robin uses a **circle method** where player 0 is fixed and others rotate. The algorithm involves bounce/reflection at boundaries (see `getRoundPlayersIndices`).

### Knockout Rounds

- `KnockoutRound.Round` holds the round size (e.g., 2 = Final, 4 = Semi-Final, 8 = Quarter-Final).
- Rounds are ordered from largest to smallest in the array.
- Matches within each round are ordered by `MatchIdx`.

### Match Metadata

- `GroupIdx >= 0`: Group stage match. `GroupIdx = -1`: Knockout match.
- `CategoryShortName`, `GroupIdx`, `RoundIdx`, `Round`, `MatchIdx` are used for display naming and schedule export but are typically set during scheduling, not stored in the tournament JSON.

---

## Codebase Conventions

### Go Backend

| Convention | Details |
|---|---|
| **Package organization** | Domain packages under `endpoint/` (entry, roundrobin, schedule). Each has a `Service` struct with Gin handler methods. |
| **Internal packages** | Implementation details go in `internal/` subdirectories. Public handler functions in the parent package delegate to internal. |
| **Error handling** | Errors are wrapped with `fmt.Errorf("context: %w", err)` and surfaced via `c.AbortWithError()`. |
| **Logging** | Structured logging via `slog` with JSON handler. Use `slog.Info/Warn/Error/DebugContext`. |
| **Excel libraries** | Two libraries are used: `xuri/excelize/v2` (primary, for import/schedule/scoresheet) and `tealeg/xlsx/v3` (for round-robin chart generation). **Do not mix their APIs.** |
| **IoWriter interface** | `endpoint.IoWriter` (method `Write(io.Writer) error`) abstracts Excel writing. Both Excel libraries implement this interface. |
| **Naming** | File names use `snake_case.go`. Test files end in `_test.go`. |
| **Pointer helpers** | Use `pointer.OrNil(value)` to return nil for zero values, `pointer.Of(value)` to always return a pointer. |
| **Testing** | Tests use `stretchr/testify`. Test data lives in `testdata/`. |

### Vue Frontend

| Convention | Details |
|---|---|
| **Composition API** | All components use `<script setup lang="ts">`. |
| **State** | Single reactive `ref<Tournament>` in `store/state.ts`. No Pinia actions/getters — logic lives in `calculator/` functions. |
| **Types** | TypeScript types in `types/types.ts` mirror Go models. The `Entry` class has a `name` getter that must be preserved after JSON deserialization (use `Entry.from()`). |
| **API client** | All fetch calls are in `client/client.ts`. Use the existing functions; don't make raw fetch calls in components. |
| **Calculator functions** | Pure business logic in `calculator/` — no Vue imports. These are the safest functions to unit test. |
| **Styling** | UnoCSS utility classes. No scoped CSS unless necessary. |
| **Widgets** | Reusable UI primitives in `widgets/`. Components in `components/` are page-level composites. |

---

## Critical Files Reference

| File | Role | AI Agent Notes |
|---|---|---|
| `model/model.go` | Core domain types | **Read this first.** All other code references these types. |
| `model/schedule.go` | Schedule/TimeSlot types | Used by draft schedule generation and export. |
| `endpoint/schedule/internal/generate_rounds.go` | Round-robin + knockout generation | Contains the circle algorithm. Well-commented. Be careful with the bounce/reflection logic. |
| `endpoint/schedule/internal/draft_schedule.go` | Draft schedule + Excel export | Largest file. Handles scheduling algorithm and multi-sheet Excel generation. |
| `endpoint/schedule/internal/final_schedule.go` | Import edited schedule from Excel | Parses hyperlinks and cell values. Delicate parsing logic. |
| `endpoint/schedule/internal/export_scoresheet.go` | Scoresheet template substitution | Simple string replacement of `{{placeholder}}` tokens. |
| `endpoint/entry/internal/*.go` | Entry import parsers | Each reads Excel with specific column layouts. Modify carefully if column order changes. |
| `web/src/types/types.ts` | Frontend type definitions | Must stay in sync with Go models. |
| `web/src/calculator/draw.ts` | Draw algorithm | Complex async logic. Weighted random + club separation. |
| `web/src/calculator/groups.ts` | Group management helpers | State-free utility functions. |
| `web/src/client/client.ts` | API client | Contains `validTournament` validation. |
| `web/src/store/state.ts` | Global state | Single source of truth for the tournament. |

---

## Common Pitfalls

1. **Go/Vue type drift**: When adding fields to `model.Tournament` in Go, also add them to `types/types.ts`. When adding to the frontend types, ensure the Go JSON tags match.

2. **Entry class vs plain object**: After fetching tournament JSON from the API, always call `injectEntriesTournament()` to convert plain objects into `Entry` class instances. Otherwise, the `name` getter won't work.

3. **Two Excel libraries**: `excelize` and `tealeg/xlsx` have very different APIs. Check which file you're editing before writing Excel code.

4. **Entry index confusion**: Entry indices are 0-based within a category's entries array. When reading from Excel (which often uses 1-based SN), remember to adjust. The `getMatchFromCellAddr` function subtracts 1 from entry indices read from the matches sheet.

5. **Schedule import fragility**: The final schedule import (`final_schedule.go`) depends on the Excel file maintaining hyperlinks and a specific cell layout. Changes to the draft schedule export format can break the import.

6. **Knockout round ordering**: KnockoutRounds are ordered largest-round-first (e.g., R16, QF, SF, F). The `Round` field stores the round *size*, not the round number.

7. **Group size constraints**: `entriesPerGrpMain` and `entriesPerGrpRemainder` must differ by exactly 1. The frontend enforces this before allowing a draw.

8. **embedded SPA rebuild**: After any frontend change, you must rebuild the Vue app (`bun run build`) and then rebuild the Go binary for changes to take effect in the single-binary deployment.

---

## Typical AI Agent Tasks

### Adding a new tournament feature
1. Add/update types in `model/model.go`.
2. Update corresponding types in `web/src/types/types.ts`.
3. Add backend logic in the appropriate `endpoint/*/internal/` package.
4. Add a Gin handler method in the corresponding `endpoint/*/` Service.
5. Register the route in `cmd/main.go`.
6. Add an API client function in `web/src/client/client.ts`.
7. Add UI in the appropriate `web/src/components/` or `web/src/views/` file.

### Modifying Excel import/export
1. Check which Excel library the file uses (`excelize` vs `tealeg/xlsx`).
2. Be careful with 1-based vs 0-based indexing (both row/column and entry indices).
3. Test with files in `testdata/`.
4. If modifying the draft schedule export, verify the import still works.

### Adding a new UI component
1. Check if a suitable widget exists in `web/src/widgets/` first.
2. Use Composition API with `<script setup lang="ts">`.
3. Use UnoCSS for styling.
4. Keep business logic in `calculator/`, not in components.

### Fixing a scheduling algorithm bug
1. Read `generate_rounds.go` thoroughly — the circle algorithm has subtle boundary conditions.
2. Check `getOrCreateSlot` and `getOrCreateNextSlot` in `draft_schedule.go` for table allocation logic.
3. Write unit tests in `*_test.go` files using the tournament JSON fixture or construct test data inline.
