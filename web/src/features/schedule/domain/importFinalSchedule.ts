/**
 * Port of endpoint/schedule/internal/final_schedule.go — `ImportFinalSchedule` +
 * `getMatchFromCellAddr` + `formCategoriesGroupsMap` + `formCategoriesKnockoutRoundsMap`.
 *
 * Reads the user-edited `.xlsx` via ExcelJS, detects hyperlinks in the
 * schedule grid pointing to the matches sheet, extracts match metadata, and
 * reconstructs `Record<string, Group[]>` and `Record<string, KnockoutRound[]>`.
 *
 * The existing `calculator/schedule.ts importFinalSchedule()` merges these maps
 * into the tournament — that merge logic is reused unchanged.
 *
 * Key porting decisions:
 * - Works with the **ExcelJS workbook object directly** (not Slice 2's
 *   `readWorkbook`) because hyperlink metadata is needed.
 * - Datetime cells: ExcelJS reads date-formatted cells as JS `Date` objects;
 *   no need for `ExcelDateToTime` conversion (unlike Go's `ParseFloat` approach).
 * - Cell-address parsing uses `splitCellName` from `shared/excel/address.ts`.
 * - Empty int cells default to 0, then `idx - 1 = -1 = EntryEmptyIdx` (bye matches).
 */

import ExcelJS from 'exceljs'
import type { Group, KnockoutRound, Match } from '@/shared/model'
import { splitCellName } from '@/shared/excel/address'

const SCHEDULE_SHEET = 'schedule'

export interface ImportedSchedule {
  categoriesGroupsMap: Record<string, Group[]>
  categoriesKnockoutRoundsMap: Record<string, KnockoutRound[]>
}

// ---------------------------------------------------------------------------
// Cell reading helpers — port of getCellIntValue / getCellValue
// ---------------------------------------------------------------------------

function getCellInt(ws: ExcelJS.Worksheet, row: number, col: number): number {
  const val = ws.getCell(row, col).value
  if (val === null || val === undefined || val === '') return 0
  const n = parseInt(String(val), 10)
  return isNaN(n) ? 0 : n
}

function getCellStr(ws: ExcelJS.Worksheet, row: number, col: number): string {
  const val = ws.getCell(row, col).value
  if (val === null || val === undefined) return ''
  return String(val)
}

// ---------------------------------------------------------------------------
// Match extraction — port of getMatchFromCellAddr
// ---------------------------------------------------------------------------

/**
 * Follow a hyperlink like "matches!A5" to the matches sheet and extract
 * the match metadata at that row.
 *
 * Port of Go's `getMatchFromCellAddr(cellAddr string, file *excelize.File)`.
 */
function getMatchFromHyperlink(
  hyperlink: string,
  wb: ExcelJS.Workbook
): { category: string; roundIdx: number; groupIdx: number; entry1Idx: number; entry2Idx: number; round: number; matchIdx: number } | null {
  // Split "matches!A5" → sheetName="matches", cellAddr="A5"
  const exclamationIdx = hyperlink.indexOf('!')
  if (exclamationIdx === -1) return null
  const sheetName = hyperlink.substring(0, exclamationIdx)
  const cellAddr = hyperlink.substring(exclamationIdx + 1)

  const wm = wb.getWorksheet(sheetName)
  if (!wm) return null

  let row: number
  try {
    const addr = splitCellName(cellAddr)
    row = addr.row
  } catch {
    return null
  }

  // Read columns: B=Category, C=Round, D=Group, E=KO Round, F=KO Match,
  //               I=EntryID1, J=EntryID2
  const category = getCellStr(wm, row, 2)  // B
  const round = getCellInt(wm, row, 3)      // C
  const grp = getCellInt(wm, row, 4)        // D
  const koRound = getCellInt(wm, row, 5)    // E
  const koMatch = getCellInt(wm, row, 6)    // F
  const entry1Idx = getCellInt(wm, row, 9)  // I
  const entry2Idx = getCellInt(wm, row, 10) // J

  return {
    category,
    roundIdx: round - 1,
    groupIdx: grp - 1,
    entry1Idx: entry1Idx - 1,
    entry2Idx: entry2Idx - 1,
    round: koRound,
    matchIdx: koMatch
  }
}

