import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readWorkbook } from '@/shared/excel/readWorkbook'
import { importDoublesEntries } from '../importDoubles'
import type { EntryLike } from '../importSingles'

function fixtureBuffer(name: string): Uint8Array {
  return readFileSync(resolve(process.cwd(), 'testdata', name))
}

describe('importDoublesEntries', () => {
  it('should match the Go golden output for Mens Doubles.xlsx', async () => {
    const workbook = await readWorkbook(fixtureBuffer('Mens Doubles.xlsx'))
    const entries = importDoublesEntries(workbook)
    const baselineRaw = readFileSync(
      resolve(
        process.cwd(),
        'src/features/entry/__tests__/golden',
        'doubles.golden.json'
      ),
      'utf-8'
    )
    const baseline = JSON.parse(baselineRaw)

    // Byte-for-byte parity: compact JSON strings must match
    expect(JSON.stringify(entries)).toBe(JSON.stringify(baseline))
    // Deep equality with key-order check
    expect(entries).toEqual(baseline)
  })

  it('should resolve player names via the players sheet map', () => {
    const workbook: Record<string, string[][]> = {
      players: [
        ['SN', 'Name', 'Date Of Birth', 'Gender'],
        ['1', 'Alice', '36892', 'F'],
        ['2', 'Bob', '36893', 'M']
      ],
      entries: [
        ['SN', 'Player1', 'Player2', 'Club', 'Seeding'],
        ['1', 'Alice', 'Bob', 'ClubA', '3']
      ]
    }
    const entries = importDoublesEntries(workbook)

    expect(entries).toHaveLength(1)
    expect(entries[0].doublesEntry?.players[0].name).toBe('Alice')
    expect(entries[0].doublesEntry?.players[1].name).toBe('Bob')
    expect(entries[0].club).toBe('ClubA')
    expect(entries[0].seeding).toBe(3)
  })

  it('should throw player with SN not found for unknown player', () => {
    const workbook: Record<string, string[][]> = {
      players: [
        ['SN', 'Name', 'Date Of Birth', 'Gender'],
        ['1', 'Alice', '36892', 'F']
      ],
      entries: [
        ['SN', 'Player1', 'Player2', 'Club', 'Seeding'],
        ['1', 'Alice', 'Unknown', 'ClubA', '3']
      ]
    }
    expect(() => importDoublesEntries(workbook)).toThrow(
      'player with SN Unknown not found in players sheet'
    )
  })

  it('should handle optional Club and Seeding', () => {
    const workbook: Record<string, string[][]> = {
      players: [
        ['SN', 'Name', 'Date Of Birth', 'Gender'],
        ['1', 'Alice', '36892', 'F'],
        ['2', 'Bob', '36893', 'M']
      ],
      entries: [
        ['SN', 'Player1', 'Player2', 'Club', 'Seeding'],
        ['1', 'Alice', 'Bob', '', ''], // interior blanks
        ['2', 'Alice', 'Bob'] // no club, no seeding
      ]
    }
    const entries = importDoublesEntries(workbook)

    expect(entries).toHaveLength(2)
    expect(entries[0].club).toBeUndefined()
    expect(entries[0].seeding).toBeUndefined()
    expect(entries[1].club).toBeUndefined()
    expect(entries[1].seeding).toBeUndefined()
  })

  it('should throw failed to parse seeding on non-integer', () => {
    const workbook: Record<string, string[][]> = {
      players: [
        ['SN', 'Name', 'Date Of Birth', 'Gender'],
        ['1', 'Alice', '36892', 'F'],
        ['2', 'Bob', '36893', 'M']
      ],
      entries: [
        ['SN', 'Player1', 'Player2', 'Club', 'Seeding'],
        ['1', 'Alice', 'Bob', 'ClubA', 'abc']
      ]
    }
    expect(() => importDoublesEntries(workbook)).toThrow(
      'failed to parse seeding'
    )
  })

  it('should throw sheet does not exist for missing sheets', () => {
    expect(() => importDoublesEntries({})).toThrow(
      'sheet players does not exist'
    )
    expect(() => importDoublesEntries({ players: [] })).toThrow(
      'sheet entries does not exist'
    )
  })
})