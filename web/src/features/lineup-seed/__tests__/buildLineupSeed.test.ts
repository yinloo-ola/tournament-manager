/**
 * Golden-fixture test for the lineup seed export (Ticket 10). Mirrors the
 * existing export-test pattern (schedule / roundrobin / scoresheet): a frozen
 * Team-category tournament is exported and the output locked against a committed
 * golden JSON. Structural tests cover the non-Team exclusion + referential rules
 * a downstream consumer (lineup-manager's parseSeed) relies on.
 */

import { describe, it, expect } from 'vitest'
import { Entry, EntryType, type Tournament, type Match } from '@/shared/model'
import { buildLineupSeed } from '../domain/buildLineupSeed'
import golden from './golden/lineup-seed.golden.json'

function teamEntry(
  teamName: string,
  club: string | undefined,
  players: { name: string; gender: string; dob: string }[]
): Entry {
  return Entry.from({
    entryType: 'Team',
    club,
    teamEntry: {
      teamName,
      players: players.map((p) => ({ name: p.name, gender: p.gender, dateOfBirth: p.dob })),
      minPlayers: 2,
      maxPlayers: 6
    }
  })
}

function match(a: number, b: number, datetime: string, table: string): Match {
  return { entry1Idx: a, entry2Idx: b, datetime, durationMinutes: 60, table, groupIdx: 0 }
}

/** A Team category with 3 teams + a scheduled 3-round round-robin. */
function buildFixture(): Tournament {
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
          ]),
          teamEntry('Bravo', 'Bravo Club', [{ name: 'Bob', gender: 'M', dob: '1988-06-15' }]),
          teamEntry('Charlie', undefined, [{ name: 'Carl', gender: 'M', dob: '2000-01-01' }])
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

describe('buildLineupSeed', () => {
  it('matches the frozen golden output', () => {
    expect(buildLineupSeed(buildFixture())).toEqual(golden)
  })

  it('emits only Team categories', () => {
    const tournament = buildFixture()
    tournament.categories.push({
      name: "Men's Singles",
      shortName: 'MS',
      entryType: EntryType.Singles,
      durationMinutes: 30,
      entriesPerGrpMain: 4,
      entriesPerGrpRemainder: 0,
      numQualifiedPerGroup: 2,
      entries: [
        Entry.from({
          entryType: 'Singles',
          singlesEntry: { player: { name: 'Sam', dateOfBirth: '1990-01-01', gender: 'M' } }
        })
      ],
      groups: [{ entriesIdx: [0], rounds: [] }],
      knockoutRounds: []
    })
    const seed = buildLineupSeed(tournament)
    expect(seed.categories.map((c) => c.shortName)).toEqual(['MT'])
  })

  it('omits unscheduled matches (no datetime) from ties', () => {
    const tournament = buildFixture()
    // Add an unscheduled match to the round-robin.
    tournament.categories[0].groups[0].rounds.push([
      { entry1Idx: 0, entry2Idx: 1, datetime: '', durationMinutes: 60, table: 'T1', groupIdx: 0 }
    ])
    const seed = buildLineupSeed(tournament)
    expect(seed.ties).toHaveLength(3)
  })

  it('produces unique, referentially-consistent ids', () => {
    const seed = buildLineupSeed(buildFixture())
    const teamIds = new Set(seed.teams.map((t) => t.id))
    const catIds = new Set(seed.categories.map((c) => c.id))
    // players reference real teams
    for (const p of seed.players) expect(teamIds.has(p.teamId)).toBe(true)
    // ties reference real categories + teams
    for (const t of seed.ties) {
      expect(catIds.has(t.categoryId)).toBe(true)
      expect(teamIds.has(t.teamIds[0])).toBe(true)
      expect(teamIds.has(t.teamIds[1])).toBe(true)
    }
    // all ids unique within their collection
    expect(new Set(seed.teams.map((t) => t.id)).size).toBe(seed.teams.length)
    expect(new Set(seed.players.map((p) => p.id)).size).toBe(seed.players.length)
    expect(new Set(seed.ties.map((t) => t.id)).size).toBe(seed.ties.length)
  })
})