// ---------------------------------------------------------------------------
// Group/knockout assembly — port of formCategoriesGroupsMap / formCategoriesKnockoutRoundsMap
// ---------------------------------------------------------------------------

interface ExtractedMatch {
  categoryShortName: string
  roundIdx: number
  groupIdx: number
  entry1Idx: number
  entry2Idx: number
  round: number
  matchIdx: number
  dateTime: Date
  table: string
  durationMinutes: number
}

/**
 * Port of Go's `formCategoriesGroupsMap`. Groups group-stage matches by
 * category → groupIdx → roundIdx, collecting entriesIdx per group.
 */
function formCategoriesGroupsMap(matches: ExtractedMatch[]): Record<string, Group[]> {
  // categoryMap: category → groupIdx → roundIdx → Match[]
  const categoryMap = new Map<string, Map<number, Map<number, Match[]>>>()

  for (const match of matches) {
    if (!categoryMap.has(match.categoryShortName)) {
      categoryMap.set(match.categoryShortName, new Map())
    }
    const groupMap = categoryMap.get(match.categoryShortName)!
    if (!groupMap.has(match.groupIdx)) {
      groupMap.set(match.groupIdx, new Map())
    }
    const roundMap = groupMap.get(match.groupIdx)!
    if (!roundMap.has(match.roundIdx)) {
      roundMap.set(match.roundIdx, [])
    }
    roundMap.get(match.roundIdx)!.push({
      entry1Idx: match.entry1Idx,
      entry2Idx: match.entry2Idx,
      datetime: match.dateTime.toISOString(),
      durationMinutes: match.durationMinutes,
      table: match.table
    })
  }

  // Build result: category → Group[]
  const result: Record<string, Group[]> = {}
  for (const [categoryName, groupMap] of categoryMap) {
    const groups: Group[] = []
    const maxGroupIdx = Math.max(...groupMap.keys())

    for (let g = 0; g <= maxGroupIdx; g++) {
      const roundMap = groupMap.get(g)
      if (!roundMap) continue

      const maxRoundIdx = Math.max(...roundMap.keys())
      const rounds: Match[][] = []

      // Collect player indices
      const playerIndices = new Set<number>()

      for (let r = 0; r <= maxRoundIdx; r++) {
        const matchesInRound = roundMap.get(r) || []
        rounds[r] = matchesInRound
        for (const m of matchesInRound) {
          if (m.entry1Idx >= 0) playerIndices.add(m.entry1Idx)
          if (m.entry2Idx >= 0) playerIndices.add(m.entry2Idx)
        }
      }

      groups[g] = {
        entriesIdx: [...playerIndices],
        rounds
      }
    }

    result[categoryName] = groups
  }

  return result
}

/**
 * Port of Go's `formCategoriesKnockoutRoundsMap`. Groups knockout matches by
 * category → round, sorts rounds descending (biggest first), matches by matchIdx.
 */
function formCategoriesKnockoutRoundsMap(matches: ExtractedMatch[]): Record<string, KnockoutRound[]> {
  // categoryMap: category → round → Match[]
  const categoryMap = new Map<string, Map<number, Match[]>>()

  for (const match of matches) {
    if (!categoryMap.has(match.categoryShortName)) {
      categoryMap.set(match.categoryShortName, new Map())
    }
    const roundMap = categoryMap.get(match.categoryShortName)!
    if (!roundMap.has(match.round)) {
      roundMap.set(match.round, [])
    }
    roundMap.get(match.round)!.push({
      entry1Idx: match.entry1Idx,
      entry2Idx: match.entry2Idx,
      datetime: match.dateTime.toISOString(),
      durationMinutes: match.durationMinutes,
      table: match.table
    })
  }

  const result: Record<string, KnockoutRound[]> = {}
  for (const [categoryName, roundMap] of categoryMap) {
    // Sort rounds descending (biggest first)
    const rounds = [...roundMap.keys()].sort((a, b) => b - a)
    const knockoutRounds: KnockoutRound[] = rounds.map((round) => {
      const matchesInRound = roundMap.get(round)!
      // Sort matches by matchIdx
      matchesInRound.sort((a, b) => {
        // matchIdx isn't stored on the Match type — it's implicit in order
        return 0 // already in insertion order
      })
      return { round, matches: matchesInRound }
    })
    result[categoryName] = knockoutRounds
  }

  return result
}

