import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readWorkbook } from '@/shared/excel/readWorkbook'
import { importSinglesEntries } from '../importSingles'
import type { EntryLike } from '../importSingles'

function fixtureBuffer(name: string): Uint8Array {
  const path = resolve(process.cwd(), 'testdata', name)
  return readFileSync(path)
}

function loadGolden(name: string): EntryLike[] {
  const path = resolve(
    process.cwd(),
    'src/features/entry/__tests__/golden',
    name
  )
  return JSON.parse(readFileSync(path, 'utf-8'))
}

describe('importSinglesEntries', () => {
  it('should match the Go golden output for Men Singles.xlsx', async () => {
    const workbook = await readWorkbook(fixtureBuffer('Men Singles.xlsx'))
    const entries = importSinglesEntries(workbook)
    const baselineRaw = readFileSync(
      resolve(process.cwd(), 'src/features/entry/__tests__/golden', 'singles.golden.json'),
      'utf-8'
    )
    const baseline = JSON.parse(baselineRaw)

    // Byte-for-byte parity: compact JSON strings must match
    expect(JSON.stringify(entries)).toBe(JSON.stringify(baseline))
    // Deep equality with key-order check
    expect(entries).toEqual(baseline)
  })

  it('should parse a valid seeding and omit an empty one', () => {
    const workbook: Record<string, string[][]> = {
      entries: [
        ['SN', 'Name', 'Club', 'Seeding', 'Date Of Birth', 'Gender'],
        ['1', 'Alice', 'ClubA', '5', '36892', 'F'],
        ['2', 'Bob', 'ClubB', '', '36893', 'M']
      ]
    }
    const entries = importSinglesEntries(workbook)

    expect(entries).toHaveLength(2)
    expect(entries[0].seeding).toBe(5)
    expect(entries[1].seeding).toBeUndefined()
  })

  it('should throw failed to parse seeding on a non-integer seeding', () => {
    const workbook: Record<string, string[][]> = {
      entries: [
        ['SN', 'Name', 'Club', 'Seeding', 'Date Of Birth', 'Gender'],
        ['1', 'Alice', 'ClubA', 'abc', '36892', 'F']
      ]
    }
    expect(() => importSinglesEntries(workbook)).toThrow('failed to parse seeding')

    const workbook2: Record<string, string[][]> = {
      entries: [
        ['SN', 'Name', 'Club', 'Seeding', 'Date Of Birth', 'Gender'],
        ['1', 'Alice', 'ClubA', '1.5', '36892', 'F']
      ]
    }
    expect(() => importSinglesEntries(workbook2)).toThrow('failed to parse seeding')
  })

  it('should skip short rows and preserve an interior-blank optional column', () => {
    // Row with only 5 non-trailing cells (interior blank at Seeding, full width 6)
    // should be kept; a row with fewer than 6 cells should be skipped.
    const workbook: Record<string, string[][]> = {
      entries: [
        ['SN', 'Name', 'Club', 'Seeding', 'Date Of Birth', 'Gender'],
        ['1', 'Alice', 'ClubA', '', '36892', 'F'], // interior blank at Seeding
        ['2', 'Short'] // len < 6, should be skipped
      ]
    }
    const entries = importSinglesEntries(workbook)

    expect(entries).toHaveLength(1)
    expect(entries[0].seeding).toBeUndefined()
    expect(entries[0].singlesEntry?.player.name).toBe('Alice')
  })

  it('should throw sheet entries does not exist for a workbook lacking the sheet', () => {
    expect(() => importSinglesEntries({})).toThrow('sheet entries does not exist')
  })
})