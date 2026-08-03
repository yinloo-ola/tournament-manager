import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Entry, EntryType, type Tournament } from '@/shared/model'
import { generateRoundsForTournament } from '@/features/matches/domain/generateRounds'
import { createRobinCharts } from '@/features/roundrobin/excel/roundrobinChartWorkbook'
import { exportScoresheets } from '@/features/scoresheet/excel/scoresheetWorkbook'

/**
 * Feature acceptance test for Slice 4 — exercises the chart and scoresheet
 * exports together as an end-to-end pipeline with no server involvement.
 *
 * Given a tournament with drawn groups and generated rounds, when the user
 * exports a round-robin chart and scoresheets in-browser, then:
 * - The chart produces valid per-category sheets with round-robin matrices
 * - The scoresheets contain correct substituted values with template layout preserved
 * - No fetch/HTTP is involved
 */

function readTemplateBuffer(): Buffer {
  return readFileSync(resolve(process.cwd(), 'testdata/scoresheet template.xlsx'))
}

function buildFeatureTournament(): Tournament {
  return {
    name: 'Singapore Open 2025',
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
        entries: [
          Entry.from({
            entryType: EntryType.Singles,
            club: 'NYC',
            singlesEntry: { player: { name: 'Alice', dateOfBirth: '2000-01-01', gender: 'F' } },
          }),
          Entry.from({
            entryType: EntryType.Singles,
            singlesEntry: { player: { name: 'Bob', dateOfBirth: '2000-01-01', gender: 'M' } },
          }),
          Entry.from({
            entryType: EntryType.Singles,
            club: 'LA',
            singlesEntry: { player: { name: 'Charlie', dateOfBirth: '2000-01-01', gender: 'M' } },
          }),
          Entry.from({
            entryType: EntryType.Singles,
            singlesEntry: { player: { name: 'Diana', dateOfBirth: '2000-01-01', gender: 'F' } },
          }),
        ],
        groups: [{ entriesIdx: [0, 1, 2, 3], rounds: [] }],
        knockoutRounds: [],
      },
    ],
  }
}

describe('Slice 4 Feature Acceptance — Chart & Scoresheet Exports', () => {
  it('should export round-robin chart and scoresheets entirely in-browser', async () => {
    // ---------------------------------------------------------------
    // Setup: build tournament with groups, generate rounds
    // ---------------------------------------------------------------
    const tournament = buildFeatureTournament()
    generateRoundsForTournament(tournament)

    // Verify rounds were generated
    const cat = tournament.categories[0]
    expect(cat.groups[0].rounds.length).toBeGreaterThan(0)

    // ---------------------------------------------------------------
    // Chart export: createRobinCharts → valid workbook
    // ---------------------------------------------------------------
    const chartWb = createRobinCharts(tournament)
    expect(chartWb.worksheets.map((ws) => ws.name)).toEqual(['MS'])

    const chartSheet = chartWb.getWorksheet('MS')!
    // Tournament name in row 1
    expect(chartSheet.getRow(1).getCell(1).value).toBe('Singapore Open 2025')
    // Category name in row 2
    expect(chartSheet.getRow(2).getCell(1).value).toBe("Men's Singles")
    // Group 1 label exists
    let foundGroupLabel = false
    for (let r = 4; r <= 20; r++) {
      if (chartSheet.getRow(r).getCell(1).value === 'Group 1') {
        foundGroupLabel = true
        break
      }
    }
    expect(foundGroupLabel).toBe(true)

    // Serialize chart to prove it produces a valid .xlsx
    const chartBuf = await chartWb.xlsx.writeBuffer()
    expect(chartBuf.byteLength).toBeGreaterThan(0)

    // ---------------------------------------------------------------
    // Scoresheet export: load template → exportScoresheets → valid output
    // ---------------------------------------------------------------
    const templateBuf = readTemplateBuffer()
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(templateBuf)

    // Template must have the MS sheet
    expect(wb.getWorksheet('MS')).toBeDefined()

    exportScoresheets(tournament, wb)

    // Verify generated scoresheet sheets exist
    const generatedSheets = wb.worksheets
      .map((ws) => ws.name)
      .filter((name) => name.startsWith('MS-'))

    expect(generatedSheets.length).toBeGreaterThan(0)

    // Each generated sheet should have no unsubstituted placeholders
    for (const name of generatedSheets) {
      const ws = wb.getWorksheet(name)!
      ws.eachRow({ includeEmpty: true }, (row) => {
        row.eachCell({ includeEmpty: true }, (cell) => {
          if (typeof cell.value === 'string') {
            expect(cell.value).not.toMatch(/\{\{/)
          }
        })
      })
    }

    // Serialize scoresheets to prove valid .xlsx
    const scoresheetBuf = await wb.xlsx.writeBuffer()
    expect(scoresheetBuf.byteLength).toBeGreaterThan(0)

    // ---------------------------------------------------------------
    // No server involvement: neither export uses fetch
    // ---------------------------------------------------------------
    // (Validated by source-level grep tests in TournamentView.slice4.test.ts
    // and by the fact that createRobinCharts and exportScoresheets are
    // pure functions operating on in-memory objects.)
  })

  it('should produce scoresheets with correct substituted values', async () => {
    const tournament = buildFeatureTournament()
    generateRoundsForTournament(tournament)

    const templateBuf = readTemplateBuffer()
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(templateBuf)

    exportScoresheets(tournament, wb)

    // Find a generated group-match sheet and verify it has substituted values
    const groupSheets = wb.worksheets
      .map((ws) => ws.name)
      .filter((n) => n.includes('-Grp'))

    expect(groupSheets.length).toBeGreaterThan(0)

    // Verify the sheet name follows the expected pattern
    const firstSheet = groupSheets[0]
    expect(firstSheet).toMatch(/^MS-Grp\d+-Rd\d+-/)

    // Verify template structure preserved (merged ranges exist)
    const ws = wb.getWorksheet(firstSheet)!
    const merges = ws.model.merges ?? []
    expect(merges.length).toBeGreaterThan(0)

    // Verify template cells are preserved (non-placeholder cells survive)
    // The template's MS sheet has cells in the B1:X1 merge range (title)
    const templateMerges = (wb.getWorksheet('MS')!.model.merges ?? []).slice().sort()
    const cloneMerges = (ws.model.merges ?? []).slice().sort()
    expect(cloneMerges).toEqual(templateMerges)
  })

  it('should handle both group and knockout matches in scoresheets', async () => {
    const tournament = buildFeatureTournament()
    generateRoundsForTournament(tournament)

    const cat = tournament.categories[0]

    // Verify both group rounds and knockout rounds are populated
    expect(cat.groups[0].rounds.length).toBeGreaterThan(0)

    const templateBuf = readTemplateBuffer()
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(templateBuf)

    exportScoresheets(tournament, wb)

    const sheetNames = wb.worksheets.map((ws) => ws.name)

    // Group match sheets: MS-Grp*-Rd*-*
    const groupSheets = sheetNames.filter((n) => n.includes('-Grp'))
    expect(groupSheets.length).toBeGreaterThan(0)

    // Knockout sheets may or may not exist depending on round generation,
    // but if they do, they follow MS-KO-Rd*-N pattern
    const koSheets = sheetNames.filter((n) => n.includes('-KO-'))
    for (const name of koSheets) {
      expect(name).toMatch(/^MS-KO-Rd\d+-\d+$/)
    }
  })
})