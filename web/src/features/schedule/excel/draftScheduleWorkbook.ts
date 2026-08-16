/**
 * Port of endpoint/schedule/internal/draft_schedule.go — `CreateDraftSchedule`
 * and all `populate*` functions. Builds an ExcelJS Workbook with sheets:
 *
 * - `schedule` — time-slot × table grid with color-coded match cells. Each
 *   cell's value is the matches-sheet SN, hidden behind a custom number
 *   format that renders the match name.
 * - `matches` — one row per match (SN, Category, Round, Group, KO Round,
 *   Match, Date/Time, Table, EntryID1, EntryID2). Sheet-protected with the
 *   hardcoded password.
 * - `Tournament Info` — tournament metadata + category details table.
 * - `entries_<shortName>` — per-category entry sheets.
 *
 * Key porting decisions:
 * - Column access uses numeric indices (`getCell(row, col)`) to avoid the
 *   Go code's single-letter column limitation (cell++ past 'Z').
 * - No "Sheet1" to delete (ExcelJS starts with zero worksheets).
 * - ARGB colors: ExcelJS uses 8-digit ARGB; Go's `#RRGGBB` → `'FF' + hex`.
 * - `Match.Name()` display text ported faithfully.
 * - ExcelJS writes internal hyperlinks with a bogus External relationship
 *   (Excel: "Cannot open the specified file"); `workbookToBuffer` heals the
 *   buffer via `fixInternalHyperlinks` — see shared/excel/internalHyperlinks.
 */

import ExcelJS from 'exceljs'
import { fixInternalHyperlinks } from '@/shared/excel/internalHyperlinks'
import type { Tournament, Player } from '@/shared/model'
import { type Schedule, type ScheduledMatch, maxTableCount } from '../domain/scheduleMatches'
import { generateColors, ColorMode } from './color'

// ---------------------------------------------------------------------------
// Constants — mirror draft_schedule.go
// ---------------------------------------------------------------------------

const MATCHES_SHEET_PASSWORD = '12345654321'
const SCHEDULE_SHEET = 'schedule'
const MATCHES_SHEET = 'matches'
const TOURNAMENT_INFO_SHEET = 'Tournament Info'

function categoryEntriesSheetName(shortName: string): string {
  return `entries_${shortName}`
}

// ---------------------------------------------------------------------------
// Match display name — port of model.Match.Name()
// ---------------------------------------------------------------------------

export function matchName(match: ScheduledMatch): string {
  if (match.groupIdx < 0) {
    // Knockout
    switch (match.round) {
      case 2:
        return `${match.categoryShortName} F`
      case 4:
        return `${match.categoryShortName} SF`
      case 8:
        return `${match.categoryShortName} QF`
    }
    return `${match.categoryShortName} R${match.round}`
  }
  return `${match.categoryShortName} Grp${match.groupIdx + 1}`
}

// ---------------------------------------------------------------------------
// Color map — port of generateCategoryGroupColorMap
// ---------------------------------------------------------------------------

export function generateCategoryGroupColorMap(tournament: Tournament): Map<string, string> {
  const colours = generateColors(tournament.categories.length, ColorMode.Light)
  const colorMap = new Map<string, string>()
  tournament.categories.forEach((cat, i) => {
    colorMap.set(cat.shortName, colours[i])
  })
  return colorMap
}

// ---------------------------------------------------------------------------
// Style builders
// ---------------------------------------------------------------------------

const BLACK_BORDER = {
  top: { style: 'thin' as const, color: { argb: 'FF000000' } },
  bottom: { style: 'thin' as const, color: { argb: 'FF000000' } },
  left: { style: 'thin' as const, color: { argb: 'FF000000' } },
  right: { style: 'thin' as const, color: { argb: 'FF000000' } }
}

function headerStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } },
    border: BLACK_BORDER
  }
}

function dateTimeStyle(): Partial<ExcelJS.Style> {
  return {
    numFmt: 'm/d/yyyy h:mm', // Excel built-in format 22
    font: { bold: true },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } },
    border: BLACK_BORDER
  }
}

