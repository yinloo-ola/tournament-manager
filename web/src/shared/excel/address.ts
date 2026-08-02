/**
 * Cell-name splitting — port of `excelize.SplitCellName` behavior.
 *
 * Splits a cell address like "AC21" into `{ col: "AC", row: 21 }`.
 * The Go import (`getMatchFromCellAddr`) uses `excelize.SplitCellName` to
 * extract the row number from a hyperlink target like "matches!A2".
 *
 * Note: `utils/excelhelper.SplitRowCol` is dead code (not called anywhere);
 * this implements the behavior of the actually-used `excelize.SplitCellName`.
 */

export interface CellAddress {
  col: string
  row: number
}

/**
 * Split a cell address into its column letters and row number.
 *
 * @param addr - Cell address like "A1", "AC21", "ZZ99" (case-insensitive)
 * @returns `{ col: "AC", row: 21 }` (col is uppercase)
 * @throws if the address is empty, has invalid characters, letters after digits,
 *         or is missing the column or row part.
 */
export function splitCellName(addr: string): CellAddress {
  if (addr.length === 0) {
    throw new Error('empty cell address')
  }

  const upper = addr.toUpperCase()

  // First character must be a letter
  if (upper.charCodeAt(0) < 65 || upper.charCodeAt(0) > 90) {
    throw new Error(`invalid cell address: must start with letters`)
  }

  let colStr = ''
  let rowStr = ''
  let seenNumber = false

  for (const char of upper) {
    if (char >= 'A' && char <= 'Z') {
      if (seenNumber) {
        throw new Error('invalid cell address: letters must come before numbers')
      }
      colStr += char
    } else if (char >= '0' && char <= '9') {
      seenNumber = true
      rowStr += char
    } else {
      throw new Error('invalid cell address: contains invalid characters')
    }
  }

  if (colStr.length === 0) {
    throw new Error('invalid cell address: missing column letters')
  }
  if (rowStr.length === 0) {
    throw new Error('invalid cell address: missing row numbers')
  }

  return { col: colStr, row: parseInt(rowStr, 10) }
}