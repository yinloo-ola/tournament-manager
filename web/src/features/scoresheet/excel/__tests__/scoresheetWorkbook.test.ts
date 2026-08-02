import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Entry, EntryType, type Tournament } from '@/shared/model'
import { exportScoresheets } from '../scoresheetWorkbook'

// -------------------------------------------------------------------------
// Helpers — build test data
// -------------------------------------------------------------------------
function readTemplateBuffer(): Buffer {
  return readFileSync(resolve(process.cwd(), '../testdata/scoresheet template.xlsx'))
}

function makeSinglesEntries(names: string[]): Entry[] {
  return names.map((name) =>
    Entry.from({
      entryType: EntryType.Singles,
      singlesEntry: { player: { name, dateOfBirth: '2000-01-01', gender: 'M' } },
    })
  )
}

/**
 * Build a tournament with one category (MS) that has group matches and
 * knockout matches. Entries are singles players.
 */
function buildTestTournament(): Tournament {
  return {
    name: 'Test Cup',
    numTables: 4,
    startTime: '2025-03-22T09:00',
    categories: [
      {
        name: "Men's Singles",
        shortName: 'MS',
        entryType: EntryType.Singles,
        entriesPerGrpMain: 4,
        entriesPerGrpRemainder: 0,
        durationMinutes: 30,
        numQualifiedPerGroup: 2,
        entries: makeSinglesEntries(['Alice', 'Bob', 'Charlie', 'Diana']),
        groups: [
          {
            entriesIdx: [0, 1],
            rounds: [
              [
                {
                  entry1Idx: 0,
                  entry2Idx: 1,
                  datetime: '2025-03-22T09:00',
                  durationMinutes: 30,
                  table: 'T1',
                },
              ],
            ],
          },
          {
            entriesIdx: [2, 3],
            rounds: [
              [
                {
                  entry1Idx: 2,
                  entry2Idx: 3,
                  datetime: '2025-03-22T09:30',
                  durationMinutes: 30,
                  table: 'T2',
                },
              ],
            ],
          },
        ],
        knockoutRounds: [
          {
            round: 2,
            matches: [
              {
                entry1Idx: 0,
                entry2Idx: 1,
                datetime: '2025-03-22T11:00',
                durationMinutes: 30,
                table: 'T1',
              },
            ],
          },
        ],
      },
    ],
  }
}

/**
 * Build a minimal template workbook with a sheet named "MS" containing
 * placeholder cells for testing substitution logic in isolation.
 */
