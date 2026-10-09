import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { fixInvalidPageSetupDpi } from '../pageSetupDpi'

async function readZipEntry(buffer: Uint8Array, path: string): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)
  const file = zip.file(path)
  if (!file) throw new Error(`missing zip entry: ${path}`)
  return file.async('string')
}

describe('fixInvalidPageSetupDpi', () => {
  it('strips the ExcelJS sentinel DPI from every worksheet pageSetup', async () => {
    const wb = new ExcelJS.Workbook()
    wb.addWorksheet('schedule')
    wb.addWorksheet('matches')
    const buffer = new Uint8Array(await wb.xlsx.writeBuffer())

    // Precondition: stock ExcelJS output carries the sentinel on every sheet
    const before = await readZipEntry(buffer, 'xl/worksheets/sheet1.xml')
    expect(before).toContain('horizontalDpi="4294967295"')

    const fixed = await fixInvalidPageSetupDpi(buffer)
    for (const path of ['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']) {
      const xml = await readZipEntry(fixed, path)
      expect(xml).not.toContain('4294967295')
      // The rest of pageSetup survives
      expect(xml).toContain('<pageSetup ')
      expect(xml).toContain('orientation="portrait"')
    }
  })

  it('keeps explicitly configured DPI values', async () => {
    const wb = new ExcelJS.Workbook()
    wb.addWorksheet('planned', {
      pageSetup: { horizontalDpi: 600, verticalDpi: 600 }
    })
    const buffer = new Uint8Array(await wb.xlsx.writeBuffer())

    const fixed = await fixInvalidPageSetupDpi(buffer)
    const xml = await readZipEntry(fixed, 'xl/worksheets/sheet1.xml')
    expect(xml).toContain('horizontalDpi="600"')
    expect(xml).toContain('verticalDpi="600"')
  })

  it('leaves the buffer untouched when no sheet carries the sentinel', async () => {
    const wb = new ExcelJS.Workbook()
    wb.addWorksheet('plain')
    const once = await fixInvalidPageSetupDpi(
      new Uint8Array(await wb.xlsx.writeBuffer())
    )
    const twice = await fixInvalidPageSetupDpi(once)
    expect(twice).toBe(once)
  })
})