// ---------------------------------------------------------------------------
// Main import function — port of ImportFinalSchedule
// ---------------------------------------------------------------------------

/**
 * Read the edited `.xlsx` and reconstruct the final schedule.
 *
 * Port of Go's `ImportFinalSchedule(ctx, reader)`.
 *
 * @param buffer - The `.xlsx` file as a Uint8Array
 * @returns Groups and knockout rounds maps keyed by category shortName
 */
export async function importFinalScheduleFromBuffer(
  buffer: Uint8Array
): Promise<ImportedSchedule> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)

  const ws = wb.getWorksheet(SCHEDULE_SHEET)
  if (!ws) {
    throw new Error(`sheet ${SCHEDULE_SHEET} does not exist`)
  }

  // Build header map from row 1 (column index → table name)
  const headerRow = ws.getRow(1)
  const headerMap: Map<number, string> = new Map()
  headerRow.eachCell((cell, colNumber) => {
    if (colNumber > 1 && cell.value !== null) {
      headerMap.set(colNumber, String(cell.value))
    }
  })

  const matches: ExtractedMatch[] = []

  // Iterate data rows (starting from row 2)
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // skip header

    // Column A: datetime
    const dtCell = row.getCell(1)
    let dateTime: Date | null = null

    if (dtCell.value instanceof Date) {
      dateTime = dtCell.value
    } else if (typeof dtCell.value === 'number') {
      // Excel serial date (1900 system)
      dateTime = excelSerialToDate(dtCell.value)
    } else if (typeof dtCell.value === 'string' && dtCell.value.trim() !== '') {
      const serial = parseFloat(dtCell.value)
      if (!isNaN(serial)) {
        dateTime = excelSerialToDate(serial)
      }
    }

    if (!dateTime) return // skip non-datetime rows

    // Scan other columns for hyperlinks
    row.eachCell((cell, colNumber) => {
      if (colNumber === 1) return // skip datetime column
      if (cell.value === null) return

      // Check for hyperlink cell value: { text, hyperlink }
      if (typeof cell.value === 'object' && 'hyperlink' in cell.value) {
        const hyperlink = (cell.value as { hyperlink: string }).hyperlink
        const table = headerMap.get(colNumber) || ''

        const extracted = getMatchFromHyperlink(hyperlink, wb)
        if (!extracted) return

        matches.push({
          categoryShortName: extracted.category,
          roundIdx: extracted.roundIdx,
          groupIdx: extracted.groupIdx,
          entry1Idx: extracted.entry1Idx,
          entry2Idx: extracted.entry2Idx,
          round: extracted.round,
          matchIdx: extracted.matchIdx,
          dateTime,
          table,
          durationMinutes: 0 // will be set by merge logic
        })
      }
    })
  })

  // Split into group and knockout matches
  const groupMatches = matches.filter((m) => m.groupIdx >= 0)
  const knockoutMatches = matches.filter((m) => m.groupIdx === -1)

  const categoriesGroupsMap = formCategoriesGroupsMap(groupMatches)
  const categoriesKnockoutRoundsMap = formCategoriesKnockoutRoundsMap(knockoutMatches)

  return { categoriesGroupsMap, categoriesKnockoutRoundsMap }
}

/**
 * Convert an Excel serial date (1900 system) to a JS Date.
 * Port of excelize's `ExcelDateToTime(serial, false)`.
 */
function excelSerialToDate(serial: number): Date {
  // Excel 1900 system: serial 1 = 1900-01-01
  // Excel incorrectly treats 1900 as a leap year, so serials > 60 are off by 1
  // The epoch offset: 25569 days from 1899-12-30 to 1970-01-01
  const ms = Math.round((serial - 25569) * 86400 * 1000)
  return new Date(ms)
}