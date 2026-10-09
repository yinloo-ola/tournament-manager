import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { readSheetValidationPrompts } from '../validationPrompts'

describe('readSheetValidationPrompts', () => {
  it('reads prompts from suppressed data validations', async () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('schedule')
    ws.getCell('B2').dataValidation = {
      type: 'custom',
      formulae: ['FALSE'],
      allowBlank: true,
      showErrorMessage: true,
      promptTitle: 'SN',
      prompt: '1'
    }
    const buffer = new Uint8Array(await wb.xlsx.writeBuffer())

    const prompts = await readSheetValidationPrompts(buffer, 'schedule')
    expect(prompts.get('B2')).toBe('1')
  })

  it('lets the first covering prompt win over later overlapping plain rules', async () => {
    // Excel saves a moved cell's prompted rule plus the destination's plain
    // rule as overlapping entries; ExcelJS's parser resolves last-wins and
    // loses the prompt. The scraper must not.
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('schedule')
    ws.getCell('B2').value = 'MS Grp1'
    ws.getCell('B2').dataValidation = {
      type: 'custom',
      formulae: ['FALSE'],
      allowBlank: true,
      showErrorMessage: true,
      promptTitle: 'SN',
      prompt: '34'
    }
    const zip = await JSZip.loadAsync(await wb.xlsx.writeBuffer())
    const sheetPath = 'xl/worksheets/sheet1.xml'
    const xml = await zip.file(sheetPath)!.async('string')
    const patched = xml.replace(
      '</dataValidations>',
      '<dataValidation type="custom" allowBlank="1" showErrorMessage="1" sqref="B2"><formula1>FALSE</formula1></dataValidation></dataValidations>'
    )
    zip.file(sheetPath, patched)
    const buffer = await zip.generateAsync({ type: 'uint8array' })

    const prompts = await readSheetValidationPrompts(buffer, 'schedule')
    expect(prompts.get('B2')).toBe('34')
  })

  it('expands multi-cell sqref ranges', async () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('schedule')
    ws.getCell('B2').dataValidation = {
      type: 'custom',
      formulae: ['FALSE'],
      allowBlank: true,
      showErrorMessage: true,
      promptTitle: 'SN',
      prompt: '7'
    }
    const buffer = new Uint8Array(await wb.xlsx.writeBuffer())

    const prompts = await readSheetValidationPrompts(buffer, 'schedule')
    expect(prompts.get('B2')).toBe('7')
  })

  it('returns an empty map when the sheet has no prompts', async () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('schedule')
    ws.getCell('B2').value = 'MS Grp1'
    const buffer = new Uint8Array(await wb.xlsx.writeBuffer())

    const prompts = await readSheetValidationPrompts(buffer, 'schedule')
    expect(prompts.size).toBe(0)
  })
})
