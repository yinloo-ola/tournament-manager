# Tournament Manager — Functionality Documentation

## Overview

Tournament Manager is a **pure-frontend** web application for managing competitive tournaments. It supports **Singles**, **Doubles**, and **Team** event formats with round-robin group stages followed by single-elimination knockout rounds. The application handles the complete tournament lifecycle: entry registration, draw/seed allocation, match scheduling, and export of professional documents (charts, schedules, scoresheets) — all running entirely in the browser with no server.

---

## Core Features

### 1. Tournament Configuration

- Define a tournament with a **name**, **start time**, and **number of available tables**.
- Add multiple categories (e.g., "Men's Singles", "Women's Doubles", "Men's Team").
- Each category is configured with:
  - **Entry Type**: Singles, Doubles, or Team.
  - **Name & Short Name**: Human-readable and abbreviated identifiers (e.g., "MS", "MD", "MT").
  - **Match Duration**: In minutes (used for scheduling).
  - **Entries Per Group (Main & Remainder)**: Controls group sizes when players don't divide evenly.
  - **Qualifying Entries Per Group**: How many entries advance from each group to the knockout stage.
  - **Min/Max Players (Team only)**: For team events, sets the valid range of players per team.
- Save/load the full tournament state as a `.json` file (File System Access API with IndexedDB autosave for crash recovery).

### 2. Entry Import

Entries (players, pairs, or teams) are imported from Excel files (.xlsx) parsed entirely in-browser via ExcelJS:

| Entry Type | Excel Structure | Required Columns |
|---|---|---|
| **Singles** | Single sheet named `entries` | SN, Name, Club, Seeding, Date Of Birth, Gender |
| **Doubles** | Two sheets: `entries` and `players` | `entries`: SN, Player1, Player2, Club, Seeding. `players`: SN, Name, Date Of Birth, Gender |
| **Team** | Two sheets: `entries` and `players` | `entries`: SN, Team, Club, Seeding. `players`: SN, Name, Date Of Birth, Gender, Team (maps players to teams) |

The browser parses the Excel file and produces structured `Entry` objects.

Every category card offers a **Download template** button beside Import Entries: a static Entry Template workbook for that Entry Type, with headers-only fill-in sheets matching the table above plus a "How to fill" sheet (rules and worked example rows — copied verbatim, they import). The download is named after the category (e.g. `mens-team-entry-template.xlsx`).

Before an importer runs, the upload is pre-validated: it must be a readable .xlsx with the expected sheets, and header labels must match the Entry Template (compared trimmed and case-insensitively — wrong-label files are rejected rather than misread). Data errors fail with row-numbered messages (`Row 7: Seeding '1.5' isn't a whole number.`); duplicate player names and team rosters outside the category's configured min/max range are rejected. Structural failures offer a "Download template" action on their toast.

### 3. Draw & Group Allocation

The draw process assigns imported entries to groups using a weighted random algorithm running client-side:

1. **Seeded entries** receive a higher weight (seeding value + random factor).
2. **Non-seeded entries** receive a lower weight (random factor only).
3. Entries are drawn in a **zigzag pattern** across groups for even distribution.
4. **Club separation** is enforced when possible.
5. The draw runs with an animation delay for real-time visualization.
6. Manual clearing and re-drawing is supported.

After the draw, round-robin rounds and knockout bracket structure are generated synchronously in-browser.

### 4. Round Generation

#### Group Stage (Round-Robin)

- Each group produces a full round-robin schedule where every entry plays every other entry once.
- Uses a **circle/Berger tables algorithm** — player 0 stays fixed while others rotate.
- Odd-numbered groups receive a virtual "bye" entry (index -2) to pad to even.
- The match between the 2nd and 3rd seeded players is automatically swapped to the last round.

#### Knockout Stage (Single Elimination)

- The number of qualifiers is `numGroups × numQualifiedPerGroup`.
- Rounds are sized to the **next power of 2**, with byes distributed in the first round.
- Round naming follows standard convention: Final (2), Semi-Final (4), Quarter-Final (8), etc.

### 5. Match Scheduling (Draft Schedule)

A **time-slotted draft schedule** is generated entirely client-side:

1. **Group stage matches** are scheduled first across all categories, one category at a time.
2. Within each category, matches from different groups are **interleaved across tables**.
3. **Knockout matches** follow after all group stages are complete.
4. Each time slot holds one match per table. Matches are placed greedily.
5. The resulting schedule is exported as a multi-sheet Excel workbook (ExcelJS) → blob download.

### 6. Export: Round-Robin Charts

Generates printable round-robin recording sheets per category (ExcelJS → blob download):

- One Excel sheet per category (named by short name).
- Each group gets a grid table: rows = entries, columns = opponents, with a diagonal black cell for self-play.
- Includes columns for **Points** and **Position**.
- Styled with headers, borders, merged title cells, grey header fill, and fixed column widths.

### 7. Export: Draft Schedule

Generates an Excel workbook (ExcelJS → blob download) with:

| Sheet | Contents |
|---|---|
| **schedule** | A time-slot × table grid showing match names, color-coded by category, with hyperlinks to the matches sheet. |
| **matches** | A flat table of all matches. Sheet is password-protected. |
| **Tournament Info** | Summary of tournament name, tables, start time, and category configurations. |
| **entries_{ShortName}** | Per-category listing of all entries. |

### 8. Import: Final Schedule

After manually editing the draft schedule Excel, the user re-imports it. The browser reads the `.xlsx` (ExcelJS), follows hyperlinks from the schedule grid to the matches sheet, extracts match metadata, and merges date/time/table assignments back into the tournament state.

### 9. Export: Scoresheet with Template

Generates per-match scoresheets by cloning a **user-provided template Excel file** entirely in-browser:

- The template contains a sheet named after each category's short name (e.g., "MS").
- For every match, the template sheet is deep-cloned (values + styles + merges + page setup) and named: `{ShortName}-Grp{N}-Rd{N}-{Table}` or `{ShortName}-KO-Rd{N}-{MatchNum}`.
- **Placeholder substitution**: `{{tournament}}`, `{{category}}`, `{{date}}`, `{{time}}`, `{{table}}`, `{{player1}}`, `{{player2}}` are replaced with match-specific values.

---

## Data Flow Summary

```
User creates tournament → Imports entries from .xlsx (in-browser) → Runs draw (client-side)
    → Generates rounds (synchronous) → Exports draft schedule .xlsx (ExcelJS → download)
    → User edits schedule → Imports final schedule (ExcelJS parse → merge)
    → Exports charts + scoresheets (ExcelJS → download) → Print and use at the event
```

All steps run in the browser. No server, no network calls, no `fetch()`.