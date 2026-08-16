import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { importFinalScheduleFromBuffer, type ImportedSchedule } from '../importFinalSchedule'
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

/** Find an imported group match by its entry pairing (unique per group). */
function findGroupMatch(result: ImportedSchedule, entry1Idx: number, entry2Idx: number) {
  return Object.values(result.categoriesGroupsMap)
    .flatMap((groups) => groups)
    .flatMap((group) => group.rounds)
    .flat()
    .find((m) => m.entry1Idx === entry1Idx && m.entry2Idx === entry2Idx)
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
      const { buffer } = await generateDraftBuffer()
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

      // Simulate cut/paste: move the B2 match cell (T1, slot 0) into the
      // empty grid cell at D8 (T3, slot 6 → 11:00) — cut/paste carries the
      // cell's value and format together. Pasting onto an occupied cell
      // would displace that match, which the missing-match check catches.
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buffer)
      const ws = wb.getWorksheet('schedule')!
      const source = ws.getCell('B2')
      expect(source.value).toBe(1)
      expect(source.numFmt).toBe('"MS Grp1"')
      const dest = ws.getCell('D8')
      expect(dest.value).toBeNull()
      const slotTime = ws.getCell('A8').value as Date
      dest.value = source.value
      dest.style = source.style
      source.value = null
      const edited = new Uint8Array(await wb.xlsx.writeBuffer())

      const result = await importFinalScheduleFromBuffer(edited)

      // Group 1's (0,1) pairing occurs exactly once — it must now sit on
      // T3 at row 8's slot time, not on T1 at 09:00
      const moved = findGroupMatch(result, 0, 1)
      expect(moved).toBeDefined()
      expect(moved!.table).toBe('T3')
      expect(moved!.datetime).toBe(slotTime.toISOString())
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

  describe('integrity checks', () => {
    /** Minimal workbook: matches sheet rows + schedule grid cells, both SN-valued. */
    function buildIntegrityFixture(
      matchRows: { sn: number; cat?: string; round?: number; group?: number }[],
      gridRows: { time: Date; cells: (number | null)[] }[]
    ): ExcelJS.Workbook {
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('schedule')
      const wm = wb.addWorksheet('matches')

      headers.forEach((h, i) => (wm.getCell(1, i + 1).value = h))
      matchRows.forEach((m, i) => {
        wm.getCell(i + 2, 1).value = m.sn
        wm.getCell(i + 2, 2).value = m.cat ?? 'MS'
        wm.getCell(i + 2, 3).value = m.round ?? 1
        wm.getCell(i + 2, 4).value = m.group ?? 1
      })

      ws.getCell(1, 1).value = 'Date/Time'
      const tableCount = Math.max(...gridRows.map((row) => row.cells.length), 1)
      for (let c = 1; c <= tableCount; c++) {
        ws.getCell(1, c + 1).value = `T${c}`
      }
      gridRows.forEach((row, r) => {
        ws.getCell(r + 2, 1).value = row.time
        row.cells.forEach((sn, c) => {
          if (sn !== null) ws.getCell(r + 2, c + 2).value = sn
        })
      })
      return wb
    }

    async function fixtureBuffer(wb: ExcelJS.Workbook): Promise<Uint8Array> {
      return new Uint8Array(await wb.xlsx.writeBuffer())
    }

    const T9 = () => new Date('2025-03-22T09:00:00Z')
    const T930 = () => new Date('2025-03-22T09:30:00Z')

    it('should reject a match appearing in two cells', async () => {
      const T10 = () => new Date('2025-03-22T10:00:00Z')
      const T1030 = () => new Date('2025-03-22T10:30:00Z')
      const T11 = () => new Date('2025-03-22T11:00:00Z')
      const T1130 = () => new Date('2025-03-22T11:30:00Z')
      const wb = buildIntegrityFixture(
        [{ sn: 3 }, { sn: 4 }, { sn: 5 }],
        [
          { time: T9(), cells: [3] },
          { time: T930(), cells: [3] },
          { time: T10(), cells: [4] },
          { time: T1030(), cells: [4] },
          { time: T11(), cells: [5] },
          { time: T1130(), cells: [5] }
        ]
      )
      await expect(importFinalScheduleFromBuffer(await fixtureBuffer(wb))).rejects.toThrow(
        /Matches 3, 4 and 5 appear in more than one cell/
      )
    })

    it('should reject matches missing from the grid', async () => {
      const wb = buildIntegrityFixture(
        [
          { sn: 1 },
          { sn: 2 }
        ],
        [{ time: T9(), cells: [1] }]
      )
      await expect(importFinalScheduleFromBuffer(await fixtureBuffer(wb))).rejects.toThrow(
        /Match 2 has no cell in the schedule/
      )
    })

    it('should reject two matches on the same table at the same time', async () => {
      const wb = buildIntegrityFixture(
        [
          { sn: 3 },
          { sn: 9 }
        ],
        [
          { time: T9(), cells: [3] },
          { time: T9(), cells: [9] }
        ]
      )
      await expect(importFinalScheduleFromBuffer(await fixtureBuffer(wb))).rejects.toThrow(
        /Table T1 is double-booked at 2025-03-22 09:00 \(matches 3 and 9\)/
      )
    })

    it('should report every problem in one message', async () => {
      const T10 = () => new Date('2025-03-22T10:00:00Z')
      const wb = buildIntegrityFixture(
        [
          { sn: 1 },
          { sn: 2 },
          { sn: 4 },
          { sn: 5 }
        ],
        [
          { time: T9(), cells: [1] },
          { time: T930(), cells: [1] },
          // SN 4 and SN 5 double-book T1 at 10:00; SN 2 is nowhere
          { time: T10(), cells: [4] },
          { time: T10(), cells: [5] }
        ]
      )
      await expect(importFinalScheduleFromBuffer(await fixtureBuffer(wb))).rejects.toThrow(
        /more than one cell.*Match 2 has no cell.*double-booked/s
      )
    })

    it('should accept an adjusted slot time', async () => {
      const { buffer } = await generateDraftBuffer()
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buffer)
      wb.getWorksheet('schedule')!.getCell('A2').value = new Date('2025-03-22T10:15:00Z')
      const edited = new Uint8Array(await wb.xlsx.writeBuffer())

      const result = await importFinalScheduleFromBuffer(edited)
      const first = result.categoriesGroupsMap.MS[0].rounds[0][0]
      expect(first.datetime).toBe('2025-03-22T10:15:00.000Z')
    })

    it('should accept a slot row appended by the referee', async () => {
      const { buffer } = await generateDraftBuffer()
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buffer)
      const ws = wb.getWorksheet('schedule')!

      // Cut the B2 match (SN 1) into a brand-new bottom row at 14:00
      const bottom = ws.rowCount + 1
      ws.getCell(bottom, 1).value = new Date('2025-03-22T14:00:00Z')
      ws.getCell(bottom, 2).value = ws.getCell('B2').value
      ws.getCell('B2').value = null
      const edited = new Uint8Array(await wb.xlsx.writeBuffer())

      const result = await importFinalScheduleFromBuffer(edited)
      const moved = findGroupMatch(result, 0, 1)
      expect(moved!.datetime).toBe('2025-03-22T14:00:00.000Z')
      expect(moved!.table).toBe('T1')
    })

    it('should accept a slot row inserted mid-grid by the referee', async () => {
      const { buffer } = await generateDraftBuffer()
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buffer)
      const ws = wb.getWorksheet('schedule')!

      // Insert a row at position 3 (shifting later slots down), give it an
      // earlier time, and move the B2 match (SN 1) into it
      ws.insertRow(3)
      ws.getCell(3, 1).value = new Date('2025-03-22T08:00:00Z')
      ws.getCell(3, 2).value = ws.getCell('B2').value
      ws.getCell('B2').value = null
      const edited = new Uint8Array(await wb.xlsx.writeBuffer())

      const result = await importFinalScheduleFromBuffer(edited)
      const moved = findGroupMatch(result, 0, 1)
      expect(moved!.datetime).toBe('2025-03-22T08:00:00.000Z')
      expect(moved!.table).toBe('T1')
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