function buildTestTemplate(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('MS')
  ws.getCell('A1').value = '{{tournament}}'
  ws.getCell('A2').value = 'Category: {{category}}'
  ws.getCell('A3').value = '{{date}} {{time}} Table {{table}}'
  ws.getCell('A4').value = '{{player1}} vs {{player2}}'
  ws.getCell('A5').value = 'No placeholders here'
  ws.getCell('A6').value = 'Player1 only: {{player1}}'
  // Add a style to verify fidelity
  ws.getCell('A5').style = {
    font: { bold: true, size: 14 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA0A0A0' } },
  }
  ws.getColumn(1).width = 20
  ws.getRow(1).height = 30
  ws.mergeCells('A1:B1')
  return wb
}

describe('scoresheetWorkbook', () => {
  // -------------------------------------------------------------------------
  // Sheet naming
  // -------------------------------------------------------------------------
  describe('sheet naming', () => {
    it('should create a sheet per group match with correct naming', () => {
      const tournament = buildTestTournament()
      const wb = buildTestTemplate()
      exportScoresheets(tournament, wb)

      // Group 0, round 0, table T1 → MS-Grp1-Rd1-T1
      expect(wb.getWorksheet('MS-Grp1-Rd1-T1')).toBeDefined()
      // Group 1, round 0, table T2 → MS-Grp2-Rd1-T2
      expect(wb.getWorksheet('MS-Grp2-Rd1-T2')).toBeDefined()
    })

    it('should create a sheet per knockout match with correct naming', () => {
      const tournament = buildTestTournament()
      const wb = buildTestTemplate()
      exportScoresheets(tournament, wb)

      // Knockout round 2, match 0 → MS-KO-Rd2-1
      expect(wb.getWorksheet('MS-KO-Rd2-1')).toBeDefined()
    })
  })

  // -------------------------------------------------------------------------
  // Placeholder substitution
  // -------------------------------------------------------------------------
  describe('placeholder substitution', () => {
    it('should substitute all placeholders correctly', () => {
      const tournament = buildTestTournament()
      const wb = buildTestTemplate()
      exportScoresheets(tournament, wb)

      const sheet = wb.getWorksheet('MS-Grp1-Rd1-T1')!
      // Tournament name
      expect(sheet.getCell('A1').value).toBe('Test Cup')
      // Category
      expect(sheet.getCell('A2').value).toBe('Category: MS')
      // Date, time, table
      expect(sheet.getCell('A3').value).toBe('2025-03-22 09:00 Table T1')
      // Players
      expect(sheet.getCell('A4').value).toBe('Alice vs Bob')
      // Player1 only
      expect(sheet.getCell('A6').value).toBe('Player1 only: Alice')
    })

    it('should format date as YYYY-MM-DD and time as HH:MM', () => {
      const tournament = buildTestTournament()
      const wb = buildTestTemplate()
      exportScoresheets(tournament, wb)

      const sheet = wb.getWorksheet('MS-Grp2-Rd1-T2')!
      // datetime 2025-03-22T09:30 → date 2025-03-22, time 09:30
      expect(sheet.getCell('A3').value).toBe('2025-03-22 09:30 Table T2')
    })

    it('should substitute empty string for bye player (entryIdx < 0)', () => {
      const tournament = buildTestTournament()
      // Set entry1Idx to -1 (bye)
      tournament.categories[0].groups[0].rounds[0][0].entry1Idx = -1

      const wb = buildTestTemplate()
      exportScoresheets(tournament, wb)

      const sheet = wb.getWorksheet('MS-Grp1-Rd1-T1')!
      // {{player1}} replaced with empty string
      expect(sheet.getCell('A4').value).toBe(' vs Bob')
      expect(sheet.getCell('A6').value).toBe('Player1 only: ')
    })

    it('should handle multiple placeholders in one cell', () => {
      const tournament = buildTestTournament()
      const wb = buildTestTemplate()
      exportScoresheets(tournament, wb)

      const sheet = wb.getWorksheet('MS-Grp1-Rd1-T1')!
      // A3 has date, time, AND table in one cell
      expect(sheet.getCell('A3').value).toBe('2025-03-22 09:00 Table T1')
    })
  })

  // -------------------------------------------------------------------------
  // Template fidelity
  // -------------------------------------------------------------------------
  describe('template fidelity', () => {
    it('should preserve non-placeholder template cells unchanged', () => {
      const tournament = buildTestTournament()
      const wb = buildTestTemplate()
      exportScoresheets(tournament, wb)

      const sheet = wb.getWorksheet('MS-Grp1-Rd1-T1')!
      // A5 has no placeholders — should be unchanged
      expect(sheet.getCell('A5').value).toBe('No placeholders here')
      // Style should be preserved
      expect(sheet.getCell('A5').style.font?.bold).toBe(true)
      expect(sheet.getCell('A5').style.font?.size).toBe(14)
      expect(sheet.getCell('A5').style.fill?.fgColor?.argb).toBe('FFA0A0A0')
    })

    it('should preserve template merged ranges in cloned sheets', () => {
      const tournament = buildTestTournament()
      const wb = buildTestTemplate()
      exportScoresheets(tournament, wb)

      const sheet = wb.getWorksheet('MS-Grp1-Rd1-T1')!
      const merges = (sheet.model.merges ?? []).slice().sort()
      expect(merges).toContain('A1:B1')
    })

    it('should preserve template column widths and row heights', () => {
      const tournament = buildTestTournament()
      const wb = buildTestTemplate()
      exportScoresheets(tournament, wb)

      const sheet = wb.getWorksheet('MS-Grp1-Rd1-T1')!
      expect(sheet.getColumn(1).width).toBe(20)
      expect(sheet.getRow(1).height).toBe(30)
    })
  })

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------
  describe('error handling', () => {
    it('should throw when template sheet not found', () => {
      const tournament: Tournament = {
        name: 'Test',
        numTables: 4,
        startTime: '2025-03-22T09:00',
        categories: [
          {
            name: "Women's Singles",
            shortName: 'WS',
            entryType: EntryType.Singles,
            entriesPerGrpMain: 4,
            entriesPerGrpRemainder: 0,
            durationMinutes: 30,
            numQualifiedPerGroup: 2,
            entries: makeSinglesEntries(['Eve', 'Frank']),
            groups: [
              {
                entriesIdx: [0, 1],
                rounds: [
                  [
                    {
                      entry1Idx: 0,
                      entry2Idx: 1,
                      datetime: '2025-03-22T09:00',
                      durationMinutes: 30,
                      table: 'T1',
                    },
                  ],
                ],
              },
            ],
            knockoutRounds: [],
          },
        ],
      }

      const wb = buildTestTemplate() // Only has "MS" sheet, not "WS"
      expect(() => exportScoresheets(tournament, wb)).toThrow(
        "template sheet 'WS' not found"
      )
    })

    it('should skip duplicate sheet names (idempotent)', () => {
      const tournament = buildTestTournament()
      const wb = buildTestTemplate()
      exportScoresheets(tournament, wb)

      // Run again — should not create duplicates or throw
      expect(() => exportScoresheets(tournament, wb)).not.toThrow()

      // Still only one of each sheet
      const sheets = wb.worksheets.map((ws) => ws.name)
      const grp1Count = sheets.filter((s) => s === 'MS-Grp1-Rd1-T1').length
      expect(grp1Count).toBe(1)
    })
  })

  // -------------------------------------------------------------------------
  // Real template integration
  // -------------------------------------------------------------------------
  describe('real template (scoresheet template.xlsx)', () => {
    it('should generate correct scoresheets from testdata template', async () => {
      const buf = readTemplateBuffer()
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buf)

      const tournament = buildTestTournament()
      exportScoresheets(tournament, wb)

      // Verify generated sheets exist
      expect(wb.getWorksheet('MS-Grp1-Rd1-T1')).toBeDefined()
      expect(wb.getWorksheet('MS-Grp2-Rd1-T2')).toBeDefined()
      expect(wb.getWorksheet('MS-KO-Rd2-1')).toBeDefined()

      // Verify no unsubstituted placeholders remain in generated sheets
      const generatedSheetNames = ['MS-Grp1-Rd1-T1', 'MS-Grp2-Rd1-T2', 'MS-KO-Rd2-1']
      for (const name of generatedSheetNames) {
        const ws = wb.getWorksheet(name)!
        ws.eachRow({ includeEmpty: true }, (row) => {
          row.eachCell({ includeEmpty: true }, (cell) => {
            const val = cell.value
            if (typeof val === 'string') {
              expect(val).not.toContain('{{')
            }
          })
        })
      }

      // Verify template sheets are unchanged (MS still exists as template)
      const templateMs = wb.getWorksheet('MS')!
      // Template cells should still have placeholders (untouched)
      let hasPlaceholder = false
      templateMs.eachRow({ includeEmpty: true }, (row) => {
        row.eachCell({ includeEmpty: true }, (cell) => {
          if (typeof cell.value === 'string' && cell.value.includes('{{')) {
            hasPlaceholder = true
          }
        })
      })
      expect(hasPlaceholder).toBe(true)
    })
  })
})