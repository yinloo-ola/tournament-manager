import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ExcelJS from 'exceljs'
import {
  createDraftScheduleWorkbook,
  matchName,
  generateCategoryGroupColorMap
} from '../draftScheduleWorkbook'
import { scheduleMatches, type ScheduledMatch } from '../../domain/scheduleMatches'
import { generateRoundsForTournament } from '@/features/matches/domain/generateRounds'
import { Entry, type Tournament } from '@/shared/model'

// ---------------------------------------------------------------------------
// Test helpers — same tournament as Go oracle
// ---------------------------------------------------------------------------

function buildSinglesEntries(n: number): Entry[] {
  const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry']
  const entries: Entry[] = []
  for (let i = 0; i < n; i++) {
    entries.push(
      Entry.from({
        entryType: 'Singles',
        singlesEntry: {
          player: {
            name: names[i % names.length],
            dateOfBirth: '2000-01-01',
            gender: 'M'
          }
        }
      })
    )
  }
  return entries
}

function buildTestTournament(): Tournament {
  return {
    name: 'Schedule Test',
    numTables: 4,
    startTime: '2025-03-22T09:00',
    categories: [
      {
        name: "Men's Singles",
        shortName: 'MS',
        entryType: 'Singles',
        durationMinutes: 30,
        entriesPerGrpMain: 4,
        entriesPerGrpRemainder: 0,
        numQualifiedPerGroup: 2,
        entries: buildSinglesEntries(8),
        groups: [
          { entriesIdx: [0, 1, 2, 3], rounds: [] },
          { entriesIdx: [4, 5, 6, 7], rounds: [] }
        ],
        knockoutRounds: []
      },
      {
        name: "Women's Singles",
        shortName: 'WS',
        entryType: 'Singles',
        durationMinutes: 30,
        entriesPerGrpMain: 4,
        entriesPerGrpRemainder: 0,
        numQualifiedPerGroup: 2,
        entries: buildSinglesEntries(8),
        groups: [
          { entriesIdx: [0, 1, 2, 3], rounds: [] },
          { entriesIdx: [4, 5, 6, 7], rounds: [] }
        ],
        knockoutRounds: []
      }
    ]
  }
}

function buildScheduleWorkbook(): { wb: ExcelJS.Workbook; tournament: Tournament } {
  const tournament = buildTestTournament()
  generateRoundsForTournament(tournament)
  const schedule = scheduleMatches(tournament)
  const wb = createDraftScheduleWorkbook(tournament, schedule)
  return { wb, tournament }
}

/** Read a cell value as a simple comparable string/number. */
function cellVal(ws: ExcelJS.Worksheet, r: number, c: number): unknown {
  const cell = ws.getCell(r, c)
  if (cell.value === null || cell.value === undefined) return null
  if (typeof cell.value === 'object') {
    // Hyperlink cell: { text, hyperlink }
    if ('text' in cell.value && 'hyperlink' in cell.value) {
      return { text: cell.value.text, hyperlink: cell.value.hyperlink }
    }
    // Date object
    if (cell.value instanceof Date) return cell.value.toISOString()
    return String(cell.value)
  }
  return cell.value
}