function matchStyle(hexColor: string, displayName: string): Partial<ExcelJS.Style> {
  // hexColor is "#RRGGBB"; ExcelJS needs "FFRRGGBB" (ARGB with alpha)
  const argb = 'FF' + hexColor.substring(1)
  return {
    // A quoted literal in a format code renders verbatim, whatever the
    // value — so the grid shows the display name while the cell's value
    // stays the numeric SN. `"` inside a literal is escaped by doubling.
    numFmt: `"${displayName.replace(/"/g, '""')}"`,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb } },
    border: BLACK_BORDER,
    alignment: { horizontal: 'center' }
  }
}

// ---------------------------------------------------------------------------
// Populate schedule + matches sheets — port of populateSchedule
// ---------------------------------------------------------------------------

function populateSchedule(
  ws: ExcelJS.Worksheet,
  wm: ExcelJS.Worksheet,
  schedule: Schedule,
  colorMap: Map<string, string>
): void {
  const tableCount = maxTableCount(schedule)
  const dtStyle = dateTimeStyle()
  const hdrStyle = headerStyle()

  // --- Schedule header ---
  ws.getCell(1, 1).value = 'Date/Time'
  for (let i = 0; i < tableCount; i++) {
    ws.getCell(1, i + 2).value = `T${i + 1}`
  }
  // Apply header style to schedule header row (centered, matching the cells)
  const centeredHdrStyle: Partial<ExcelJS.Style> = {
    ...hdrStyle,
    alignment: { horizontal: 'center' }
  }
  for (let c = 1; c <= tableCount + 1; c++) {
    Object.assign(ws.getCell(1, c), { style: centeredHdrStyle })
  }

  // --- Matches header ---
  const matchHeaders = [
    'SN',
    'Category',
    'Round',
    'Group',
    'KO Round',
    'Match',
    'Date Time',
    'Table',
    'EntryID1',
    'EntryID2'
  ]
  matchHeaders.forEach((h, i) => {
    const cell = wm.getCell(1, i + 1)
    cell.value = h
    Object.assign(cell, { style: hdrStyle })
  })

  // --- Populate data ---
  let sn = 1
  let matchesRow = 2

  schedule.timeSlots.forEach((slot, slotIdx) => {
    const { start } = slotStartTimeAndDuration(slot)
    // Schedule datetime cell
    const dtCell = ws.getCell(slotIdx + 2, 1)
    dtCell.value = start
    Object.assign(dtCell, { style: dtStyle })

    slot.tables.forEach((match, tableIdx) => {
      if (match === null) return

      // Matches sheet row
      const matchSN = sn
      wm.getCell(matchesRow, 1).value = matchSN
      sn++
      wm.getCell(matchesRow, 2).value = match.categoryShortName
      if (match.groupIdx >= 0) {
        // Group match
        wm.getCell(matchesRow, 3).value = match.roundIdx + 1
        wm.getCell(matchesRow, 4).value = match.groupIdx + 1
      } else {
        // Knockout match
        wm.getCell(matchesRow, 5).value = match.round
        wm.getCell(matchesRow, 6).value = match.matchIdx + 1
      }
      wm.getCell(matchesRow, 7).value = match.dateTime
      Object.assign(wm.getCell(matchesRow, 7), { style: dtStyle })
      wm.getCell(matchesRow, 8).value = match.table
      if (match.entry1Idx >= 0 && match.entry2Idx >= 0) {
        wm.getCell(matchesRow, 9).value = match.entry1Idx + 1
        wm.getCell(matchesRow, 10).value = match.entry2Idx + 1
      }
      matchesRow++

      // Schedule cell — the SN just written to the matches sheet is the
      // value; the display name renders through the number format. Referees
      // build the final schedule by shifting cells around: cut/paste moves
      // value and format together, so the identity travels with the cell.
      const matchCell = ws.getCell(slotIdx + 2, tableIdx + 2)
      matchCell.value = matchSN
      Object.assign(matchCell, {
        style: matchStyle(colorMap.get(match.categoryShortName) ?? '#FFFFFF', matchName(match))
      })
    })
  })

  // Presentation: freeze header row + datetime column, readable table
  // column widths, and borders on empty grid cells so the schedule reads
  // as a complete matrix with obvious free slots
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]
  for (let c = 2; c <= tableCount + 1; c++) {
    ws.getColumn(c).width = 14
  }

  // Typing over a match cell replaces its SN and silently breaks the
  // final-schedule import — a custom rule of constant FALSE rejects every
  // typed entry, numbers included (blank clears stay allowed). Cut/paste
  // (how referees assemble the final schedule) bypasses validation, which
  // sheet protection would forbid outright.
  const matchGridValidation: ExcelJS.DataValidation = {
    type: 'custom',
    formulae: ['FALSE'],
    allowBlank: true,
    showErrorMessage: true,
    errorTitle: 'Match cells: move, don\'t retype',
    error:
      'Match cells can\'t be edited - move them with cut & paste (Ctrl+X / Ctrl+V). ' +
      'Editing breaks the final-schedule import.'
  }
  for (let r = 2; r <= schedule.timeSlots.length + 1; r++) {
    for (let c = 2; c <= tableCount + 1; c++) {
      const cell = ws.getCell(r, c)
      cell.dataValidation = matchGridValidation
      if (cell.value === null) {
        Object.assign(cell, { style: { border: BLACK_BORDER } })
      }
    }
  }

  // Column widths
  ws.getColumn(1).width = 16
  wm.getColumn(7).width = 16 // Date Time
  wm.getColumn(9).width = 15 // EntryID1
  wm.getColumn(10).width = 15 // EntryID2
  wm.getColumn(2).width = 15 // Category

  // Protect matches sheet
  wm.protect(MATCHES_SHEET_PASSWORD, {
    selectLockedCells: true,
    selectUnlockedCells: true
  })
}

