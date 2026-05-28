# Tournament Manager — Functionality Documentation

## Overview

Tournament Manager is a full-stack web application for managing competitive tournaments. It supports **Singles**, **Doubles**, and **Team** event formats with round-robin group stages followed by single-elimination knockout rounds. The application handles the complete tournament lifecycle: entry registration, draw/seed allocation, match scheduling, and export of professional documents (charts, schedules, scoresheets).

---

## Core Features

### 1. Tournament Configuration

- Define a tournament with a **name**, **start time**, and **number of available tables**.
- Add multiple categories (e.g., "Men's Singles", "Women's Doubles", "Men's Team").
- Each category is configured with:
  - **Entry Type**: Singles, Doubles, or Team.
  - **Name & Short Name**: Human-readable and abbreviated identifiers (e.g., "MS", "MD", "MT").
  - **Match Duration**: In minutes (used for scheduling).
  - **Entries Per Group (Main & Remainder)**: Controls group sizes when players don't divide evenly. The main count and remainder count must differ by exactly 1.
  - **Qualifying Entries Per Group**: How many entries advance from each group to the knockout stage.
  - **Min/Max Players (Team only)**: For team events, sets the valid range of players per team.
- Save/load the full tournament state as a JSON file.

### 2. Entry Import

Entries (players, pairs, or teams) are imported from Excel files (.xlsx):

| Entry Type | Excel Structure | Required Columns |
|---|---|---|
| **Singles** | Single sheet named `entries` | SN, Name, Club, Seeding, Date Of Birth, Gender |
| **Doubles** | Two sheets: `entries` and `players` | `entries`: SN, Player1, Player2, Club, Seeding. `players`: SN, Name, Date Of Birth, Gender |
| **Team** | Two sheets: `entries` and `players` | `entries`: SN, Team Name, Club, Seeding. `players`: SN, Name, Date Of Birth, Gender, Team (maps players to teams) |

The server parses the Excel file and returns structured `Entry` objects to the frontend. Team entries validate that player counts fall within the configured min/max range.

### 3. Draw & Group Allocation

The draw process assigns imported entries to groups using a weighted random algorithm:

1. **Seeded entries** receive a higher weight (seeding value + random factor).
2. **Non-seeded entries** receive a lower weight (random factor only).
3. Entries are drawn in a **zigzag pattern** across groups — even positions go top-to-bottom, odd positions go bottom-to-top — to ensure even distribution.
4. **Club separation** is enforced when possible: the algorithm avoids placing two entries from the same club in the same group, falling back only when unavoidable.
5. The draw runs with an animation delay so the user can watch the process unfold in real-time.
6. Manual clearing and re-drawing is supported.

After the draw completes, the frontend calls the backend to **generate round-robin rounds** and **knockout bracket structure**.

### 4. Round Generation

#### Group Stage (Round-Robin)

- Each group produces a full round-robin schedule where every entry plays every other entry once.
- Uses a **circle/Berger tables algorithm** — player 0 stays fixed while others rotate.
- Odd-numbered groups receive a virtual "bye" entry (index -2) to pad to even.
- The match between the 2nd and 3rd seeded players is automatically swapped to the last round (to create a climactic final group match).

#### Knockout Stage (Single Elimination)

- The number of qualifiers is `numGroups × numQualifiedPerGroup`.
- Rounds are sized to the **next power of 2**, with byes distributed in the first round.
- Round naming follows standard convention: Final (2), Semi-Final (4), Quarter-Final (8), etc.
- All match slots are initialized with empty placeholders (entry index -1) to be filled in later.

### 5. Match Scheduling (Draft Schedule)

The backend generates a **time-slotted draft schedule**:

1. **Group stage matches** are scheduled first across all categories, one category at a time.
2. Within each category, matches from different groups are **interleaved across tables** (match 1 of group A on table 1, match 1 of group B on table 2, etc.), cycling through available tables.
3. **Knockout matches** follow after all group stages are complete.
4. Each time slot holds one match per table. Matches are placed greedily — each round's worth of concurrent matches fills the available tables.
5. The resulting schedule is exported as a multi-sheet Excel workbook.

### 6. Export: Round-Robin Charts

Generates printable round-robin recording sheets per category:

- One Excel sheet per category (named by short name).
- Each group gets a grid table: rows = entries, columns = opponents, with a diagonal black cell for self-play.
- Includes columns for **Points** and **Position**.
- Styled with headers, borders, and merged title cells.

### 7. Export: Draft Schedule

Generates an Excel workbook with:

| Sheet | Contents |
|---|---|
| **schedule** | A time-slot × table grid showing match names (e.g., "MS Grp1"), color-coded by category, with hyperlinks to the matches sheet. |
| **matches** | A flat table of all matches: SN, Category, Round, Group, KO Round, Match#, Date/Time, Table, Entry ID 1, Entry ID 2. Sheet is password-protected. |
| **Tournament Info** | Summary of tournament name, tables, start time, and a table of all category configurations. |
| **entries_{ShortName}** | Per-category listing of all entries with their players, seeding, club, and date of birth. |

### 8. Import: Final Schedule

After manually editing the draft schedule Excel (rearranging times, tables, etc.), the user can **re-import** it:

1. The backend reads the `schedule` sheet, parses datetime values from cells, and follows hyperlinks back to the `matches` sheet to extract category, group, round, and entry information.
2. Matches are separated into **group matches** and **knockout matches**.
3. Group matches are organized back into the `categoriesGroupsMap` structure, and knockout matches into `categoriesKnockoutRoundsMap`.
4. The frontend merges the imported schedule (date, time, table assignments) back into the tournament state, updating existing match data without overwriting entry assignments.

### 9. Export: Scoresheet with Template

Generates per-match scoresheets by duplicating a **user-provided template Excel file**:

- The template file contains a sheet named after each category's short name (e.g., "MS").
- For every match (group + knockout), the template sheet is duplicated and named: `{ShortName}-Grp{N}-Rd{N}-{Table}` or `{ShortName}-KO-Rd{N}-{MatchNum}`.
- **Placeholder substitution** is performed on every cell:
  - `{{tournament}}` → Tournament name
  - `{{category}}` → Category short name
  - `{{date}}` → Match date
  - `{{time}}` → Match time
  - `{{table}}` → Table number
  - `{{player1}}` / `{{player2}}` → Entry names

---

## Data Flow Summary

```
User creates tournament → Imports entries from Excel → Runs draw → Backend generates rounds
    ↓
Export draft schedule Excel → User manually edits (reorder, adjust times) → Import final schedule
    ↓
Export scoresheets using template → Print and use at the event
```

---

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/importSinglesEntry` | Import singles players from Excel |
| POST | `/api/importDoublesEntry` | Import doubles pairs from Excel |
| POST | `/api/importTeamEntry` | Import teams from Excel (multipart: file + min/max players) |
| POST | `/api/generateRounds` | Generate round-robin + knockout round structure |
| POST | `/api/exportRoundRobinExcel` | Export round-robin chart Excel |
| POST | `/api/exportDraftSchedule` | Export draft schedule Excel |
| POST | `/api/importFinalSchedule` | Import manually edited schedule Excel |
| POST | `/api/exportScoresheetWithTemplate` | Export per-match scoresheets using template |

The frontend SPA is served at all non-API routes via an embedded static build (Go `embed.FS`).
