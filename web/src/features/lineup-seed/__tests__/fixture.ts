/**
 * Shared fixture for the lineup-seed tests: a frozen Team-category tournament
 * (3 teams with manager emails, one group, a scheduled 3-round round-robin).
 * Exported so the golden test, structural tests, and the conformance guard
 * all build from the same shape.
 */
import { Entry, type Tournament, type Match } from '@/shared/model'

export function teamEntry(
  teamName: string,
  club: string | undefined,
  players: { name: string; gender: string; dob: string }[],
  managerEmail?: string
): Entry {
  return Entry.from({
    entryType: 'Team',
    club,
    ...(managerEmail !== undefined ? { managerEmail } : {}),
    teamEntry: {
      teamName,
      players: players.map((p) => ({ name: p.name, gender: p.gender, dateOfBirth: p.dob })),
      minPlayers: 2,
      maxPlayers: 6
    }
  })
}

export function match(a: number, b: number, datetime: string, table: string): Match {
  return { entry1Idx: a, entry2Idx: b, datetime, durationMinutes: 60, table, groupIdx: 0 }
}

/** A Team category with 3 teams + a scheduled 3-round round-robin. */
export function buildFixture(): Tournament {
  return {
    name: 'Lineup Seed Test Cup',
    numTables: 2,
    startTime: '2026-03-01T09:00',
    categories: [
      {
        name: "Men's Team",
        shortName: 'MT',
        entryType: 'Team',
        durationMinutes: 60,
        entriesPerGrpMain: 3,
        entriesPerGrpRemainder: 0,
        numQualifiedPerGroup: 2,
        entries: [
          teamEntry('Alpha', 'Alpha Club', [
            { name: 'Alan', gender: 'M', dob: '1990-04-01' },
            { name: 'Alex', gender: 'M', dob: '1995-09-09' }
          ], 'coach.alpha@club.com'),
          teamEntry('Bravo', 'Bravo Club', [{ name: 'Bob', gender: 'M', dob: '1988-06-15' }], 'coach.bravo@club.com'),
          teamEntry('Charlie', undefined, [{ name: 'Carl', gender: 'M', dob: '2000-01-01' }], 'coach.charlie@club.com')
        ],
        groups: [
          {
            entriesIdx: [0, 1, 2],
            rounds: [
              [match(0, 1, '2026-03-01T09:00', 'T1')],
              [match(0, 2, '2026-03-01T10:00', 'T2')],
              [match(1, 2, '2026-03-01T11:00', 'T1')]
            ]
          }
        ],
        knockoutRounds: []
      }
    ]
  }
}
