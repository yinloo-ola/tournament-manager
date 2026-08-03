import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cloneSheet } from '../cloneSheet'

function readTemplateBuffer(): Buffer {
  return readFileSync(resolve(process.cwd(), 'testdata/scoresheet template.xlsx'))
}

/**
 * Deep-compare two cell style objects for equality.
 * ExcelJS style objects may have slightly different key ordering or undefined
 * values; toEqual handles this. We extract the 6 style facets.
 */
function expectStyleEqual(
  sourceCell: ExcelJS.Cell,
  targetCell: ExcelJS.Cell
) {
  expect(targetCell.style).toEqual(sourceCell.style)
}

describe('cloneSheet', () => {
  // -------------------------------------------------------------------------
  // Cell values — correct type parity
  // -------------------------------------------------------------------------
  describe('cell values', () => {
    it('should clone all cell values with correct types', () => {
      const wb = new ExcelJS.Workbook()
      const src = wb.addWorksheet('src')

      src.getCell('A1').value = 'hello'
      src.getCell('A2').value = 42
      src.getCell('A3').value = 3.14
      src.getCell('A4').value = true
      src.getCell('A5').value = new Date('2025-03-22T09:00:00Z')
      src.getCell('A6').value = { formula: 'SUM(B1:B3)', result: 6 }
      src.getCell('A7').value = {
        richText: [
          { font: { bold: true }, text: 'Bold' },
          { font: { italic: true }, text: 'Italic' },
        ],
      }
      src.getCell('A8').value = { hyperlink: 'http://example.com', text: 'Link' }

      const clone = cloneSheet(src, wb, 'clone')

      expect(clone.getCell('A1').value).toBe('hello')
      expect(clone.getCell('A2').value).toBe(42)
      expect(clone.getCell('A3').value).toBe(3.14)
      expect(clone.getCell('A4').value).toBe(true)
      expect(clone.getCell('A5').value).toEqual(new Date('2025-03-22T09:00:00Z'))
      expect(clone.getCell('A6').value).toEqual({
        formula: 'SUM(B1:B3)',
        result: 6,
      })
      expect(clone.getCell('A7').value).toEqual({
        richText: [
          { font: { bold: true }, text: 'Bold' },
          { font: { italic: true }, text: 'Italic' },
        ],
      })
      expect(clone.getCell('A8').value).toEqual({
        hyperlink: 'http://example.com',
        text: 'Link',
      })
    })
  })

  // -------------------------------------------------------------------------
  // Cell styles — full style object parity
  // -------------------------------------------------------------------------
  describe('cell styles', () => {
    it('should clone all cell styles (font, fill, border, alignment, numFmt)', () => {
      const wb = new ExcelJS.Workbook()
      const src = wb.addWorksheet('src')

      // Cell with font + fill + border + alignment
      const c1 = src.getCell('A1')
      c1.value = 'styled'
      c1.style = {
        font: { bold: true, size: 14, color: { argb: 'FFFF0000' } },
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFA0A0A0' },
        },
        border: {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } },
        },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        numFmt: 'General',
        protection: { locked: true },
      }

      // Cell with different alignment + numFmt
      const c2 = src.getCell('B1')
      c2.value = 'fmt'
      c2.style = {
        font: { italic: true, size: 12 },
        alignment: { horizontal: 'left', vertical: 'top' },
        numFmt: '0.00',
      }

      const clone = cloneSheet(src, wb, 'clone')

      expectStyleEqual(src.getCell('A1'), clone.getCell('A1'))
      expectStyleEqual(src.getCell('B1'), clone.getCell('B1'))
    })

    it('should not share style references (mutating clone does not affect source)', () => {
      const wb = new ExcelJS.Workbook()
      const src = wb.addWorksheet('src')
      const c = src.getCell('A1')
      c.value = 'test'
      c.style = {
        font: { bold: true },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA0A0A0' } },
      }

      const clone = cloneSheet(src, wb, 'clone')

      // Mutate the clone
      clone.getCell('A1').style.font = { italic: true, size: 20 }
      clone.getCell('A1').style.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF00FF00' },
      }

      // Source should be unaffected
      expect(src.getCell('A1').style.font).toEqual({ bold: true })
      expect(src.getCell('A1').style.fill).toEqual({
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFA0A0A0' },
      })
    })
  })

  // -------------------------------------------------------------------------
  // Merged-cell ranges
  // -------------------------------------------------------------------------
  describe('merges', () => {
    it('should clone merged-cell ranges', () => {
      const wb = new ExcelJS.Workbook()
      const src = wb.addWorksheet('src')
      src.getCell('B1').value = 'merged-header'
      src.mergeCells('B1:X1')
      src.getCell('B5').value = 'merged-grid'
      src.mergeCells('B5:I6')
      src.getCell('S8').value = 'merged-vert'
      src.mergeCells('S8:S9')

      const clone = cloneSheet(src, wb, 'clone')

      const srcMerges = (src.model.merges ?? []).slice().sort()
      const cloneMerges = (clone.model.merges ?? []).slice().sort()
      expect(cloneMerges).toEqual(srcMerges)
      expect(cloneMerges.length).toBe(3)
    })
  })

  // -------------------------------------------------------------------------
  // Column widths and row heights
  // -------------------------------------------------------------------------
  describe('dimensions', () => {
    it('should clone column widths and row heights', () => {
      const wb = new ExcelJS.Workbook()
      const src = wb.addWorksheet('src')
      src.getColumn(2).width = 15.5
      src.getColumn(4).width = 8.0
      src.getRow(1).height = 30
      src.getRow(5).height = 25
      src.getCell('A1').value = 'x'
      src.getCell('A5').value = 'y'

      const clone = cloneSheet(src, wb, 'clone')

      expect(clone.getColumn(2).width).toBe(15.5)
      expect(clone.getColumn(4).width).toBe(8.0)
      expect(clone.getRow(1).height).toBe(30)
      expect(clone.getRow(5).height).toBe(25)
    })

    it('should clone column hidden and outlineLevel', () => {
      const wb = new ExcelJS.Workbook()
      const src = wb.addWorksheet('src')
      src.getColumn(3).hidden = true
      src.getColumn(3).outlineLevel = 1
      src.getCell('A1').value = 'x'

      const clone = cloneSheet(src, wb, 'clone')
      expect(clone.getColumn(3).hidden).toBe(true)
      expect(clone.getColumn(3).outlineLevel).toBe(1)
    })
  })

  // -------------------------------------------------------------------------
  // Empty worksheet
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('should clone an empty worksheet without error', () => {
      const wb = new ExcelJS.Workbook()
      const src = wb.addWorksheet('src')

      const clone = cloneSheet(src, wb, 'clone')
      expect(clone).toBeDefined()
      expect(clone.rowCount).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // .xlsx round-trip fidelity
  // -------------------------------------------------------------------------
  describe('round-trip', () => {
    it('should preserve styles through .xlsx round-trip', async () => {
      const wb = new ExcelJS.Workbook()
      const src = wb.addWorksheet('src')

      const c = src.getCell('A1')
      c.value = 'round-trip'
      c.style = {
        font: { bold: true, size: 16 },
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFA0A0A0' },
        },
        border: {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        },
        alignment: { horizontal: 'center', vertical: 'middle' },
      }
      src.getColumn(1).width = 20
      src.getRow(1).height = 30
      src.mergeCells('A1:C1')

      const clone = cloneSheet(src, wb, 'clone')

      // Serialize and re-read
      const buf = await wb.xlsx.writeBuffer()
      const wb2 = new ExcelJS.Workbook()
      await wb2.xlsx.load(buf)

      const reReadSrc = wb2.getWorksheet('src')!
      const reReadClone = wb2.getWorksheet('clone')!

      // Values match
      expect(reReadClone.getCell('A1').value).toBe('round-trip')
      // Styles match between source and clone after round-trip
      expectStyleEqual(reReadSrc.getCell('A1'), reReadClone.getCell('A1'))
      // Merges match
      const cloneMerges = (reReadClone.model.merges ?? []).slice().sort()
      const srcMerges = (reReadSrc.model.merges ?? []).slice().sort()
      expect(cloneMerges).toEqual(srcMerges)
      // Dimensions match
      expect(reReadClone.getColumn(1).width).toBe(reReadSrc.getColumn(1).width)
      expect(reReadClone.getRow(1).height).toBe(reReadSrc.getRow(1).height)
    })

    it('should clone worksheet-level print settings (pageSetup, headerFooter)', () => {
      const wb = new ExcelJS.Workbook()
      const src = wb.addWorksheet('src', {
        pageSetup: {
          paperSize: 9,
          orientation: 'portrait' as const,
          fitToPage: true,
          fitToHeight: 0,
          scale: 77,
        },
        headerFooter: {
          oddHeader: '&C&A',
          oddFooter: '&CPage &P of &N',
        },
      })
      src.getCell('A1').value = 'x'

      const clone = cloneSheet(src, wb, 'clone')

      expect(clone.pageSetup.paperSize).toBe(9)
      expect(clone.pageSetup.orientation).toBe('portrait')
      expect(clone.pageSetup.fitToPage).toBe(true)
      expect(clone.pageSetup.scale).toBe(77)
      expect(clone.headerFooter.oddHeader).toBe('&C&A')
      expect(clone.headerFooter.oddFooter).toBe('&CPage &P of &N')
    })

    it('should preserve pageSetup on real template through clone', async () => {
      const buf = readTemplateBuffer()
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buf)

      const src = wb.getWorksheet('MS')!
      cloneSheet(src, wb, 'MS-clone')
      const clone = wb.getWorksheet('MS-clone')!

      // MS template has scale=77, fitToHeight=0, portrait
      expect(clone.pageSetup.orientation).toBe(src.pageSetup.orientation)
      expect(clone.pageSetup.scale).toBe(src.pageSetup.scale)
      expect(clone.pageSetup.fitToHeight).toBe(src.pageSetup.fitToHeight)
    })
  })

  // -------------------------------------------------------------------------
  // Real template sheet — the most rigorous test
  // -------------------------------------------------------------------------
  describe('real template (scoresheet template.xlsx)', () => {
    it('should clone the MS sheet with same merges, values, and styles', async () => {
      const buf = readTemplateBuffer()
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buf)

      const src = wb.getWorksheet('MS')!

      const clone = cloneSheet(src, wb, 'MS-clone')

      // Same merge count (MS has 29 ranges)
      const srcMerges = (src.model.merges ?? []).slice().sort()
      const cloneMerges = (clone.model.merges ?? []).slice().sort()
      expect(cloneMerges).toEqual(srcMerges)
      expect(cloneMerges.length).toBe(srcMerges.length)

      // Every cell value matches
      let valueCount = 0
      src.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const cloneCell = clone.getCell(rowNumber, colNumber)
          const srcVal = cell.value
          const cloneVal = cloneCell.value

          if (srcVal !== null && srcVal !== undefined) {
            valueCount++
            if (srcVal instanceof Date) {
              expect(cloneVal).toBeInstanceOf(Date)
              expect((cloneVal as Date).getTime()).toBe(srcVal.getTime())
            } else if (typeof srcVal === 'object') {
              expect(cloneVal).toEqual(srcVal)
            } else {
              expect(cloneVal).toBe(srcVal)
            }
          }
        })
      })
      expect(valueCount).toBeGreaterThan(0) // ensure we actually iterated cells

      // Every styled cell's style matches — now that we use
      // mergeCellsWithoutStyle, even non-master merge cells retain their
      // individually-cloned styles.
      let styleCount = 0
      src.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const srcStyle = cell.style
          // Only check cells that have non-default styles
          if (
            srcStyle.font?.bold ||
            srcStyle.font?.size ||
            srcStyle.fill?.type === 'pattern' ||
            srcStyle.border?.top?.style ||
            srcStyle.numFmt !== 'General'
          ) {
            styleCount++
            const cloneStyle = clone.getCell(rowNumber, colNumber).style
            expect(cloneStyle).toEqual(srcStyle)
          }
        })
      })
      expect(styleCount).toBeGreaterThan(0) // ensure we found styled cells
    })

    it('should produce a clone that survives its own .xlsx round-trip', async () => {
      const buf = readTemplateBuffer()
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buf)

      const src = wb.getWorksheet('MD')!

      // Serialize clone-only into a fresh workbook and re-read
      const wb2 = new ExcelJS.Workbook()
      cloneSheet(src, wb2, 'MD')
      const outBuf = await wb2.xlsx.writeBuffer()

      const wb3 = new ExcelJS.Workbook()
      await wb3.xlsx.load(outBuf)
      const reRead = wb3.getWorksheet('MD')!

      // Merges survive
      const srcMerges = (src.model.merges ?? []).slice().sort()
      const reReadMerges = (reRead.model.merges ?? []).slice().sort()
      expect(reReadMerges).toEqual(srcMerges)

      // Values survive
      let checked = 0
      src.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          if (cell.value !== null) {
            checked++
            const v = reRead.getCell(rowNumber, colNumber).value
            if (typeof cell.value === 'object' && !(cell.value instanceof Date)) {
              expect(v).toEqual(cell.value)
            } else if (cell.value instanceof Date) {
              expect(v).toBeInstanceOf(Date)
            } else {
              expect(v).toBe(cell.value)
            }
          }
        })
      })
      expect(checked).toBeGreaterThan(0)
    })
  })
})