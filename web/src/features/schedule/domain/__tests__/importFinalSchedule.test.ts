import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { importFinalScheduleFromBuffer } from '../importFinalSchedule'
import { createDraftScheduleWorkbook, workbookToBuffer } from '../../excel/draftScheduleWorkbook'
import { scheduleMatches } from '../scheduleMatches'
import { generateRoundsForTournament } from '@/features/matches/domain/generateRounds'
import { Entry, type Tournament } from '@/shared/model'

const headers = [
  'SN', 'Category', 'Round', 'Group', 'KO Round', 'Match',
  'Date Time', 'Table', 'EntryID1', 'EntryID2'
]

// ---------------------------------------------------------------------------
// Test helpers — same tournament as other tests
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

/** Generate a draft xlsx buffer from the test tournament. */
async function generateDraftBuffer(): Promise<{ buffer: Uint8Array; tournament: Tournament }> {
  const tournament = buildTestTournament()
  generateRoundsForTournament(tournament)
  const schedule = scheduleMatches(tournament)
  const wb = createDraftScheduleWorkbook(tournament, schedule)
  const buffer = await workbookToBuffer(wb)
  return { buffer, tournament }
}

describe('importFinalScheduleFromBuffer', () => {
  describe('round-trip (TS export → TS import)', () => {
    it('should extract matches from schedule hyperlinks', async () => {
      const { buffer } = await generateDraftBuffer()
      const result = await importFinalScheduleFromBuffer(buffer)

      // Should have groups for both categories
      expect(result.categoriesGroupsMap.MS).toBeDefined()
      expect(result.categoriesGroupsMap.WS).toBeDefined()
    })

    it('should import every match via the #SN text cells', async () => {
      const { buffer } = await generateDraftBuffer()
      const result = await importFinalScheduleFromBuffer(buffer)

      // 2 categories × 2 groups × 3 rounds × 2 matches = 24 group matches
      const groupMatches = Object.values(result.categoriesGroupsMap)
        .flatMap((groups) => groups)
        .flatMap((group) => group.rounds)
        .flat()
      expect(groupMatches.length).toBe(24)

      // 2 categories × (SF 2 + F 1) = 6 knockout matches
      const knockoutMatches = Object.values(result.categoriesKnockoutRoundsMap)
        .flatMap((rounds) => rounds)
        .flatMap((round) => round.matches)
      expect(knockoutMatches.length).toBe(6)
    })

    it('should assemble group matches into per-category groups with correct structure', async () => {
      const { buffer, tournament } = await generateDraftBuffer()
      const result = await importFinalScheduleFromBuffer(buffer)

      // MS has 2 groups
      const msGroups = result.categoriesGroupsMap.MS
      expect(msGroups.length).toBeGreaterThanOrEqual(2)

      // Each group should have rounds
      for (const group of msGroups) {
        expect(group.rounds.length).toBeGreaterThan(0)
      }
    })

    it('should assemble knockout matches into per-category rounds (descending)', async () => {
      const { buffer } = await generateDraftBuffer()
      const result = await importFinalScheduleFromBuffer(buffer)

      const msKo = result.categoriesKnockoutRoundsMap.MS
      expect(msKo).toBeDefined()
      expect(msKo.length).toBeGreaterThanOrEqual(1)

      // Rounds should be sorted descending (biggest first)
      for (let i = 1; i < msKo.length; i++) {
        expect(msKo[i - 1].round).toBeGreaterThan(msKo[i].round)
      }
    })

    it('should set correct datetime and table on extracted matches', async () => {
      const { buffer } = await generateDraftBuffer()
      const result = await importFinalScheduleFromBuffer(buffer)

      const msGroups = result.categoriesGroupsMap.MS
      // First group, first round, first match
      const firstMatch = msGroups[0].rounds[0][0]
      expect(firstMatch.datetime).toBeTruthy()
      expect(firstMatch.table).toMatch(/^T\d+$/)
    })

    it('should resolve cells whose value is the SN (name shown via number format)', async () => {
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('schedule')
      const wm = wb.addWorksheet('matches')

      headers.forEach((h, i) => (wm.getCell(1, i + 1).value = h))
      ws.getCell(1, 1).value = 'Date/Time'
      ws.getCell(1, 2).value = 'T1'

      wm.getCell(2, 1).value = 1 // SN
      wm.getCell(2, 2).value = 'MS'
      wm.getCell(2, 3).value = 1 // Round
      wm.getCell(2, 4).value = 1 // Group
      wm.getCell(2, 9).value = 3 // EntryID1
      wm.getCell(2, 10).value = 4 // EntryID2

      ws.getCell(2, 1).value = new Date('2025-03-22T09:00:00Z')
      ws.getCell(2, 2).value = 1
      ws.getCell(2, 2).numFmt = '"MS Grp1"'

      const buffer = new Uint8Array(await wb.xlsx.writeBuffer())
      const result = await importFinalScheduleFromBuffer(buffer)

      const match = result.categoriesGroupsMap.MS[0].rounds[0][0]
      expect(match.entry1Idx).toBe(2)
      expect(match.entry2Idx).toBe(3)
      expect(match.table).toBe('T1')
    })

    it('should survive the referee moving a cell to another slot and table', async () => {
      const { buffer } = await generateDraftBuffer()

      // Simulate cut/paste: move the B2 match cell (T1, slot 0) to E5 (T4,
      // slot 3) — cut/paste carries the cell's value and format together
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buffer)
      const ws = wb.getWorksheet('schedule')!
      const source = ws.getCell('B2')
      expect(source.value).toBe(1)
      expect(source.numFmt).toBe('"MS Grp1"')
      const dest = ws.getCell('E5')
      dest.value = source.value
      dest.style = source.style
      source.value = null
      const edited = new Uint8Array(await wb.xlsx.writeBuffer())

      const result = await importFinalScheduleFromBuffer(edited)

      // Group 1's (0,1) pairing occurs exactly once — it must now sit on
      // T4 at slot 3's time (10:30), not on T1 at 09:00
      const moved = Object.values(result.categoriesGroupsMap)
        .flatMap((groups) => groups)
        .flatMap((group) => group.rounds)
        .flat()
        .find((m) => m.entry1Idx === 0 && m.entry2Idx === 1)
      expect(moved).toBeDefined()
      expect(moved!.table).toBe('T4')
      expect(moved!.datetime).toBe('2025-03-22T10:30:00.000Z')
    })

    it('should handle bye matches (empty entry cells → -1)', async () => {
      // Build a workbook with a bye match (entry indices not written)
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('schedule')
      const wm = wb.addWorksheet('matches')

      // Matches header
      const headers = [
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
      headers.forEach((h, i) => (wm.getCell(1, i + 1).value = h))

      // Schedule header
      ws.getCell(1, 1).value = 'Date/Time'
      ws.getCell(1, 2).value = 'T1'

      // A match with no entry IDs (bye)
      wm.getCell(2, 1).value = 1 // SN
      wm.getCell(2, 2).value = 'MS' // Category
      wm.getCell(2, 3).value = 1 // Round
      wm.getCell(2, 4).value = 1 // Group
      // EntryID1 (col 9) and EntryID2 (col 10) are NOT set → empty → 0 → -1

      // Schedule cell with hyperlink
      ws.getCell(2, 1).value = new Date('2025-03-22T09:00:00Z')
      ws.getCell(2, 2).value = { text: 'MS Grp1', hyperlink: 'matches!A2' }

      const buffer = new Uint8Array(await wb.xlsx.writeBuffer())
      const result = await importFinalScheduleFromBuffer(buffer)

      const match = result.categoriesGroupsMap.MS[0].rounds[0][0]
      expect(match.entry1Idx).toBe(-1)
      expect(match.entry2Idx).toBe(-1)
    })

    it('should skip rows without a parseable datetime', async () => {
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('schedule')
      const wm = wb.addWorksheet('matches')

      headers.forEach((h, i) => (wm.getCell(1, i + 1).value = h))
      ws.getCell(1, 1).value = 'Date/Time'
      ws.getCell(1, 2).value = 'T1'

      // Row 2: valid datetime
      ws.getCell(2, 1).value = new Date('2025-03-22T09:00:00Z')
      ws.getCell(2, 2).value = { text: 'MS', hyperlink: 'matches!A2' }
      wm.getCell(2, 2).value = 'MS'
      wm.getCell(2, 3).value = 1
      wm.getCell(2, 4).value = 1

      // Row 3: text, not a datetime (should be skipped)
      ws.getCell(3, 1).value = 'Lunch Break'
      ws.getCell(3, 2).value = { text: 'MS', hyperlink: 'matches!A3' }

      const buffer = new Uint8Array(await wb.xlsx.writeBuffer())
      const result = await importFinalScheduleFromBuffer(buffer)

      // Only row 2's match should be extracted
      const msGroups = result.categoriesGroupsMap.MS
      expect(msGroups).toBeDefined()
      expect(msGroups[0].rounds[0]).toHaveLength(1)
    })

    it('should throw if schedule sheet does not exist', async () => {
      const wb = new ExcelJS.Workbook()
      wb.addWorksheet('other')
      const buffer = new Uint8Array(await wb.xlsx.writeBuffer())
      await expect(importFinalScheduleFromBuffer(buffer)).rejects.toThrow(
        'sheet schedule does not exist'
      )
    })
  })

  describe('full round-trip integrity', () => {
    it('should produce groups whose match count matches the original schedule', async () => {
      const { buffer, tournament } = await generateDraftBuffer()
      const result = await importFinalScheduleFromBuffer(buffer)

      // Count total group matches imported
      let importedGroupMatches = 0
      for (const cat of Object.keys(result.categoriesGroupsMap)) {
        for (const group of result.categoriesGroupsMap[cat]) {
          for (const round of group.rounds) {
            importedGroupMatches += round.length
          }
        }
      }

      // Count original group matches from the schedule
      const schedule = scheduleMatches(tournament)
      let originalGroupMatches = 0
      for (const slot of schedule.timeSlots) {
        for (const match of slot.tables) {
          if (match && match.groupIdx >= 0) originalGroupMatches++
        }
      }

      expect(importedGroupMatches).toBe(originalGroupMatches)
    })
  })
})