/** Port of model.TimeSlot.StartTimeAndDuration */
function slotStartTimeAndDuration(slot: { tables: (ScheduledMatch | null)[] }): {
  start: Date
  duration: number
} {
  let start = new Date(Date.UTC(3000, 0, 1, 0, 0, 0))
  let duration = 0
  for (const match of slot.tables) {
    if (match === null) continue
    if (match.dateTime.getTime() < start.getTime()) {
      start = match.dateTime
    }
    if (match.durationMinutes > duration) {
      duration = match.durationMinutes
    }
  }
  return { start, duration }
}

// ---------------------------------------------------------------------------
// Populate Tournament Info sheet — port of populateTournamentInfoSheet
// ---------------------------------------------------------------------------

function populateTournamentInfoSheet(wi: ExcelJS.Worksheet, tournament: Tournament): void {
  const hdrStyle = headerStyle()
  const dtStyle = dateTimeStyle()

  let row = 1

  // Tournament Details
  wi.getCell(row, 1).value = 'Tournament Name'
  wi.getCell(row, 2).value = tournament.name
  row++
  wi.getCell(row, 1).value = 'Number of Tables'
  wi.getCell(row, 2).value = tournament.numTables
  row++
  wi.getCell(row, 1).value = 'Start Time'
  // Parse as UTC (matching Go's time.Parse behavior)
  const startDate = new Date(tournament.startTime + 'Z')
  wi.getCell(row, 2).value = startDate
  Object.assign(wi.getCell(row, 2), { style: dtStyle })
  row += 2 // blank row

  // Category Details Header
  const categoryHeaders = [
    'Category Name',
    'Short Name',
    'Entry Type',
    'Duration (Mins)',
    'Entries/Grp Main',
    'Entries/Grp Remainder',
    'Qualified/Group',
    'Min Players/Entry',
    'Max Players/Entry'
  ]
  categoryHeaders.forEach((h, i) => {
    const cell = wi.getCell(row, i + 1)
    cell.value = h
    Object.assign(cell, { style: hdrStyle })
  })
  row++

  // Category Details Data
  for (const category of tournament.categories) {
    wi.getCell(row, 1).value = category.name
    wi.getCell(row, 2).value = category.shortName
    wi.getCell(row, 3).value = category.entryType
    wi.getCell(row, 4).value = category.durationMinutes
    wi.getCell(row, 5).value = category.entriesPerGrpMain
    wi.getCell(row, 6).value = category.entriesPerGrpRemainder
    wi.getCell(row, 7).value = category.numQualifiedPerGroup
    if (category.minPlayers != null) {
      wi.getCell(row, 8).value = category.minPlayers
    }
    if (category.maxPlayers != null) {
      wi.getCell(row, 9).value = category.maxPlayers
    }
    row++
  }

  // Column widths
  for (let c = 1; c <= 3; c++) wi.getColumn(c).width = 20
  for (let c = 4; c <= 9; c++) wi.getColumn(c).width = 18
}

