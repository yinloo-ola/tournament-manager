/**
 * Golden-fixture test for the lineup seed export (Ticket 10). Mirrors the
 * existing export-test pattern (schedule / roundrobin / scoresheet): a frozen
 * Team-category tournament is exported and the output locked against a committed
 * golden JSON. Structural tests cover the non-Team exclusion + referential rules
 * a downstream consumer (lineup-manager's parseSeed) relies on.
 */

import { describe, it, expect } from 'vitest'
import { Entry, EntryType } from '@/shared/model'
import { teamEntry, match, buildFixture } from './fixture'
import { buildLineupSeed } from '../domain/buildLineupSeed'
import golden from './golden/lineup-seed.golden.json'

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

  it('collects scheduled ties from knockout rounds too', () => {
    const tournament = buildFixture()
    // A scheduled knockout final (entry 0 vs 1) + an unscheduled one (no datetime).
    tournament.categories[0].knockoutRounds = [
      {
        round: 2,
        matches: [
          match(0, 1, '2026-03-01T14:00', 'T1'),
          { entry1Idx: 0, entry2Idx: 2, datetime: '', durationMinutes: 60, table: 'T2' }
        ]
      }
    ]
    const seed = buildLineupSeed(tournament)
    // 3 round-robin ties + 1 scheduled knockout tie (the unscheduled one omitted).
    expect(seed.ties).toHaveLength(4)
    expect(seed.ties.some((t) => t.scheduledStart === '2026-03-01T14:00')).toBe(true)
  })

  it('fails loudly on duplicate Team-category short names (avoids an invalid seed)', () => {
    const tournament = buildFixture()
    tournament.categories.push({
      name: 'Other Team',
      shortName: 'MT', // collides with the fixture's "MT"
      entryType: EntryType.Team,
      durationMinutes: 60,
      entriesPerGrpMain: 2,
      entriesPerGrpRemainder: 0,
      numQualifiedPerGroup: 1,
      entries: [teamEntry('Delta', 'Delta Club', [{ name: 'Dan', gender: 'M', dob: '1990-01-01' }])],
      groups: [{ entriesIdx: [0], rounds: [] }],
      knockoutRounds: []
    })
    expect(() => buildLineupSeed(tournament)).toThrow(/unique short names/i)
  })

  it('fails loudly on duplicate team names within a category', () => {
    const tournament = buildFixture()
    tournament.categories[0].entries.push(teamEntry('Alpha', 'Other', [])) // duplicate team name
    expect(() => buildLineupSeed(tournament)).toThrow(/unique team names/i)
  })
  // ── Seed contract v1 ──

  it('emits seedVersion 1 and the tournament start date', () => {
    const seed = buildLineupSeed(buildFixture())
    expect(seed.seedVersion).toBe(1)
    expect(seed.startDate).toBe('2026-03-01')
  })

  it('omits startDate when the tournament has no start time', () => {
    const tournament = buildFixture()
    tournament.startTime = ''
    const seed = buildLineupSeed(tournament)
    expect('startDate' in seed).toBe(false)
  })

  it('labels group-stage Team Matches with Group N / Round N per group', () => {
    const seed = buildLineupSeed(buildFixture())
    // The fixture's single group has 3 rounds (one match each).
    expect(seed.ties.map((t) => [t.group, t.round])).toEqual([
      ['Group 1', 'Round 1'],
      ['Group 1', 'Round 2'],
      ['Group 1', 'Round 3']
    ])
  })

  it('labels knockout Team Matches with bracket shorthand and omits group', () => {
    const tournament = buildFixture()
    tournament.categories[0].knockoutRounds = [
      { round: 1, matches: [match(0, 1, '2026-03-01T14:00', 'T1'), match(1, 2, '2026-03-01T15:00', 'T2')] },
      { round: 2, matches: [match(0, 1, '2026-03-02T09:00', 'T1')] }
    ]
    const seed = buildLineupSeed(tournament)
    const koTies = seed.ties.filter((t) => t.scheduledStart >= '2026-03-01T14:00')
    expect(koTies.map((t) => [t.group, t.round])).toEqual([
      [undefined, 'SF'],
      [undefined, 'SF'],
      [undefined, 'F']
    ])
  })

  it('emits each team manager email', () => {
    const seed = buildLineupSeed(buildFixture())
    expect(seed.teams.map((t) => [t.name, t.managerEmail])).toEqual([
      ['Alpha', 'coach.alpha@club.com'],
      ['Bravo', 'coach.bravo@club.com'],
      ['Charlie', 'coach.charlie@club.com']
    ])
  })

  it('refuses in one message naming teams without a manager email', () => {
    const tournament = buildFixture()
    tournament.categories[0].entries[2] = teamEntry(
      'Charlie',
      undefined,
      [{ name: 'Carl', gender: 'M', dob: '2000-01-01' }]
    ) // no email
    expect(() => buildLineupSeed(tournament)).toThrow(
      "Cannot export for the lineup system: Team 'Charlie' (MT) has no manager email."
    )
  })

  it('refuses naming the team + category pairs that share a manager email', () => {
    const tournament = buildFixture()
    tournament.categories[0].entries[0] = teamEntry(
      'Alpha',
      'Alpha Club',
      [
        { name: 'Alan', gender: 'M', dob: '1990-04-01' },
        { name: 'Alex', gender: 'M', dob: '1995-09-09' }
      ],
      'COACH.BRAVO@club.com' // same manager as Bravo's, different case
    )
    // The message shows the email as first typed — the organizer's spelling.
    expect(() => buildLineupSeed(tournament)).toThrow(
      "Cannot export for the lineup system: Manager Email 'COACH.BRAVO@club.com' is shared by Team 'Alpha' (MT) and Team 'Bravo' (MT)."
    )
  })
})
