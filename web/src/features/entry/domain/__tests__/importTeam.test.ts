import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readWorkbook } from '@/shared/excel/readWorkbook'
import { importTeamEntries } from '../importTeam'

function fixtureBuffer(name: string): Uint8Array {
  return readFileSync(resolve(process.cwd(), '../testdata', name))
}

describe('importTeamEntries', () => {
  it('should match the Go golden output for Mens Team.xlsx', async () => {
    const workbook = await readWorkbook(fixtureBuffer('Mens Team.xlsx'))
    const entries = importTeamEntries(workbook, 3, 3)
    const baselineRaw = readFileSync(
      resolve(
        process.cwd(),
        'src/features/entry/__tests__/golden',
        'team.golden.json'
      ),
      'utf-8'
    )
    const baseline = JSON.parse(baselineRaw)

    // Byte-for-byte parity: compact JSON strings must match
    expect(JSON.stringify(entries)).toBe(JSON.stringify(baseline))
    // Deep equality with key-order check
    expect(entries).toEqual(baseline)
  })

  it('should resolve team names via the players sheet map', () => {
    const workbook: Record<string, string[][]> = {
      players: [
        ['SN', 'Name', 'Date Of Birth', 'Gender', 'Team'],
        ['1', 'Alice', '36892', 'F', 'TeamA'],
        ['2', 'Bob', '36893', 'M', 'TeamA'],
        ['3', 'Carol', '36894', 'F', 'TeamA']
      ],
      entries: [
        ['SN', 'Team', 'Club', 'Seeding'],
        ['1', 'TeamA', 'ClubX', '5']
      ]
    }
    const entries = importTeamEntries(workbook, 3, 3)

    expect(entries).toHaveLength(1)
    expect(entries[0].teamEntry?.teamName).toBe('TeamA')
    expect(entries[0].teamEntry?.players).toHaveLength(3)
    expect(entries[0].teamEntry?.minPlayers).toBe(3)
    expect(entries[0].teamEntry?.maxPlayers).toBe(3)
    expect(entries[0].club).toBe('ClubX')
    expect(entries[0].seeding).toBe(5)
  })

  it('should throw team not found for unknown team', () => {
    const workbook: Record<string, string[][]> = {
      players: [
        ['SN', 'Name', 'Date Of Birth', 'Gender', 'Team'],
        ['1', 'Alice', '36892', 'F', 'TeamA']
      ],
      entries: [
        ['SN', 'Team', 'Club', 'Seeding'],
        ['1', 'Unknown', 'ClubX', '5']
      ]
    }
    expect(() => importTeamEntries(workbook, 1, 5)).toThrow(
      'team Unknown not found in players sheet'
    )
  })

  it('should throw player count error when outside min/max range', () => {
    const workbook: Record<string, string[][]> = {
      players: [
        ['SN', 'Name', 'Date Of Birth', 'Gender', 'Team'],
        ['1', 'Alice', '36892', 'F', 'TeamA'],
        ['2', 'Bob', '36893', 'M', 'TeamA']
      ],
      entries: [
        ['SN', 'Team', 'Club', 'Seeding'],
        ['1', 'TeamA', 'ClubX', '5']
      ]
    }
    // 2 players, min=3, max=3
    expect(() => importTeamEntries(workbook, 3, 3)).toThrow(
      'team TeamA has 2 players, which is not between 3 and 3'
    )
  })

  it('should skip short rows in entries sheet', () => {
    const workbook: Record<string, string[][]> = {
      players: [
        ['SN', 'Name', 'Date Of Birth', 'Gender', 'Team'],
        ['1', 'Alice', '36892', 'F', 'TeamA'],
        ['2', 'Bob', '36893', 'M', 'TeamA'],
        ['3', 'Carol', '36894', 'F', 'TeamA']
      ],
      entries: [
        ['SN', 'Team', 'Club', 'Seeding'],
        ['1', 'TeamA', 'ClubX', '5'],
        ['2', 'Short'] // len < 3, should be skipped
      ]
    }
    const entries = importTeamEntries(workbook, 3, 3)
    expect(entries).toHaveLength(1)
  })

  it('should handle optional Club and Seeding', () => {
    const workbook: Record<string, string[][]> = {
      players: [
        ['SN', 'Name', 'Date Of Birth', 'Gender', 'Team'],
        ['1', 'Alice', '36892', 'F', 'TeamA'],
        ['2', 'Bob', '36893', 'M', 'TeamA'],
        ['3', 'Carol', '36894', 'F', 'TeamA']
      ],
      entries: [
        ['SN', 'Team', 'Club', 'Seeding'],
        ['1', 'TeamA', '', ''], // interior blanks at Club and Seeding
        ['2', 'TeamA', ''] // no seeding (only 3 cells, club empty)
      ]
    }
    const entries = importTeamEntries(workbook, 3, 3)

    expect(entries).toHaveLength(2)
    expect(entries[0].club).toBeUndefined()
    expect(entries[0].seeding).toBeUndefined()
    expect(entries[1].club).toBeUndefined()
    expect(entries[1].seeding).toBeUndefined()
  })

  it('should throw sheet does not exist for missing sheets', () => {
    expect(() => importTeamEntries({}, 3, 3)).toThrow(
      'sheet players does not exist'
    )
    expect(() => importTeamEntries({ players: [] }, 3, 3)).toThrow(
      'sheet entries does not exist'
    )
  })

  it('should throw failed to parse seeding on non-integer', () => {
    const workbook: Record<string, string[][]> = {
      players: [
        ['SN', 'Name', 'Date Of Birth', 'Gender', 'Team'],
        ['1', 'Alice', '36892', 'F', 'TeamA'],
        ['2', 'Bob', '36893', 'M', 'TeamA'],
        ['3', 'Carol', '36894', 'F', 'TeamA']
      ],
      entries: [
        ['SN', 'Team', 'Club', 'Seeding'],
        ['1', 'TeamA', 'ClubX', 'abc']
      ]
    }
    expect(() => importTeamEntries(workbook, 3, 3)).toThrow(
      'failed to parse seeding'
    )
  })
})