import ExcelJS from 'exceljs'

/**
 * readWorkbook mirrors Go's excelize GetRows(sheetName, Options{RawCellValue: true}).
 *
 * It opens an uploaded .xlsx (File or ArrayBuffer) with ExcelJS and returns
 * sheet-name → rows of raw cell values as strings, exactly as Go's GetRows
 * produces [][]string:
 *  - Date-formatted cells (Excel serials) are returned as the raw serial string
 *    ("36892"), NOT a JS Date — defeats ExcelJS date coercion.
 *  - Interior blank cells are "" (matching Go's appendSpace).
 *  - Trailing blank cells are dropped (matching Go's GetRows).
 *  - Numeric cells stringify without float artifacts ("1", not "1.0").
 *  - Whitespace is NOT trimmed by the wrapper (importers trim, as Go does).
 *
 * Importers consume only this shape, so the Go ports stay near-verbatim.
 */
export async function readWorkbook(
  source: File | ArrayBuffer | Uint8Array
): Promise<Record<string, string[][]>> {
  const buffer = source instanceof File ? await source.arrayBuffer() : source
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const result: Record<string, string[][]> = {}
  workbook.eachSheet((worksheet) => {
    result[worksheet.name] = readSheet(worksheet)
  })
  return result
}

function readSheet(worksheet: ExcelJS.Worksheet): string[][] {
  const rows: string[][] = []
  worksheet.eachRow((row) => {
    rows.push(readRow(row))
  })
  return rows
}

/**
 * readRow converts an ExcelJS row to a string[] matching Go's GetRows output.
 *
 * ExcelJS row.values is a 1-indexed array (index 0 unused). Missing cells are
 * undefined. We stringify each value, inserting "" for interior gaps (matching
 * Go's appendSpace), and trim trailing blanks (matching Go's GetRows which only
 * appends cells with non-empty values).
 */
function readRow(row: ExcelJS.Row): string[] {
  // row.values can be CellValue[] (1-indexed) or { [key: string]: CellValue }
  // when accessed by column letter. We only use the array form.
  const values = row.values as unknown[]
  const cells: string[] = []
  let lastNonEmpty = 0

  for (let col = 1; col < values.length; col++) {
    const str = cellToString(values[col])
    cells.push(str)
    if (str !== '') {
      lastNonEmpty = col
    }
  }

  // Trim trailing blanks — Go's GetRows drops them because only non-empty
  // cell values trigger append (and appendSpace fills gaps before them).
  return cells.slice(0, lastNonEmpty)
}

/**
 * cellToString converts an ExcelJS cell value to the raw string Go's excelize
 * produces with RawCellValue: true.
 *
 * The critical case is date-formatted cells: ExcelJS coerces them to JS Date
 * objects. We convert back to the Excel 1900-system serial number string,
 * which is what Go reads from the raw cell value.
 */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) {
    return String(dateToExcelSerial(value))
  }
  if (typeof value === 'number') {
    return String(value)
  }
  if (typeof value === 'string') {
    return value
  }
  // Formula cells: { formula: string, result: any } — extract the cached result
  if (typeof value === 'object' && value !== null) {
    if ('result' in value) {
      return cellToString((value as { result: unknown }).result)
    }
    // Rich text: { richText: [{ text: string }, ...] }
    if ('richText' in value) {
      return (value as { richText: { text: string }[] }).richText
        .map((r) => r.text)
        .join('')
    }
  }
  return String(value)
}

/**
 * dateToExcelSerial converts a JS Date back to the Excel 1900-system serial
 * number, reversing ExcelJS's excelToDate conversion:
 *   excelToDate: new Date(Math.round((serial - 25569) * 86400000))
 *   inverse:     serial = 25569 + date.getTime() / 86400000
 *
 * 25569 is the Excel serial for 1970-01-01 (Unix epoch) in the 1900 date
 * system, which accounts for Excel's 1900 leap-year bug. For integer serials
 * (whole days at midnight UTC) the round-trip is exact.
 */
function dateToExcelSerial(date: Date): number {
  return Math.round(25569 + date.getTime() / (24 * 3600 * 1000))
}