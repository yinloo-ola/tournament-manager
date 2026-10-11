/**
 * Port of endpoint/schedule/internal/final_schedule.go — `ImportFinalSchedule` +
 * `getMatchFromCellAddr` + `formCategoriesGroupsMap` + `formCategoriesKnockoutRoundsMap`.
 *
 * Reads the user-edited `.xlsx` via ExcelJS, identifies the match behind
 * each schedule-grid cell (by the "#SN" suffix in its text, with the
 * interim hidden-prompt, internal-hyperlink and SN-as-value forms from
 * older exports still supported), extracts match metadata, and reconstructs
 * `Record<string, Group[]>` and `Record<string, KnockoutRound[]>`.
 *
 * The existing `calculator/schedule.ts importFinalSchedule()` merges these maps
 * into the tournament — that merge logic is reused unchanged.
 *
 * Key porting decisions:
 * - Works with the **ExcelJS workbook object directly** (not Slice 2's
 *   `readWorkbook`) because hyperlink metadata is needed.
 * - Datetime cells: ExcelJS reads date-formatted cells as JS `Date` objects;
 *   no need for `ExcelDateToTime` conversion (unlike Go's `ParseFloat` approach).
 *   Sub-second serial noise is rounded to whole seconds afterwards — the
 *   `roundToNearestSecond` half of Go's `ExcelDateToTime` that a raw `Date`
 *   read would otherwise skip.
 * - Cell-address parsing uses `splitCellName` from `shared/excel/address.ts`.
 * - Empty int cells default to 0, then `idx - 1 = -1 = EntryEmptyIdx` (bye matches).
 * - ExcelJS's reader drops internal `location` hyperlinks (it only maps ones
 *   with an `r:id`), so schedule links are additionally scraped from the zip
 *   via `readSheetHyperlinks` — see shared/excel/internalHyperlinks.
 */

import ExcelJS from 'exceljs'
import type { Group, KnockoutRound, Match } from '@/shared/model'
import { splitCellName } from '@/shared/excel/address'
import { readSheetHyperlinks } from '@/shared/excel/internalHyperlinks'
import { readSheetValidationPrompts } from '@/shared/excel/validationPrompts'

const SCHEDULE_SHEET = 'schedule'
const MATCHES_SHEET = 'matches'

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

/** Match metadata read from one row of the matches sheet. */
interface MatchMeta {
  sn: number
  category: string
  roundIdx: number
  groupIdx: number
  entry1Idx: number
  entry2Idx: number
  round: number
  matchIdx: number
}

function getMatchFromRow(wm: ExcelJS.Worksheet, row: number): MatchMeta {
  // Read columns: A=SN, B=Category, C=Round, D=Group, E=KO Round,
  //               F=KO Match, I=EntryID1, J=EntryID2
  const sn = getCellInt(wm, row, 1) // A
  const category = getCellStr(wm, row, 2) // B
  const round = getCellInt(wm, row, 3) // C
  const grp = getCellInt(wm, row, 4) // D
  const koRound = getCellInt(wm, row, 5) // E
  const koMatch = getCellInt(wm, row, 6) // F
  const entry1Idx = getCellInt(wm, row, 9) // I
  const entry2Idx = getCellInt(wm, row, 10) // J

  return {
    sn,
    category,
    roundIdx: round - 1,
    groupIdx: grp - 1,
    entry1Idx: entry1Idx - 1,
    entry2Idx: entry2Idx - 1,
    round: koRound,
    matchIdx: koMatch
  }
}

/**
 * Follow a hyperlink like "matches!A5" to the matches sheet and extract
 * the match metadata at that row.
 *
 * Port of Go's `getMatchFromCellAddr(cellAddr string, file *excelize.File)`.
 * Legacy identity: kept for files exported before cells carried "#SN".
 */
function getMatchFromHyperlink(hyperlink: string, wb: ExcelJS.Workbook): MatchMeta | null {
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

  return getMatchFromRow(wm, row)
}

/**
 * Resolve an SN to the matches-sheet row carrying that SN in column A.
 * Legacy identity: the exporter once wrote the SN as every schedule cell's
 * *value*. Exports now carry the SN in a cell note instead; this path
 * stays for files exported in between.
 */
function getMatchBySN(wb: ExcelJS.Workbook, sn: number): MatchMeta | null {
  const wm = wb.getWorksheet(MATCHES_SHEET)
  if (!wm) return null
  for (let row = 2; row <= wm.rowCount; row++) {
    if (getCellInt(wm, row, 1) === sn) return getMatchFromRow(wm, row)
  }
  return null
}

/**
 * Flatten a schedule cell value to its display text — plain strings and
 * rich-text values (the exporter writes the name plus a "#SN" run).
 */
