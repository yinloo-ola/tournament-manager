import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Entry, EntryType, type Tournament, type Category } from '@/shared/model'
import { createRobinCharts } from '../roundrobinChartWorkbook'

// -------------------------------------------------------------------------
// Test data — mirrors the Go oracle's buildChartOracleTournament
// -------------------------------------------------------------------------
function buildTestTournament(): Tournament {
  const clubNYC = 'NYC'
  const clubLA = 'LA'

  const msEntries = [
    Entry.from({
      entryType: EntryType.Singles,
      club: clubNYC,
      singlesEntry: { player: { name: 'Alice', dateOfBirth: '2000-01-01', gender: 'M' } },
    }),
    Entry.from({
      entryType: EntryType.Singles,
      singlesEntry: { player: { name: 'Bob', dateOfBirth: '2000-01-01', gender: 'M' } },
    }),
    Entry.from({
      entryType: EntryType.Singles,
      club: clubLA,
      singlesEntry: { player: { name: 'Charlie', dateOfBirth: '2000-01-01', gender: 'M' } },
    }),
    Entry.from({
      entryType: EntryType.Singles,
      singlesEntry: { player: { name: 'Diana', dateOfBirth: '2000-01-01', gender: 'M' } },
    }),
  ]

  const mdEntries = [
    Entry.from({
      entryType: EntryType.Doubles,
      doublesEntry: {
        players: [
          { name: 'Alice', dateOfBirth: '2000-01-01', gender: 'M' },
          { name: 'Bob', dateOfBirth: '2000-01-01', gender: 'F' },
        ],
      },
    }),
    Entry.from({
      entryType: EntryType.Doubles,
      doublesEntry: {
        players: [
          { name: 'Charlie', dateOfBirth: '2000-01-01', gender: 'M' },
          { name: 'Diana', dateOfBirth: '2000-01-01', gender: 'F' },
        ],
      },
    }),
    Entry.from({
      entryType: EntryType.Doubles,
      doublesEntry: {
        players: [
          { name: 'Eve', dateOfBirth: '2000-01-01', gender: 'M' },
          { name: 'Frank', dateOfBirth: '2000-01-01', gender: 'F' },
        ],
      },
    }),
    Entry.from({
      entryType: EntryType.Doubles,
      doublesEntry: {
        players: [
          { name: 'Grace', dateOfBirth: '2000-01-01', gender: 'M' },
          { name: 'Henry', dateOfBirth: '2000-01-01', gender: 'F' },
        ],
      },
    }),
  ]

  return {
    name: 'Test Tournament',
    numTables: 8,
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
        entries: msEntries,
        groups: [
          { entriesIdx: [0, 1, 2, 3], rounds: [] },
          { entriesIdx: [0, 1], rounds: [] },
        ],
        knockoutRounds: [],
      },
      {
        name: 'Mixed Doubles',
        shortName: 'MD',
        entryType: EntryType.Doubles,
        entriesPerGrpMain: 4,
        entriesPerGrpRemainder: 0,
        durationMinutes: 45,
        numQualifiedPerGroup: 2,
        entries: mdEntries,
        groups: [
          { entriesIdx: [0, 1], rounds: [] },
          { entriesIdx: [2, 3], rounds: [] },
        ],
        knockoutRounds: [],
      },
    ],
  }
}

// -------------------------------------------------------------------------
// Helpers for reading the Go golden .xlsx
// -------------------------------------------------------------------------
function readGoGolden(): Buffer {
  return readFileSync(
    resolve(process.cwd(), 'src/features/roundrobin/excel/__tests__/golden/chart.golden.xlsx')
  )
}

/**
 * Collect all cells from a worksheet as a map of "row,col" → {value, style}.
 */
interface CellInfo {
  value: unknown
  style: Partial<ExcelJS.Style>
}

function collectCells(ws: ExcelJS.Worksheet): Map<string, CellInfo> {
  const cells = new Map<string, CellInfo>()
  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cells.set(`${rowNumber},${colNumber}`, {
        value: cell.value,
        style: cell.style,
      })
    })
  })
  return cells
}

/**
 * Normalize a border object by stripping `none`-style borders.
 * Go (tealeg/xlsx) writes explicit `{style:'none'}` for unset borders;
 * ExcelJS defaults to empty/undefined. This normalizes both to the same shape.
 */
function normalizeBorder(border: Partial<ExcelJS.Borders> | undefined) {
  if (!border) return undefined
  const result: Record<string, unknown> = {}
  for (const [side, b] of Object.entries(border)) {
    if (b && typeof b === 'object' && 'style' in b && b.style !== 'none') {
      result[side] = b
    }
  }
  return Object.keys(result).length > 0 ? result : undefined
}

