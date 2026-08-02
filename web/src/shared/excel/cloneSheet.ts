import ExcelJS from 'exceljs'

/**
 * cloneSheet — deep-copy a source ExcelJS Worksheet into a new worksheet
 * within a target Workbook.
 *
 * ExcelJS has no built-in `copySheet`/`CopySheet`. This helper replicates
 * Go's `excelize.CopySheet` (a `deepcopy.Copy` of the entire worksheet XML):
 * every cell's value **and** full style object, all merged-cell ranges,
 * column widths/properties, and row heights/properties.
 *
 * Style objects are deep-cloned (JSON round-trip) so the clone and source
 * share no references — mutating one never bleeds into the other.
 */
export function cloneSheet(
  source: ExcelJS.Worksheet,
  targetWorkbook: ExcelJS.Workbook,
  newName: string
): ExcelJS.Worksheet {
  const target = targetWorkbook.addWorksheet(newName)

  copyColumns(source, target)
  copyRows(source, target)
  copyMerges(source, target)

  return target
}

// -------------------------------------------------------------------------
// Column properties (width, hidden, outlineLevel, style)
// -------------------------------------------------------------------------
function copyColumns(source: ExcelJS.Worksheet, target: ExcelJS.Worksheet): void {
  eachDefinedColumn(source, (src) => {
    const tgt = target.getColumn(src.number)

    if (src.width !== undefined) tgt.width = src.width
    if (src.hidden) tgt.hidden = src.hidden
    if (src.outlineLevel) tgt.outlineLevel = src.outlineLevel

    // Column-level style (borders/fills applied to entire column)
    if (src.style && hasStyleProps(src.style)) {
      tgt.style = deepCloneStyle(src.style)
    }
  })
}

// -------------------------------------------------------------------------
// Row properties (height, hidden, outlineLevel) + cell values + styles
// -------------------------------------------------------------------------
function copyRows(source: ExcelJS.Worksheet, target: ExcelJS.Worksheet): void {
  source.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const tgtRow = target.getRow(rowNumber)

    if (row.height) tgtRow.height = row.height
    if (row.hidden) tgtRow.hidden = row.hidden
    if (row.outlineLevel) tgtRow.outlineLevel = row.outlineLevel

    // Row-level style — Row extends Style at the type level but exposes
    // individual facets (font, fill, etc.) via getters/setters that delegate
    // to an internal `style` object. Access via cast since TS types don't
    // expose the `style` container directly.
    const rowStyle = (row as unknown as { style?: Partial<ExcelJS.Style> }).style
    if (rowStyle && hasStyleProps(rowStyle)) {
      ;(tgtRow as unknown as { style: Partial<ExcelJS.Style> }).style =
        deepCloneStyle(rowStyle)
    }

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const tgtCell = target.getCell(rowNumber, colNumber)

      // Deep-clone style to avoid shared references
      tgtCell.style = deepCloneStyle(cell.style)

      // Only copy values for non-merge-type cells.
      // Merge-type (ValueType.Merge = 1) cells reference the source master;
      // the merge ranges copied in copyMerges() will establish the correct
      // master/slave relationships in the target.
      if (cell.type !== ExcelJS.ValueType.Merge) {
        tgtCell.value = cloneValue(cell.value)
      }
    })
  })
}

// -------------------------------------------------------------------------
// Merged-cell ranges
// -------------------------------------------------------------------------
function copyMerges(source: ExcelJS.Worksheet, target: ExcelJS.Worksheet): void {
  const merges = source.model.merges ?? []
  for (const range of merges) {
    target.mergeCells(range)
  }
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

/**
 * Deep-clone a cell value, handling Date and object types.
 * Primitives (string, number, boolean) are immutable — returned as-is.
 */
function cloneValue(value: ExcelJS.CellValue): ExcelJS.CellValue {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return new Date(value.getTime())
  if (typeof value === 'object') {
    // Formula { formula, result }, RichText { richText: [...] },
    // Hyperlink { hyperlink, text }, etc. — all plain JSON-serializable.
    return JSON.parse(JSON.stringify(value))
  }
  return value
}

/**
 * Deep-clone a style object via JSON round-trip.
 *
 * Style objects contain only plain objects and primitives (font, fill, border,
 * alignment, numFmt, protection) — no Dates, functions, or special types —
 * so JSON clone is safe and produces a structurally independent copy.
 */
function deepCloneStyle(style: Partial<ExcelJS.Style>): Partial<ExcelJS.Style> {
  return JSON.parse(JSON.stringify(style))
}

/**
 * Check whether a style partial has any non-default properties set.
 * Used to avoid writing empty style objects to columns/rows.
 */
function hasStyleProps(style: Partial<ExcelJS.Style>): boolean {
  return Boolean(
    style.font ||
      style.fill ||
      style.border ||
      style.alignment ||
      style.numFmt ||
      style.protection
  )
}

/**
 * Iterate every column that has been explicitly configured (width, hidden,
 * outlineLevel, or style) on the source. Uses the internal `_columns` sparse
 * array because ExcelJS's public `columnCount` only reflects columns that
 * have cell values — columns configured with widths but no cells are invisible
 * to it.
 */
function eachDefinedColumn(
  ws: ExcelJS.Worksheet,
  cb: (col: ExcelJS.Column) => void
): void {
  const cols = (ws as unknown as { _columns: (ExcelJS.Column | undefined)[] })._columns
  if (!cols) return
  for (let i = 0; i < cols.length; i++) {
    if (cols[i]) cb(cols[i]!)
  }
}