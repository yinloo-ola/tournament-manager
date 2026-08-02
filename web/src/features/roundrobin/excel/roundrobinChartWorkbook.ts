import ExcelJS from 'exceljs'
import type { Tournament, Category, Entry } from '@/shared/model'

const GREY_FILL = 'FFA0A0A0'
const BLACK_FILL = 'FF000000'

const thin = { style: 'thin' as const }
const allBorders = {
  top: thin,
  bottom: thin,
  left: thin,
  right: thin,
}

// -------------------------------------------------------------------------
// Style objects — match tealeg/xlsx chart.go styles
// -------------------------------------------------------------------------
const allBorderStyle: Partial<ExcelJS.Style> = {
  alignment: { vertical: 'middle' },
  border: allBorders,
}

const headerStyle: Partial<ExcelJS.Style> = {
  alignment: { vertical: 'middle' },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY_FILL } },
  font: { bold: true },
  border: allBorders,
}

const headerStyle2: Partial<ExcelJS.Style> = {
  alignment: { vertical: 'middle', horizontal: 'center' },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY_FILL } },
  font: { bold: true },
  border: allBorders,
}

const diagonalStyle: Partial<ExcelJS.Style> = {
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: BLACK_FILL } },
  border: allBorders,
}

/**
 * createRobinCharts — port of Go's CreateRobinCharts (tealeg/xlsx → ExcelJS).
 *
 * Builds one sheet per category (named by shortName). Each sheet has a styled
 * header (tournament name, category name) and a round-robin matrix per group
 * with black diagonal cells, grey headers, and bordered cells.
 */
export function createRobinCharts(tournament: Tournament): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  for (const category of tournament.categories) {
    createCategorySheet(wb, tournament.name, category)
  }
  return wb
}

function createCategorySheet(
  wb: ExcelJS.Workbook,
  tournamentName: string,
  category: Category
): void {
  const ws = wb.addWorksheet(category.shortName)

  // Compute maxPlayer = max entriesIdx length across groups
  let maxPlayer = 0
  for (const grp of category.groups) {
    if (grp.entriesIdx.length > maxPlayer) {
      maxPlayer = grp.entriesIdx.length
    }
  }

  // Track longest column-2 value for auto-width computation
  let col2MaxRunes = 0
  const trackCol2 = (s: string) => {
    const runes = [...s].length + 1 // strings.Count(s, "") = runeCount + 1
    if (runes > col2MaxRunes) col2MaxRunes = runes
  }

  let row = 1
  row = createCategoryHeader(ws, row, maxPlayer, tournamentName, category)
  trackCol2('Player')

  for (let g = 0; g < category.groups.length; g++) {
    const grp = category.groups[g]

    // "Group N" row — merged across 2 columns
    const labelCell = ws.getCell(row, 1)
    labelCell.value = `Group ${g + 1}`
    ws.mergeCells(row, 1, row, 2) // Merge(1, 0) → 2 cols total
    row++

    // Resolve entries
    const entries: Entry[] = grp.entriesIdx.map((idx) =>
      idx >= 0 ? category.entries[idx] : (null as unknown as Entry)
    )

    row = createTableForGroup(ws, row, entries, trackCol2)
  }

  // Column widths — match tealeg/xlsx SetColWidth calls exactly
  setColumnWidths(ws, maxPlayer, col2MaxRunes)
}

function createCategoryHeader(
  ws: ExcelJS.Worksheet,
  startRow: number,
  maxPlayer: number,
  tournamentName: string,
  category: Category
): number {
  const totalCols = maxPlayer + 4

  // Row 1: tournament name — merged, bold 20, center, height 30
  const cell1 = ws.getCell(startRow, 1)
  cell1.value = tournamentName
  ws.mergeCells(startRow, 1, startRow, totalCols) // Merge(maxPlayer+3, 0)
  cell1.style = { font: { bold: true, size: 20 }, alignment: { horizontal: 'center' } }
  ws.getRow(startRow).height = 30

  // Row 2: category name — merged, bold 12, center, height 20
  const cell2 = ws.getCell(startRow + 1, 1)
  cell2.value = category.name
  ws.mergeCells(startRow + 1, 1, startRow + 1, totalCols)
  cell2.style = { font: { bold: true, size: 12 }, alignment: { horizontal: 'center' } }
  ws.getRow(startRow + 1).height = 20

  // Row 3: blank spacer, height 20
  ws.getRow(startRow + 2).height = 20

  return startRow + 3
}

function createTableForGroup(
  ws: ExcelJS.Worksheet,
  startRow: number,
  entries: Entry[],
  trackCol2: (s: string) => void
): number {
  // Header row
  const headerRow = startRow
  // Col 1: empty styled cell
  ws.getCell(headerRow, 1).style = headerStyle
  // Col 2: "Player"
  const playerCell = ws.getCell(headerRow, 2)
  playerCell.value = 'Player'
  playerCell.style = headerStyle
  // Cols 3..N+2: player numbers (1-based, as strings matching Go's strconv.Itoa)
  for (let p = 0; p < entries.length; p++) {
    const c = ws.getCell(headerRow, 3 + p)
    c.value = String(p + 1)
    c.style = headerStyle2
  }
  // Col N+3: "Points"
  const pointsCell = ws.getCell(headerRow, 3 + entries.length)
  pointsCell.value = 'Points'
  pointsCell.style = headerStyle2
  // Col N+4: "Position"
  const posCell = ws.getCell(headerRow, 4 + entries.length)
  posCell.value = 'Position'
  posCell.style = headerStyle2

  let row = headerRow + 1

  // Player rows
  for (let p = 0; p < entries.length; p++) {
    const player = entries[p]

    // Col 1: index (string)
    const idxCell = ws.getCell(row, 1)
    idxCell.value = String(p + 1)
    idxCell.style = allBorderStyle

    // Col 2: player name with optional club suffix
    let playerStr = player?.name ?? ''
    if (player?.club && player.club.length > 0) {
      playerStr += ` (${player.club})`
    }
    const nameCell = ws.getCell(row, 2)
    nameCell.value = playerStr
    nameCell.style = allBorderStyle
    trackCol2(playerStr)

    // Cols 3..N+2: matrix cells (diagonal = black)
    for (let p2 = 0; p2 < entries.length; p2++) {
      const resultCell = ws.getCell(row, 3 + p2)
      if (p2 === p) {
        resultCell.style = diagonalStyle
      } else {
        resultCell.style = allBorderStyle
      }
    }

    // Cols N+3, N+4: Points, Position (empty bordered)
    ws.getCell(row, 3 + entries.length).style = allBorderStyle
    ws.getCell(row, 4 + entries.length).style = allBorderStyle

    ws.getRow(row).height = 25
    row++
  }

  // Blank row after table
  row++

  return row
}

/**
 * Set column widths to match tealeg/xlsx chart.go:
 * - col 1 = 4.0
 * - col 2 = auto (max rune count + 1)
 * - cols 3 to 3+maxPlayer = 12.0
 * - cols 3+maxPlayer+1 to 3+maxPlayer+2 = 10.0
 */
function setColumnWidths(
  ws: ExcelJS.Worksheet,
  maxPlayer: number,
  col2AutoWidth: number
): void {
  ws.getColumn(1).width = 4
  ws.getColumn(2).width = col2AutoWidth || 9 // fallback to default if no data
  for (let c = 3; c <= 3 + maxPlayer; c++) {
    ws.getColumn(c).width = 12
  }
  ws.getColumn(3 + maxPlayer + 1).width = 10
  ws.getColumn(3 + maxPlayer + 2).width = 10
}