/**
 * Normalize a font by stripping both libraries' default values.
 * tealeg/xlsx defaults: name="Verdana", size=12.
 * ExcelJS defaults (from theme): size=11, family=2, scheme="minor",
 *   color={theme:1}.
 * Only explicitly-set, non-default properties are compared.
 */
function normalizeFont(font: Partial<ExcelJS.Font> | undefined) {
  if (!font) return undefined
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(font)) {
    if (val === undefined || val === null) continue
    if (key === 'name') continue // tealeg default
    if (key === 'size' && (val === 11 || val === 12)) continue // both defaults
    if (key === 'family' && val === 2) continue // ExcelJS default
    if (key === 'scheme' && val === 'minor') continue // ExcelJS default
    if (key === 'color' && typeof val === 'object' && 'theme' in val && (val as any).theme === 1) continue // ExcelJS default
    result[key] = val
  }
  return Object.keys(result).length > 0 ? result : undefined
}

/**
 * Normalize an alignment by stripping OOXML default values.
 * tealeg/xlsx writes all alignment properties (including defaults);
 * ExcelJS only stores explicitly-set values.
 */
function normalizeAlignment(alignment: Partial<ExcelJS.Alignment> | undefined) {
  if (!alignment) return undefined
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(alignment)) {
    if (val === undefined) continue
    if (key === 'vertical' && val === 'bottom') continue
    if (key === 'horizontal' && val === 'general') continue
    if (key === 'wrapText' && val === false) continue
    if (key === 'shrinkToFit' && val === false) continue
    if (key === 'textRotation' && val === 0) continue
    if (key === 'indent' && val === 0) continue
    if (key === 'readingOrder' && (val === 0 || val === undefined)) continue
    result[key] = val
  }
  return Object.keys(result).length > 0 ? result : undefined
}

/**
 * Normalize a cell value: treat empty string as null.
 * tealeg/xlsx creates cells with Value="" by default; ExcelJS uses null.
 * Both represent "no data."
 */
function normalizeValue(v: unknown): unknown {
  return v === '' ? null : v
}