// ---------------------------------------------------------------------------
// Populate category entry sheets — port of populateCategoryEntrySheets
// ---------------------------------------------------------------------------

function populateCategoryEntrySheets(wb: ExcelJS.Workbook, tournament: Tournament): void {
  const hdrStyle = headerStyle()

  for (const category of tournament.categories) {
    const sheetName = categoryEntriesSheetName(category.shortName)
    const ws = wb.addWorksheet(sheetName)

    // Headers
    const entryHeaders = [
      'Entry ID',
      'Team Name',
      'Seeding',
      'Club',
      'Player SN',
      'Player Name',
      'Player DOB',
      'Player Gender'
    ]
    entryHeaders.forEach((h, i) => {
      const cell = ws.getCell(1, i + 1)
      cell.value = h
      Object.assign(cell, { style: hdrStyle })
    })

    // Data
    let row = 2
    let playerSN = 1
    for (let entryIdx = 0; entryIdx < category.entries.length; entryIdx++) {
      const entry = category.entries[entryIdx]
      let players: Player[] = []
      let teamName = ''

      if (entry.singlesEntry) {
        players = [entry.singlesEntry.player]
      } else if (entry.doublesEntry) {
        players = entry.doublesEntry.players.slice()
      } else if (entry.teamEntry) {
        players = entry.teamEntry.players
        teamName = entry.teamEntry.teamName
      }

      for (const player of players) {
        ws.getCell(row, 1).value = entryIdx + 1
        ws.getCell(row, 2).value = teamName
        if (entry.seeding != null && entry.seeding !== 0) {
          ws.getCell(row, 3).value = entry.seeding
        }
        if (entry.club != null && entry.club !== '') {
          ws.getCell(row, 4).value = entry.club
        }
        ws.getCell(row, 5).value = playerSN
        ws.getCell(row, 6).value = player.name
        ws.getCell(row, 7).value = player.dateOfBirth
        ws.getCell(row, 8).value = player.gender
        playerSN++
        row++
      }
    }

    // Column widths
    ws.getColumn(1).width = 8
    ws.getColumn(2).width = 20
    ws.getColumn(3).width = 10
    ws.getColumn(4).width = 10
    ws.getColumn(5).width = 10
    ws.getColumn(6).width = 25
    ws.getColumn(7).width = 15
    ws.getColumn(8).width = 15
  }
}

// ---------------------------------------------------------------------------
// Main entry point — port of CreateDraftSchedule
// ---------------------------------------------------------------------------

/**
 * Build the draft schedule workbook.
 *
 * Port of Go's `CreateDraftSchedule(tournament model.Tournament) (*excelize.File, error)`.
 * Takes a pre-computed `Schedule` (from `scheduleMatches`) and a `Tournament`.
 */
export function createDraftScheduleWorkbook(
  tournament: Tournament,
  schedule: Schedule
): ExcelJS.Workbook {
  const colorMap = generateCategoryGroupColorMap(tournament)

  const wb = new ExcelJS.Workbook()

  // Create sheets (no default Sheet1 in ExcelJS)
  const ws = wb.addWorksheet(SCHEDULE_SHEET)
  const wm = wb.addWorksheet(MATCHES_SHEET)

  populateSchedule(ws, wm, schedule, colorMap)
  populateTournamentInfoSheet(wb.addWorksheet(TOURNAMENT_INFO_SHEET), tournament)
  populateCategoryEntrySheets(wb, tournament)

  // Set active tab to schedule (first sheet)
  wb.views = [{ activeTab: 0 } as ExcelJS.WorkbookView]

  return wb
}

/**
 * Serialize workbook to a Buffer (for blob download).
 */
export async function workbookToBuffer(wb: ExcelJS.Workbook): Promise<Uint8Array> {
  const buffer = await wb.xlsx.writeBuffer()
  return fixInternalHyperlinks(new Uint8Array(buffer))
}
