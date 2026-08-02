import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readWorkbook } from '../readWorkbook'

function fixtureBuffer(name: string): Uint8Array {
  const path = resolve(process.cwd(), '../testdata', name)
  return readFileSync(path)
}

function loadGolden(name: string): Record<string, string[][]> {
  const path = resolve(
    process.cwd(),
    'src/features/entry/__tests__/golden',
    name
  )
  return JSON.parse(readFileSync(path, 'utf-8'))
}

describe('readWorkbook', () => {
  it('should expose raw serial dates, not JS Dates', async () => {
    const workbook = await readWorkbook(fixtureBuffer('Men Singles.xlsx'))
    const rows = workbook['entries']
    // Row 1 (Fan Zhendong) DOB is at index 4, Excel serial 36892
    expect(rows[1][4]).toBe('36892')
    expect(typeof rows[1][4]).toBe('string')
    // Verify a few more DOB serials
    expect(rows[2][4]).toBe('36893')
    expect(rows[3][4]).toBe('36894')
  })

  it('should insert interior blanks and trim trailing blanks (Go row-shape parity)', async () => {
    const workbook = await readWorkbook(fixtureBuffer('Men Singles.xlsx'))
    const rows = workbook['entries']
    // Row 10 (SN=10, Truls Moregard) has no Seeding cell — interior blank at index 3
    expect(rows[10]).toHaveLength(6)
    expect(rows[10][3]).toBe('') // Seeding is interior blank
    expect(rows[10][0]).toBe('10')
    expect(rows[10][1]).toBe('Truls Moregard')
    expect(rows[10][2]).toBe('Sweden')
    expect(rows[10][4]).toBe('36901')
    expect(rows[10][5]).toBe('M')

    // No row should carry trailing ""
    for (const row of rows) {
      if (row.length > 0) {
        expect(row[row.length - 1]).not.toBe('')
      }
    }
  })

  it('should stringify numbers without float artifacts', async () => {
    const workbook = await readWorkbook(fixtureBuffer('Men Singles.xlsx'))
    const rows = workbook['entries']
    // SN cells (index 0) should be "1", "2", ... not "1.0"
    expect(rows[1][0]).toBe('1')
    expect(rows[2][0]).toBe('2')
    // Seeding cells (index 3) should be "1", "2", ...
    expect(rows[1][3]).toBe('1')
    expect(rows[2][3]).toBe('2')
    // Verify no ".0" suffix anywhere in SN/Seeding
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i][0]).not.toMatch(/\.0$/)
      if (rows[i][3] !== '') {
        expect(rows[i][3]).not.toMatch(/\.0$/)
      }
    }
  })

  it('should match the Go-captured raw rows for Men Singles.xlsx', async () => {
    const workbook = await readWorkbook(fixtureBuffer('Men Singles.xlsx'))
    const expected = loadGolden('singles.rows.json')
    expect(workbook).toEqual(expected)
  })

  it('should match the Go-captured raw rows for Mens Doubles.xlsx', async () => {
    const workbook = await readWorkbook(fixtureBuffer('Mens Doubles.xlsx'))
    const expected = loadGolden('doubles.rows.json')
    expect(workbook).toEqual(expected)
  })

  it('should match the Go-captured raw rows for Mens Team.xlsx', async () => {
    const workbook = await readWorkbook(fixtureBuffer('Mens Team.xlsx'))
    const expected = loadGolden('team.rows.json')
    expect(workbook).toEqual(expected)
  })
})