describe('roundrobinChartWorkbook', () => {
  // -------------------------------------------------------------------------
  // Sheet structure
  // -------------------------------------------------------------------------
  describe('structure', () => {
    it('should create one sheet per category named by shortName', () => {
      const tournament = buildTestTournament()
      const wb = createRobinCharts(tournament)
      const names = wb.worksheets.map((ws) => ws.name)
      expect(names).toEqual(['MS', 'MD'])
      expect(wb.getWorksheet('Sheet1')).toBeUndefined()
    })
  })

  // -------------------------------------------------------------------------
  // Header
  // -------------------------------------------------------------------------
  describe('header', () => {
    it('should build the styled category header (row 1-3)', () => {
      const tournament = buildTestTournament()
      const wb = createRobinCharts(tournament)
      const ws = wb.getWorksheet('MS')! // maxPlayer=4 → 8 columns

      // Row 1: tournament name, merged across 8 cols, bold size 20, center, height 30
      const r1 = ws.getRow(1)
      expect(r1.getCell(1).value).toBe('Test Tournament')
      expect(r1.height).toBe(30)
      expect(r1.getCell(1).style.font?.bold).toBe(true)
      expect(r1.getCell(1).style.font?.size).toBe(20)
      expect(r1.getCell(1).style.alignment?.horizontal).toBe('center')
      const merges = (ws.model.merges ?? []).slice().sort()
      expect(merges).toContain('A1:H1')

      // Row 2: category name, merged, bold size 12, center, height 20
      const r2 = ws.getRow(2)
      expect(r2.getCell(1).value).toBe("Men's Singles")
      expect(r2.height).toBe(20)
      expect(r2.getCell(1).style.font?.bold).toBe(true)
      expect(r2.getCell(1).style.font?.size).toBe(12)
      expect(r2.getCell(1).style.alignment?.horizontal).toBe('center')
      expect(merges).toContain('A2:H2')

      // Row 3: blank spacer, height 20
      const r3 = ws.getRow(3)
      expect(r3.height).toBe(20)
    })
  })

  // -------------------------------------------------------------------------
  // Group matrix
  // -------------------------------------------------------------------------
  describe('group matrix', () => {
    it('should render "Group N" label row merged across 2 cols', () => {
      const tournament = buildTestTournament()
      const wb = createRobinCharts(tournament)
      const ws = wb.getWorksheet('MS')!

      // Row 4 is the Group 1 label
      expect(ws.getRow(4).getCell(1).value).toBe('Group 1')
      const merges = (ws.model.merges ?? []).slice().sort()
      expect(merges).toContain('A4:B4')
    })

    it('should render header row with Player, numbers, Points, Position', () => {
      const tournament = buildTestTournament()
      const wb = createRobinCharts(tournament)
      const ws = wb.getWorksheet('MS')!

      // Row 5 is the header for Group 1 (4 entries → maxPlayer=4)
      const header = ws.getRow(5)
      expect(header.getCell(1).value).toBeNull() // empty styled cell
      expect(header.getCell(2).value).toBe('Player')
      expect(header.getCell(3).value).toBe('1')
      expect(header.getCell(4).value).toBe('2')
      expect(header.getCell(5).value).toBe('3')
      expect(header.getCell(6).value).toBe('4')
      expect(header.getCell(7).value).toBe('Points')
      expect(header.getCell(8).value).toBe('Position')
    })

    it('should style header cells with grey fill and bold', () => {
      const tournament = buildTestTournament()
      const wb = createRobinCharts(tournament)
      const ws = wb.getWorksheet('MS')!
      const header = ws.getRow(5)

      // "Player" cell: headerStyle (vertical center, grey fill, bold)
      const playerCell = header.getCell(2)
      expect(playerCell.style.fill?.type).toBe('pattern')
      expect(playerCell.style.fill?.fgColor?.argb).toBe('FFA0A0A0')
      expect(playerCell.style.font?.bold).toBe(true)

      // Number cell: headerStyle2 (vertical+horizontal center, grey fill, bold)
      const numCell = header.getCell(3)
      expect(numCell.style.fill?.fgColor?.argb).toBe('FFA0A0A0')
      expect(numCell.style.font?.bold).toBe(true)
      expect(numCell.style.alignment?.horizontal).toBe('center')
    })

    it('should render diagonal-black pattern in player matrix', () => {
      const tournament = buildTestTournament()
      const wb = createRobinCharts(tournament)
      const ws = wb.getWorksheet('MS')!

      // Player rows start at row 6 (4 players for Group 1)
      // Player 0 (row 6): diagonal at col 3
      const p0diag = ws.getRow(6).getCell(3)
      expect(p0diag.style.fill?.type).toBe('pattern')
      expect(p0diag.style.fill?.fgColor?.argb).toBe('FF000000')

      // Non-diagonal cell (row 6, col 4): bordered, no fill
      const p0nondiag = ws.getRow(6).getCell(4)
      expect(p0nondiag.style.fill?.type).not.toBe('pattern')

      // Player 1 (row 7): diagonal at col 4
      const p1diag = ws.getRow(7).getCell(4)
      expect(p1diag.style.fill?.fgColor?.argb).toBe('FF000000')

      // Player 2 (row 8): diagonal at col 5
      const p2diag = ws.getRow(8).getCell(5)
      expect(p2diag.style.fill?.fgColor?.argb).toBe('FF000000')
    })

    it('should format player name with club suffix', () => {
      const tournament = buildTestTournament()
      const wb = createRobinCharts(tournament)
      const ws = wb.getWorksheet('MS')!

      // Player 0 = Alice (NYC)
      expect(ws.getRow(6).getCell(2).value).toBe('Alice (NYC)')
      // Player 1 = Bob (no club)
      expect(ws.getRow(7).getCell(2).value).toBe('Bob')
      // Player 2 = Charlie (LA)
      expect(ws.getRow(8).getCell(2).value).toBe('Charlie (LA)')
    })

    it('should set row height 25 for player rows', () => {
      const tournament = buildTestTournament()
      const wb = createRobinCharts(tournament)
      const ws = wb.getWorksheet('MS')!

      expect(ws.getRow(6).height).toBe(25)
      expect(ws.getRow(7).height).toBe(25)
    })
  })

  // -------------------------------------------------------------------------
  // Column widths
  // -------------------------------------------------------------------------
  describe('column widths', () => {
    it('should set correct column widths for MS (maxPlayer=4)', () => {
      const tournament = buildTestTournament()
      const wb = createRobinCharts(tournament)
      const ws = wb.getWorksheet('MS')!

      // col 1 = 4.0
      expect(ws.getColumn(1).width).toBe(4)
      // col 2 = auto (max rune count + 1 over column 2 values)
      // "Player" = 6 chars → 7; longest name "Charlie (LA)" = 12 chars → 13
      expect(ws.getColumn(2).width).toBe(13)
      // cols 3-7 = 12.0
      for (let c = 3; c <= 7; c++) {
        expect(ws.getColumn(c).width).toBe(12)
      }
      // cols 8-9 = 10.0
      expect(ws.getColumn(8).width).toBe(10)
      expect(ws.getColumn(9).width).toBe(10)
    })

    it('should set correct column widths for MD (maxPlayer=2)', () => {
      const tournament = buildTestTournament()
      const wb = createRobinCharts(tournament)
      const ws = wb.getWorksheet('MD')!

      // col 1 = 4.0
      expect(ws.getColumn(1).width).toBe(4)
      // cols 3 to 3+2=5 = 12.0
      for (let c = 3; c <= 5; c++) {
        expect(ws.getColumn(c).width).toBe(12)
      }
      // cols 6-7 = 10.0
      expect(ws.getColumn(6).width).toBe(10)
      expect(ws.getColumn(7).width).toBe(10)
    })
  })

  // -------------------------------------------------------------------------
  // Go-vs-TS near-exact comparison
  // -------------------------------------------------------------------------
  describe('Go oracle comparison', () => {
    it('should match the Go-generated chart near-exactly', async () => {
      const tournament = buildTestTournament()
      const tsWb = createRobinCharts(tournament)

      // Serialize TS workbook and re-read for fair comparison
      const tsBuf = await tsWb.xlsx.writeBuffer()
      const tsReread = new ExcelJS.Workbook()
      await tsReread.xlsx.load(tsBuf)

      // Read Go golden
      const goBuf = readGoGolden()
      const goWb = new ExcelJS.Workbook()
      await goWb.xlsx.load(goBuf)

      // Sheet names match
      const goNames = goWb.worksheets.map((ws) => ws.name)
      const tsNames = tsReread.worksheets.map((ws) => ws.name)
      expect(tsNames).toEqual(goNames)

      // Compare each sheet cell-by-cell
      for (const sheetName of goNames) {
        const goWs = goWb.getWorksheet(sheetName)!
        const tsWs = tsReread.getWorksheet(sheetName)!

        // Merges match
        const goMerges = (goWs.model.merges ?? []).slice().sort()
        const tsMerges = (tsWs.model.merges ?? []).slice().sort()
        expect(tsMerges).toEqual(goMerges)

        // Column widths match
        const maxCol = Math.max(goWs.columnCount, tsWs.columnCount)
        for (let c = 1; c <= maxCol; c++) {
          const goW = goWs.getColumn(c).width
          const tsW = tsWs.getColumn(c).width
          // Allow exact match or both undefined
          if (goW !== undefined || tsW !== undefined) {
            expect(tsW).toBe(goW)
          }
        }

        // Row heights match
        const maxRow = Math.max(goWs.rowCount, tsWs.rowCount)
        for (let r = 1; r <= maxRow; r++) {
          const goH = goWs.getRow(r).height
          const tsH = tsWs.getRow(r).height
          if (goH !== undefined || tsH !== undefined) {
            expect(tsH).toBe(goH)
          }
        }

        // Cell values + styles match
        const goCells = collectCells(goWs)
        const tsCells = collectCells(tsWs)

        // Every Go cell must exist in TS with matching value + style
        for (const [key, goInfo] of goCells) {
          const tsInfo = tsCells.get(key)
          expect(tsInfo, `TS cell ${key} missing`).toBeDefined()

          // Value comparison
          const goVal = normalizeValue(goInfo.value)
          const tsVal = normalizeValue(tsInfo!.value)
          if (goVal instanceof Date) {
            expect(tsVal).toBeInstanceOf(Date)
          } else if (typeof goVal === 'object' && goVal !== null) {
            expect(tsVal).toEqual(goVal)
          } else {
            expect(tsVal).toBe(goVal)
          }

          // Style comparison (fills, borders, fonts, alignment)
          const tsStyle = tsInfo!.style
          const goStyle = goInfo.style
          expect(tsStyle.fill).toEqual(goStyle.fill)
          expect(normalizeBorder(tsStyle.border)).toEqual(normalizeBorder(goStyle.border))
          expect(normalizeFont(tsStyle.font)).toEqual(normalizeFont(goStyle.font))
          expect(normalizeAlignment(tsStyle.alignment)).toEqual(normalizeAlignment(goStyle.alignment))
        }

        // Every TS cell must exist in Go (no extra cells)
        for (const key of tsCells.keys()) {
          expect(goCells.has(key), `TS has extra cell ${key} not in Go`).toBe(true)
        }
      }
    })
  })
})