function getCellText(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'richText' in value) {
    return (value as { richText: { text?: string }[] }).richText
      .map((run) => run.text ?? '')
      .join('')
  }
  return ''
}

/**
 * Extract the match SN from a schedule cell's text: the exporter writes
 * "MS Grp1 #12" — the "#SN" suffix is the identity, and being part of the
 * value it survives every cut/paste, drag and re-save Excel can do.
 */
function getSNFromValueSuffix(value: unknown): number | null {
  const match = /#(\d+)\s*$/.exec(getCellText(value))
  return match ? parseInt(match[1], 10) : null
}

/**
 * Extract the match SN from a validation prompt ("12") — the interim
 * exporter hid the SN in a suppressed data-validation prompt.
 */
function getSNFromPrompt(prompt: string | undefined | null): number | null {
  const raw = (prompt ?? '').trim()
  return /^\d+$/.test(raw) ? parseInt(raw, 10) : null
}

// ---------------------------------------------------------------------------
// Group/knockout assembly — port of formCategoriesGroupsMap / formCategoriesKnockoutRoundsMap
// ---------------------------------------------------------------------------

interface ExtractedMatch {
  sn: number
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
    const maxGroupIdx = Math.max(...groupMap.keys())
    const groups: Group[] = new Array(maxGroupIdx + 1)

    for (let g = 0; g <= maxGroupIdx; g++) {
      const roundMap = groupMap.get(g)
      if (!roundMap) {
        // Fill missing group with empty structure (prevents sparse-array crash in merge)
        groups[g] = { entriesIdx: [], rounds: [] }
        continue
      }

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
function formCategoriesKnockoutRoundsMap(
  matches: ExtractedMatch[]
): Record<string, KnockoutRound[]> {
  // categoryMap: category → round → { match, matchIdx }[]
  const categoryMap = new Map<string, Map<number, { match: Match; matchIdx: number }[]>>()

  for (const match of matches) {
    if (!categoryMap.has(match.categoryShortName)) {
      categoryMap.set(match.categoryShortName, new Map())
    }
    const roundMap = categoryMap.get(match.categoryShortName)!
    if (!roundMap.has(match.round)) {
      roundMap.set(match.round, [])
    }
    roundMap.get(match.round)!.push({
      match: {
        entry1Idx: match.entry1Idx,
        entry2Idx: match.entry2Idx,
        datetime: match.dateTime.toISOString(),
        durationMinutes: match.durationMinutes,
        table: match.table
      },
      matchIdx: match.matchIdx
    })
  }

  const result: Record<string, KnockoutRound[]> = {}
  for (const [categoryName, roundMap] of categoryMap) {
    // Sort rounds descending (biggest first)
    const rounds = [...roundMap.keys()].sort((a, b) => b - a)
    const knockoutRounds: KnockoutRound[] = rounds.map((round) => {
      const matchesWithIdx = roundMap.get(round)!
      // Sort matches by matchIdx (matching Go's formCategoriesKnockoutRoundsMap)
      matchesWithIdx.sort((a, b) => a.matchIdx - b.matchIdx)
      return { round, matches: matchesWithIdx.map((m) => m.match) }
    })
    result[categoryName] = knockoutRounds
  }

  return result
}

// ---------------------------------------------------------------------------
// Integrity-check helpers
// ---------------------------------------------------------------------------

/** Deterministic UTC "YYYY-MM-DD HH:mm" for error messages. */
function formatDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
  )
}