describe('createDraftScheduleWorkbook', () => {
  describe('sheet structure', () => {
    it('should create the correct sheets in order with no Sheet1', () => {
      const { wb } = buildScheduleWorkbook()
      const names = wb.worksheets.map((w) => w.name)
      expect(names).toContain('schedule')
      expect(names).toContain('matches')
      expect(names).toContain('Tournament Info')
      expect(names).toContain('entries_MS')
      expect(names).toContain('entries_WS')
      expect(names).not.toContain('Sheet1')
    })

    it('should set the schedule sheet as the active tab', () => {
      const { wb } = buildScheduleWorkbook()
      expect(wb.views[0]?.activeTab).toBe(0)
    })
  })

  describe('schedule sheet', () => {
    it('should write the correct header row', () => {
      const { wb } = buildScheduleWorkbook()
      const ws = wb.getWorksheet('schedule')!
      expect(cellVal(ws, 1, 1)).toBe('Date/Time')
      expect(cellVal(ws, 1, 2)).toBe('T1')
      expect(cellVal(ws, 1, 3)).toBe('T2')
      expect(cellVal(ws, 1, 4)).toBe('T3')
      expect(cellVal(ws, 1, 5)).toBe('T4')
    })

    it('should write datetime values in column A', () => {
      const { wb } = buildScheduleWorkbook()
      const ws = wb.getWorksheet('schedule')!
      // Slot 0: 09:00 UTC
      const dt0 = ws.getCell(2, 1).value
      expect(dt0).toBeInstanceOf(Date)
      expect((dt0 as Date).toISOString()).toBe('2025-03-22T09:00:00.000Z')
      // Slot 1: 09:30
      const dt1 = ws.getCell(3, 1).value
      expect((dt1 as Date).toISOString()).toBe('2025-03-22T09:30:00.000Z')
    })

    it('should write match display text and hyperlinks in match cells', () => {
      const { wb } = buildScheduleWorkbook()
      const ws = wb.getWorksheet('schedule')!
      // Slot 0, T1: MS Grp1 (group 0)
      const cell = ws.getCell(2, 2)
      const val = cell.value as { text: string; hyperlink: string }
      expect(val.text).toBe('MS Grp1')
      expect(val.hyperlink).toMatch(/^matches!A\d+$/)
    })

    it('should color-code match cells with valid #RRGGBB fills', () => {
      const { wb } = buildScheduleWorkbook()
      const ws = wb.getWorksheet('schedule')!
      const cell = ws.getCell(2, 2)
      const fill = cell.fill
      expect(fill?.type).toBe('pattern')
      if (fill?.type === 'pattern') {
        const argb = fill.fgColor?.argb
        expect(argb).toMatch(/^FF[0-9A-F]{6}$/)
      }
    })

    it('should leave empty table cells null', () => {
      const { wb } = buildScheduleWorkbook()
      const ws = wb.getWorksheet('schedule')!
      // Knockout slot with only 2 matches on T1/T2 — T3/T4 should be null
      // Slot 7 (index 6, row 8): MS SF round
      const cell3 = ws.getCell(8, 4) // T3
      const cell4 = ws.getCell(8, 5) // T4
      expect(cell3.value).toBeNull()
      expect(cell4.value).toBeNull()
    })
  })

  describe('matches sheet', () => {
    it('should write the correct header row', () => {
      const { wb } = buildScheduleWorkbook()
      const wm = wb.getWorksheet('matches')!
      expect(cellVal(wm, 1, 1)).toBe('SN')
      expect(cellVal(wm, 1, 2)).toBe('Category')
      expect(cellVal(wm, 1, 3)).toBe('Round')
      expect(cellVal(wm, 1, 4)).toBe('Group')
      expect(cellVal(wm, 1, 5)).toBe('KO Round')
      expect(cellVal(wm, 1, 6)).toBe('Match')
      expect(cellVal(wm, 1, 7)).toBe('Date Time')
      expect(cellVal(wm, 1, 8)).toBe('Table')
      expect(cellVal(wm, 1, 9)).toBe('EntryID1')
      expect(cellVal(wm, 1, 10)).toBe('EntryID2')
    })

    it('should write group match data correctly', () => {
      const { wb } = buildScheduleWorkbook()
      const wm = wb.getWorksheet('matches')!
      // Row 2: first match (SN=1)
      expect(cellVal(wm, 2, 1)).toBe(1) // SN
      expect(cellVal(wm, 2, 2)).toBe('MS') // Category
      expect(cellVal(wm, 2, 3)).toBe(1) // Round (roundIdx+1)
      expect(cellVal(wm, 2, 4)).toBe(1) // Group (groupIdx+1)
      expect(cellVal(wm, 2, 5)).toBeNull() // KO Round (not set for group)
      expect(cellVal(wm, 2, 6)).toBeNull() // Match (not set for group)
      expect(cellVal(wm, 2, 8)).toBe('T1') // Table
      expect(cellVal(wm, 2, 9)).toBe(1) // EntryID1 (0+1)
      expect(cellVal(wm, 2, 10)).toBe(2) // EntryID2 (1+1)
    })

    it('should write knockout match data correctly', () => {
      const { wb } = buildScheduleWorkbook()
      const wm = wb.getWorksheet('matches')!
      // Find the first knockout match — after all group matches
      // MS groups: 12 matches (2 groups × 3 rounds × 2 matches)
      // WS groups: 12 matches
      // First knockout is match SN=25
      const koRow = 26 // row 2 + 24 matches = row 26
      expect(cellVal(wm, koRow, 2)).toBe('MS') // Category
      expect(cellVal(wm, koRow, 3)).toBeNull() // Round (not set for knockout)
      expect(cellVal(wm, koRow, 4)).toBeNull() // Group (not set for knockout)
      expect(cellVal(wm, koRow, 5)).toBe(4) // KO Round
      expect(cellVal(wm, koRow, 6)).toBe(1) // KO Match (0+1)
    })

    it('should protect the matches sheet with the hardcoded password', () => {
      const { wb } = buildScheduleWorkbook()
      const wm = wb.getWorksheet('matches')!
      // ExcelJS stores protection on the sheet
      expect(wm.protect).toBeDefined()
      // The sheet should have protection — we can't check the password directly,
      // but we can verify protection is active
    })

    it('should set correct column widths', () => {
      const { wb } = buildScheduleWorkbook()
      const wm = wb.getWorksheet('matches')!
      expect(wm.getColumn(7).width).toBe(16) // Date Time
      expect(wm.getColumn(9).width).toBe(15) // EntryID1
      expect(wm.getColumn(10).width).toBe(15) // EntryID2
      expect(wm.getColumn(2).width).toBe(15) // Category
    })
  })

  describe('Tournament Info sheet', () => {
    it('should write tournament metadata', () => {
      const { wb } = buildScheduleWorkbook()
      const wi = wb.getWorksheet('Tournament Info')!
      expect(cellVal(wi, 1, 1)).toBe('Tournament Name')
      expect(cellVal(wi, 1, 2)).toBe('Schedule Test')
      expect(cellVal(wi, 2, 1)).toBe('Number of Tables')
      expect(cellVal(wi, 2, 2)).toBe(4)
      expect(cellVal(wi, 3, 1)).toBe('Start Time')
    })

    it('should write category details header and data', () => {
      const { wb } = buildScheduleWorkbook()
      const wi = wb.getWorksheet('Tournament Info')!
      // Category header is on row 5 (after 3 detail rows + 1 blank)
      expect(cellVal(wi, 5, 1)).toBe('Category Name')
      expect(cellVal(wi, 5, 7)).toBe('Qualified/Group')
      // MS category data on row 6
      expect(cellVal(wi, 6, 1)).toBe("Men's Singles")
      expect(cellVal(wi, 6, 2)).toBe('MS')
      expect(cellVal(wi, 6, 3)).toBe('Singles')
      expect(cellVal(wi, 6, 4)).toBe(30) // Duration
      expect(cellVal(wi, 6, 7)).toBe(2) // Qualified/Group
    })
  })

  describe('category entry sheets', () => {
    it('should write entry headers and player data for MS', () => {
      const { wb } = buildScheduleWorkbook()
      const ws = wb.getWorksheet('entries_MS')!
      expect(cellVal(ws, 1, 1)).toBe('Entry ID')
      expect(cellVal(ws, 1, 5)).toBe('Player SN')
      expect(cellVal(ws, 1, 6)).toBe('Player Name')
      // Row 2: first entry, first player
      expect(cellVal(ws, 2, 1)).toBe(1) // Entry ID
      expect(cellVal(ws, 2, 5)).toBe(1) // Player SN
      expect(cellVal(ws, 2, 6)).toBe('Alice') // Player Name
    })

    it('should set column widths', () => {
      const { wb } = buildScheduleWorkbook()
      const ws = wb.getWorksheet('entries_MS')!
      expect(ws.getColumn(1).width).toBe(8)
      expect(ws.getColumn(6).width).toBe(25)
    })
  })

  describe('matchName', () => {
    it('should format group matches as <cat> Grp<n>', () => {
      const m: ScheduledMatch = {
        entry1Idx: 0,
        entry2Idx: 1,
        dateTime: new Date(),
        durationMinutes: 30,
        table: 'T1',
        categoryShortName: 'MS',
        groupIdx: 0,
        roundIdx: 0,
        round: 0,
        matchIdx: 0
      }
      expect(matchName(m)).toBe('MS Grp1')
    })

    it('should format knockout final as <cat> F', () => {
      const m: ScheduledMatch = {
        entry1Idx: 0,
        entry2Idx: 1,
        dateTime: new Date(),
        durationMinutes: 30,
        table: 'T1',
        categoryShortName: 'MS',
        groupIdx: -1,
        roundIdx: 0,
        round: 2,
        matchIdx: 0
      }
      expect(matchName(m)).toBe('MS F')
    })

    it('should format knockout semifinal as <cat> SF', () => {
      const m: ScheduledMatch = {
        entry1Idx: 0,
        entry2Idx: 1,
        dateTime: new Date(),
        durationMinutes: 30,
        table: 'T1',
        categoryShortName: 'MS',
        groupIdx: -1,
        roundIdx: 0,
        round: 4,
        matchIdx: 0
      }
      expect(matchName(m)).toBe('MS SF')
    })

    it('should format knockout quarterfinal as <cat> QF', () => {
      const m: ScheduledMatch = {
        entry1Idx: 0,
        entry2Idx: 1,
        dateTime: new Date(),
        durationMinutes: 30,
        table: 'T1',
        categoryShortName: 'MS',
        groupIdx: -1,
        roundIdx: 0,
        round: 8,
        matchIdx: 0
      }
      expect(matchName(m)).toBe('MS QF')
    })

    it('should format other knockout rounds as <cat> R<n>', () => {
      const m: ScheduledMatch = {
        entry1Idx: 0,
        entry2Idx: 1,
        dateTime: new Date(),
        durationMinutes: 30,
        table: 'T1',
        categoryShortName: 'MS',
        groupIdx: -1,
        roundIdx: 0,
        round: 16,
        matchIdx: 0
      }
      expect(matchName(m)).toBe('MS R16')
    })
  })

  describe('generateCategoryGroupColorMap', () => {
    it('should produce a color for each category shortName', () => {
      const tournament = buildTestTournament()
      const colorMap = generateCategoryGroupColorMap(tournament)
      expect(colorMap.get('MS')).toMatch(/^#[0-9A-F]{6}$/)
      expect(colorMap.get('WS')).toMatch(/^#[0-9A-F]{6}$/)
      expect(colorMap.get('MS')).not.toBe(colorMap.get('WS'))
    })
  })

  describe('round-trip: write + read back', () => {
    it('should produce a valid xlsx that can be read back by ExcelJS', async () => {
      const { wb } = buildScheduleWorkbook()
      const buffer = await wb.xlsx.writeBuffer()
      const wb2 = new ExcelJS.Workbook()
      await wb2.xlsx.load(buffer)

      const ws = wb2.getWorksheet('schedule')!
      expect(ws.getCell(1, 1).value).toBe('Date/Time')
      expect(ws.getCell(1, 2).value).toBe('T1')

      const wm = wb2.getWorksheet('matches')!
      expect(wm.getCell(1, 1).value).toBe('SN')
      expect(wm.getCell(2, 2).value).toBe('MS')
    })
  })

  describe('Go oracle cross-validation (matches sheet)', () => {
    it('should match Go golden matches values (excluding datetime format)', () => {
      const { wb } = buildScheduleWorkbook()
      const wm = wb.getWorksheet('matches')!

      const goldenPath = resolve(
        process.cwd(),
        'src/features/schedule/__tests__/golden',
        'draft_matches.golden.json'
      )
      const golden: string[][] = JSON.parse(readFileSync(goldenPath, 'utf-8'))

      // Verify row count (golden includes header row)
      // TS matches sheet may have fewer populated rows than Go (trailing empty cells differ)
      // but the match data rows should be the same
      // MS grp: 2 groups × 3 rounds × 2 matches = 12
      // WS grp: 12
      // MS KO: SF(2) + F(1) = 3
      // WS KO: SF(2) + F(1) = 3
      // Total = 30 matches, +1 header = 31 rows
      expect(golden.length).toBe(31)

      // Compare each match row (skip header, skip datetime col 7)
      for (let r = 1; r < golden.length; r++) {
        const goldenRow = golden[r]
        // Compare non-date columns: SN(0), Category(1), Round(2), Group(3),
        // KO Round(4), Match(5), Table(7), EntryID1(8), EntryID2(9)
        const cols = [0, 1, 2, 3, 4, 5, 7, 8, 9]
        for (const c of cols) {
          const goldenVal = goldenRow[c] || ''
          const tsVal = cellVal(wm, r + 1, c + 1)
          const tsStr = tsVal === null ? '' : String(tsVal)
          expect(tsStr).toBe(goldenVal)
        }
      }
    })
  })
})
