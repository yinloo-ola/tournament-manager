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

  it('should preserve an interior-blank optional column', () => {
    const workbook: Record<string, string[][]> = {
      entries: [
        ['SN', 'Name', 'Club', 'Seeding', 'Date Of Birth', 'Gender'],
        ['1', 'Alice', 'ClubA', '', '36892', 'F'] // interior blank at Seeding
      ]
    }
    const entries = importSinglesEntries(workbook)

    expect(entries).toHaveLength(1)
    expect(entries[0].seeding).toBeUndefined()
    expect(entries[0].singlesEntry?.player.name).toBe('Alice')
  })

  it('should import a row with trailing blanks trimmed (no DOB/Gender)', () => {
    // readWorkbook trims trailing blank cells — a row missing Gender (and
    // DOB) still has a valid Name and must not be dropped.
    const workbook: Record<string, string[][]> = {
      entries: [
        ['SN', 'Name', 'Club', 'Seeding', 'Date Of Birth', 'Gender'],
        ['1', 'Alice', 'ClubA', '5'],
        ['2', 'Bob', 'ClubB', '', '36893']
      ]
    }
    const entries = importSinglesEntries(workbook)

    expect(entries).toHaveLength(2)
    expect(entries[0].singlesEntry?.player).toEqual({
      name: 'Alice',
      dateOfBirth: '',
      gender: ''
    })
    expect(entries[0].club).toBe('ClubA')
    expect(entries[0].seeding).toBe(5)
    expect(entries[1].singlesEntry?.player.gender).toBe('')
    expect(entries[1].seeding).toBeUndefined()
  })

  it('should skip rows with no name', () => {
    const workbook: Record<string, string[][]> = {
      entries: [
        ['SN', 'Name', 'Club', 'Seeding', 'Date Of Birth', 'Gender'],
        ['1', 'Alice', 'ClubA', '5', '36892', 'F'],
        ['2'] // SN only, no name
      ]
    }
    const entries = importSinglesEntries(workbook)
    expect(entries).toHaveLength(1)
  })

  it('should throw sheet entries does not exist for a workbook lacking the sheet', () => {
    expect(() => importSinglesEntries({})).toThrow('sheet entries does not exist')
  })
})