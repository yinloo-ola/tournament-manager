import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import {
  fixInternalHyperlinks,
  readSheetHyperlinks
} from '../internalHyperlinks'

/** Build a workbook with one internal link, one external link, two sheets. */
async function buildWorkbookBuffer(): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('schedule')
  const wm = wb.addWorksheet('matches')
  wm.getCell('A1').value = 'SN'
  wm.getCell('A2').value = 1
  ws.getCell('A1').value = 'Date/Time'
  ws.getCell('A2').value = { text: 'MS Grp1', hyperlink: 'matches!A2' }
  ws.getCell('B2').value = { text: 'Docs', hyperlink: 'https://example.com/docs' }
  const buffer = await wb.xlsx.writeBuffer()
  return new Uint8Array(buffer)
}

async function readZipEntry(buffer: Uint8Array, path: string): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)
  const file = zip.file(path)
  if (!file) throw new Error(`missing zip entry: ${path}`)
  return file.async('string')
}

describe('fixInternalHyperlinks', () => {
  it('strips the external relationship from location hyperlinks', async () => {
    const buffer = await fixInternalHyperlinks(await buildWorkbookBuffer())

    const sheet = await readZipEntry(buffer, 'xl/worksheets/sheet1.xml')
    expect(sheet).toContain('<hyperlink ref="A2" location="matches!A2"/>')
    expect(sheet).not.toMatch(/<hyperlink[^>]*r:id=[^>]*location/)
    // External link keeps its relationship
    expect(sheet).toContain('<hyperlink ref="B2" r:id="rId')

    const rels = await readZipEntry(buffer, 'xl/worksheets/_rels/sheet1.xml.rels')
    expect(rels).not.toContain('matches!A2')
    expect(rels).toContain('https://example.com/docs')
  })

  it('leaves the buffer untouched when there are no internal hyperlinks', async () => {
    const wb = new ExcelJS.Workbook()
    wb.addWorksheet('plain').getCell('A1').value = 'hello'
    const buffer = new Uint8Array(await wb.xlsx.writeBuffer())

    const fixed = await fixInternalHyperlinks(buffer)
    expect(fixed).toBe(buffer)
  })
})

describe('readSheetHyperlinks', () => {
  it('reads location-only internal links (Excel-native form)', async () => {
    const buffer = await fixInternalHyperlinks(await buildWorkbookBuffer())

    const links = await readSheetHyperlinks(buffer, 'schedule')
    expect(links.get('A2')).toBe('matches!A2')
    expect(links.get('B2')).toBe('https://example.com/docs')
  })

  it('resolves legacy r:id links through the sheet rels', async () => {
    // Unpatched ExcelJS output: internal link carried by an External rel
    const buffer = await buildWorkbookBuffer()

    const links = await readSheetHyperlinks(buffer, 'schedule')
    expect(links.get('A2')).toBe('matches!A2')
  })

  it('returns an empty map when the sheet does not exist', async () => {
    const buffer = await buildWorkbookBuffer()

    const links = await readSheetHyperlinks(buffer, 'nope')
    expect(links.size).toBe(0)
  })
})