/** "Match 5" / "Matches 5 and 17" / "Matches 5, 17 and 23". */
function nameSNs(sns: number[]): string {
  const sorted = [...sns].sort((a, b) => a - b)
  if (sorted.length === 1) return `Match ${sorted[0]}`
  if (sorted.length === 2) return `Matches ${sorted[0]} and ${sorted[1]}`
  return `Matches ${sorted.slice(0, -1).join(', ')} and ${sorted[sorted.length - 1]}`
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
export async function importFinalScheduleFromBuffer(buffer: Uint8Array): Promise<ImportedSchedule> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)

  const ws = wb.getWorksheet(SCHEDULE_SHEET)
  if (!ws) {
    throw new Error(`sheet ${SCHEDULE_SHEET} does not exist`)
  }

  // Internal links written as `location` (older exports, and Excel's own
  // re-save form) are invisible to ExcelJS's reader — scrape them from the
  // zip.
  const hyperlinkByAddress = await readSheetHyperlinks(buffer, SCHEDULE_SHEET)

  // Interim exporters hid the SN in each cell's validation prompt. Excel
  // can save overlapping validation entries after a move (the moved cell's
  // prompted rule plus the destination's plain rule), and ExcelJS's parser
  // resolves overlaps last-wins — which can surface the plain rule and
  // lose the SN. The scraper walks the raw entries in document order and
  // lets the first covering prompt win.
  const promptByAddress = await readSheetValidationPrompts(buffer, SCHEDULE_SHEET)

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

    // A serial written from a JS Date can sit a few milliseconds under the
    // intended time (float noise, or a legacy two-digit-millisecond
    // truncation: 14:59:59.990 for a 15:00 slot). Excel rounds its display,
    // so only the import sees it — round to whole seconds, the equivalent
    // of Go's ExcelDateToTime(serial, roundToNearestSecond=true).
    dateTime = new Date(Math.round(dateTime.getTime() / 1000) * 1000)

    // Scan other columns for match cells
    row.eachCell((cell, colNumber) => {
      if (colNumber === 1) return // skip datetime column
      if (cell.value === null) return

      // Cell identity: the "#SN" suffix in the cell text (this app's
      // exporter — the value is the one thing Excel always moves with the
      // cell), then the interim hidden-prompt form (with prompted entries
      // preferred over overlapping plain rules), then internal hyperlinks
      // (older exports, both the ExcelJS cell form and location-only links
      // after Excel re-saves the file — the scraped map covers those, since
      // ExcelJS's reader drops them), then the SN-as-value form from
      // exports in between
      let extracted: MatchMeta | null = null
      const suffixSN = getSNFromValueSuffix(cell.value)
      if (suffixSN !== null) {
        extracted = getMatchBySN(wb, suffixSN)
      } else {
        const promptSN = getSNFromPrompt(
          promptByAddress.get(cell.address) ?? cell.dataValidation?.prompt
        )
        if (promptSN !== null) {
          extracted = getMatchBySN(wb, promptSN)
        } else if (typeof cell.value === 'object' && 'hyperlink' in cell.value) {
          extracted = getMatchFromHyperlink(
            (cell.value as { hyperlink: string }).hyperlink,
            wb
          )
        } else {
          const link = hyperlinkByAddress.get(cell.address)
          if (link) extracted = getMatchFromHyperlink(link, wb)
          else if (typeof cell.value === 'number' && Number.isInteger(cell.value) && cell.value > 0) {
            extracted = getMatchBySN(wb, cell.value)
          }
        }
      }
      if (extracted) {
        const table = headerMap.get(colNumber) || ''

        matches.push({
          sn: extracted.sn,
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

  // Integrity checks — a damaged schedule must fail loudly here, because
  // the positional merge downstream would silently corrupt match times
  // (duplicates), keep stale draft times (missing group matches), or drop
  // matches outright (missing knockout matches)
  const problems: string[] = []

  const cellCountBySN = new Map<number, number>()
  for (const match of matches) {
    cellCountBySN.set(match.sn, (cellCountBySN.get(match.sn) ?? 0) + 1)
  }
  const duplicates = [...cellCountBySN.entries()]
    .filter(([, count]) => count > 1)
    .map(([sn]) => sn)
  if (duplicates.length > 0) {
    const verb = duplicates.length === 1 ? 'appears' : 'appear'
    problems.push(
      `${nameSNs(duplicates)} ${verb} in more than one cell. ` +
        'Copying a cell duplicates it - cut (Ctrl+X) moves it. Remove the extra copies.'
    )
  }

  const expectedSNs: number[] = []
  const wm = wb.getWorksheet(MATCHES_SHEET)
  if (wm) {
    for (let row = 2; row <= wm.rowCount; row++) {
      const sn = getCellInt(wm, row, 1)
      if (sn > 0) expectedSNs.push(sn)
    }
  }
  const missing = expectedSNs.filter((sn) => !cellCountBySN.has(sn))
  if (missing.length > 0) {
    const verb = missing.length === 1 ? 'has' : 'have'
    problems.push(
      `${nameSNs(missing)} ${verb} no cell in the schedule - ` +
        'every match needs a slot before importing.'
    )
  }

  const booked = new Map<string, { table: string; time: Date; sns: number[] }>()
  for (const match of matches) {
    if (!match.table) continue
    const key = `${match.table}|${match.dateTime.getTime()}`
    const entry = booked.get(key) ?? { table: match.table, time: match.dateTime, sns: [] }
    entry.sns.push(match.sn)
    booked.set(key, entry)
  }
  for (const booking of booked.values()) {
    if (booking.sns.length > 1) {
      problems.push(
        `Table ${booking.table} is double-booked at ${formatDateTime(booking.time)} ` +
          `(${nameSNs(booking.sns).toLowerCase()}).`
      )
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `This schedule can't be imported - ${problems.length} ` +
        `problem${problems.length === 1 ? '' : 's'} found. ${problems.join(' ')}`
    )
  }

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
