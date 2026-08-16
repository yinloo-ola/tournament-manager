import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readWorkbook } from '@/shared/excel/readWorkbook'
import { importTeamEntries } from '../importTeam'

function fixtureBuffer(name: string): Uint8Array {
  return readFileSync(resolve(process.cwd(), 'testdata', name))
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
        ['SN', 'Team', 'Club', 'Seeding', 'Manager Email'],
        ['1', 'TeamA', 'ClubX', '5', 'coach@clubx.com']
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
    expect(entries[0].managerEmail).toBe('coach@clubx.com')
  })

  it('should throw the row-numbered unknown-team message', () => {
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
      "Row 2: Team 'Unknown' isn't in the 'players' sheet."
    )
  })

  it('should throw the allowed-range player count message', () => {
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
      "Team 'TeamA' has 2 players — allowed: 3 to 3."
    )
  })

  it("should fail naming the player when a name appears twice under one team", () => {
    const workbook: Record<string, string[][]> = {
      players: [
        ['SN', 'Name', 'Date Of Birth', 'Gender', 'Team'],
        ['1', 'Alice', '36892', 'F', 'TeamA'],
        ['2', 'Alice', '36895', 'F', 'TeamA']
      ],
      entries: [
        ['SN', 'Team', 'Club', 'Seeding'],
        ['1', 'TeamA', 'ClubX', '5']
      ]
    }
    expect(() => importTeamEntries(workbook, 1, 5)).toThrow(
      "Player 'Alice' appears twice for team 'TeamA'."
    )
  })

  it('should allow the same player name on different teams', () => {
    const workbook: Record<string, string[][]> = {
      players: [
        ['SN', 'Name', 'Date Of Birth', 'Gender', 'Team'],
        ['1', 'Alice', '36892', 'F', 'TeamA'],
        ['2', 'Bob', '36893', 'M', 'TeamA'],
        ['3', 'Alice', '36892', 'F', 'TeamB'],
        ['4', 'Dave', '36894', 'M', 'TeamB']
      ],
      entries: [
        ['SN', 'Team', 'Club', 'Seeding', 'Manager Email'],
        ['1', 'TeamA', 'ClubX', '1', 'coach.a@clubx.com'],
        ['2', 'TeamB', 'ClubY', '2', 'coach.b@cluby.com']
      ]
    }
    const entries = importTeamEntries(workbook, 2, 2)

    expect(entries).toHaveLength(2)
    expect(entries[0].teamEntry?.players.map((p) => p.name)).toEqual([
      'Alice',
      'Bob'
    ])
    expect(entries[1].teamEntry?.players.map((p) => p.name)).toEqual([
      'Alice',
      'Dave'
    ])
  })

  it('should import a team row with blank Club/Seeding when the manager email is present', () => {
    const workbook: Record<string, string[][]> = {
      players: [
        ['SN', 'Name', 'Date Of Birth', 'Gender', 'Team'],
        ['1', 'Alice', '36892', 'F', 'TeamA'],
        ['2', 'Bob', '36893', 'M', 'TeamA'],
        ['3', 'Carol', '36894', 'F', 'TeamA']
      ],
      entries: [
        ['SN', 'Team', 'Club', 'Seeding', 'Manager Email'],
        ['1', 'TeamA', 'ClubX', '5', 'coach.a@clubx.com'],
        // no Club, no Seeding — readWorkbook trims trailing blanks, but the
        // email cell keeps the row long enough to read
        ['2', 'TeamA', '', '', 'coach.b@clubx.com']
      ]
    }
    const entries = importTeamEntries(workbook, 3, 3)
    expect(entries).toHaveLength(2)
    expect(entries[1].teamEntry?.teamName).toBe('TeamA')
    expect(entries[1].club).toBeUndefined()
    expect(entries[1].seeding).toBeUndefined()
    expect(entries[1].managerEmail).toBe('coach.b@clubx.com')
  })

  it('should skip rows with no team name', () => {
    const workbook: Record<string, string[][]> = {
      players: [
        ['SN', 'Name', 'Date Of Birth', 'Gender', 'Team'],
        ['1', 'Alice', '36892', 'F', 'TeamA'],
        ['2', 'Bob', '36893', 'M', 'TeamA'],
        ['3', 'Carol', '36894', 'F', 'TeamA']
      ],
      entries: [
        ['SN', 'Team', 'Club', 'Seeding', 'Manager Email'],
        ['1', 'TeamA', 'ClubX', '5', 'coach@clubx.com'],
        ['2'] // SN only, no team name
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
        ['SN', 'Team', 'Club', 'Seeding', 'Manager Email'],
        ['1', 'TeamA', '', '', 'coach.a@clubx.com'], // interior blanks at Club and Seeding
        ['2', 'TeamA', '', '', 'coach.b@clubx.com'] // interior blanks at Club and Seeding
      ]
    }
    const entries = importTeamEntries(workbook, 3, 3)

    expect(entries).toHaveLength(2)
    expect(entries[0].club).toBeUndefined()
    expect(entries[0].seeding).toBeUndefined()
    expect(entries[1].club).toBeUndefined()
    expect(entries[1].seeding).toBeUndefined()
  })

  it('should include a team player with trailing blanks trimmed (no Gender)', () => {
    // readWorkbook trims trailing blank cells — a player missing Gender must
    // still join the team, or the team silently fails its min/max player
    // count validation.
    const workbook: Record<string, string[][]> = {
      players: [
        ['SN', 'Name', 'Date Of Birth', 'Gender', 'Team'],
        ['1', 'Alice', '36892', '', 'TeamA'], // interior-blank Gender
        ['2', 'Bob', '36893', 'M', 'TeamA'],
        ['3', 'Carol', '36894', 'F', 'TeamA']
      ],
      entries: [
        ['SN', 'Team', 'Club', 'Seeding', 'Manager Email'],
        ['1', 'TeamA', 'ClubX', '5', 'coach@clubx.com']
      ]
    }
    const entries = importTeamEntries(workbook, 3, 3)

    expect(entries).toHaveLength(1)
    expect(entries[0].teamEntry?.players).toHaveLength(3)
    expect(entries[0].teamEntry?.players[0]).toEqual({
      name: 'Alice',
      dateOfBirth: '36892',
      gender: ''
    })
  })

  it('should throw sheet does not exist for missing sheets', () => {
    expect(() => importTeamEntries({}, 3, 3)).toThrow(
      'sheet players does not exist'
    )
    expect(() => importTeamEntries({ players: [] }, 3, 3)).toThrow(
      'sheet entries does not exist'
    )
  })

  it('should throw the row-numbered seeding message on non-integer', () => {
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
      "Row 2: Seeding 'abc' isn't a whole number."
    )
  })

  // Manager Email column (lineup seed v1 contract): required on every team
  // row, email-shaped, and never shared by two teams in one file.
  const teamPlayers = (team: string): string[][] => [
    ['SN', 'Name', 'Date Of Birth', 'Gender', 'Team'],
    ['1', 'Alice', '36892', 'F', team],
    ['2', 'Bob', '36893', 'M', team],
    ['3', 'Carol', '36894', 'F', team]
  ]

  it('should capture the manager email from the entries sheet', () => {
    const workbook: Record<string, string[][]> = {
      players: [...teamPlayers('TeamA'), ...teamPlayers('TeamB').slice(1)],
      entries: [
        ['SN', 'Team', 'Club', 'Seeding', 'Manager Email'],
        ['1', 'TeamA', 'ClubX', '5', 'Coach.A@clubx.com'],
        ['2', 'TeamB', '', '', 'coach.b@cluby.com']
      ]
    }
    const entries = importTeamEntries(workbook, 3, 3)
    expect(entries).toHaveLength(2)
    expect(entries[0].managerEmail).toBe('Coach.A@clubx.com')
    expect(entries[1].managerEmail).toBe('coach.b@cluby.com')
  })

  it('should throw the row-numbered missing-email message', () => {
    const workbook: Record<string, string[][]> = {
      players: teamPlayers('TeamA'),
      entries: [
        ['SN', 'Team', 'Club', 'Seeding', 'Manager Email'],
        ['1', 'TeamA', 'ClubX', '5'] // email cell absent — trailing blanks trimmed
      ]
    }
    expect(() => importTeamEntries(workbook, 3, 3)).toThrow(
      'Row 2: Manager Email is missing.'
    )
  })

  it("should throw the row-numbered malformed-email message", () => {
    const workbook: Record<string, string[][]> = {
      players: teamPlayers('TeamA'),
      entries: [
        ['SN', 'Team', 'Club', 'Seeding', 'Manager Email'],
        ['1', 'TeamA', 'ClubX', '5', 'alpha at club.com']
      ]
    }
    expect(() => importTeamEntries(workbook, 3, 3)).toThrow(
      "Row 2: Manager Email 'alpha at club.com' isn't a valid email."
    )
  })

  it('should throw naming both teams when an email repeats in one file (case-insensitive)', () => {
    const workbook: Record<string, string[][]> = {
      players: [...teamPlayers('Alpha'), ...teamPlayers('Bravo').slice(1)],
      entries: [
        ['SN', 'Team', 'Club', 'Seeding', 'Manager Email'],
        ['1', 'Alpha', 'ClubX', '1', 'Coach@CLUB.com'],
        ['2', 'Bravo', 'ClubY', '2', 'coach@club.com']
      ]
    }
    expect(() => importTeamEntries(workbook, 3, 3)).toThrow(
      "Manager Email 'coach@club.com' is used by teams 'Alpha' and 'Bravo' in this file."
    )
  })
})