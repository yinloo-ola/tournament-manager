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
  // ── Seed contract v2 ──

  it('emits seedVersion 2 and the tournament start date', () => {
    const seed = buildLineupSeed(buildFixture())
    expect(seed.seedVersion).toBe(2)
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

  it('refuses naming players without a date of birth', () => {
    const tournament = buildFixture()
    tournament.categories[0].entries[0].teamEntry!.players[0].dateOfBirth = ''
    expect(() => buildLineupSeed(tournament)).toThrow(
      "Cannot export for the lineup system: Player 'Alan' (Team 'Alpha', MT) has no date of birth."
    )
  })

  it('refuses naming players with a date of birth the lineup system cannot parse', () => {
    const tournament = buildFixture()
    // Text Excel never recognized as a date — passes through as typed.
    tournament.categories[0].entries[0].teamEntry!.players[0].dateOfBirth = '15/01/1990'
    expect(() => buildLineupSeed(tournament)).toThrow(
      "Cannot export for the lineup system: Player 'Alan' (Team 'Alpha', MT) has an invalid date of birth '15/01/1990'."
    )
  })

  it('emits tournament-local scheduledStart, stripping the UTC designator', () => {
    const tournament = buildFixture()
    // The schedule pipeline anchors UTC instants (…Z); the organizer means
    // local wall-clock — the seed must carry it without the offset.
    tournament.categories[0].groups[0].rounds[0][0].datetime = '2026-03-01T09:00:00.000Z'
    const seed = buildLineupSeed(tournament)
    const tie = seed.ties[0] // round 1: Alpha vs Bravo
    expect(tie.scheduledStart).toBe('2026-03-01T09:00')
    expect(tie.id.endsWith('2026-03-01T09:00')).toBe(true)
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

describe('buildLineupSeed — knockout contract v2', () => {
  // ko-import spec §3 (lineup-manager .scratch): the bracket travels as
  // structure (brackets[]) + scheduled matches. Entry round = unplaced pool
  // (table+time, no position, no teams — the lineup admin places them); later
  // rounds = positional ties with both sides fed; byes and unscheduled matches
  // never enter ties[] but hold their slots in brackets[].
  function koFixture() {
    const tournament = buildFixture()
    tournament.categories[0].knockoutRounds = [
      {
        round: 8,
        matches: [
          { ...match(-1, -1, '', ''), bye: true },
          match(-1, -1, '2026-03-02T09:00', 'T1'),
          { ...match(-1, -1, '', ''), bye: true },
          match(-1, -1, '2026-03-02T09:00', 'T2')
        ]
      },
      {
        round: 4,
        matches: [match(-1, -1, '2026-03-02T11:00', 'T1'), match(-1, -1, '2026-03-02T11:00', 'T2')]
      },
      { round: 2, matches: [match(-1, -1, '2026-03-02T13:00', 'T1')] }
    ]
    return tournament
  }

  it('exports the bracket structure with slot counts and feed wiring', () => {
    const seed = buildLineupSeed(koFixture())
    expect(seed.brackets).toEqual([
      {
        categoryId: 'MT',
        rounds: [
          { label: 'QF', slots: 4 },
          {
            label: 'SF',
            slots: 2,
            fedBy: [
              ['MT|ko|QF|1', 'MT|ko|QF|2'],
              ['MT|ko|QF|3', 'MT|ko|QF|4']
            ]
          },
          { label: 'F', slots: 1, fedBy: [['MT|ko|SF|1', 'MT|ko|SF|2']] }
        ]
      }
    ])
  })

  it('exports the entry round as an unplaced pool — table+time only, byes and unscheduled absent', () => {
    const seed = buildLineupSeed(koFixture())
    const pool = seed.ties.filter((t) => t.round === 'QF')
    expect(pool).toEqual([
      {
        id: 'MT|ko|QF|T1|2026-03-02T09:00',
        categoryId: 'MT',
        scheduledStart: '2026-03-02T09:00',
        round: 'QF',
        table: 'T1'
      },
      {
        id: 'MT|ko|QF|T2|2026-03-02T09:00',
        categoryId: 'MT',
        scheduledStart: '2026-03-02T09:00',
        round: 'QF',
        table: 'T2'
      }
    ])
    for (const tie of pool) {
      expect('teamIds' in tie).toBe(false)
      expect('fedBy' in tie).toBe(false)
      expect('group' in tie).toBe(false)
    }
  })

  it('exports later rounds positionally with both sides fed', () => {
    const seed = buildLineupSeed(koFixture())
    const sf = seed.ties.filter((t) => t.round === 'SF')
    expect(sf).toEqual([
      {
        id: 'MT|ko|SF|1',
        categoryId: 'MT',
        scheduledStart: '2026-03-02T11:00',
        round: 'SF',
        fedBy: ['MT|ko|QF|1', 'MT|ko|QF|2'],
        table: 'T1'
      },
      {
        id: 'MT|ko|SF|2',
        categoryId: 'MT',
        scheduledStart: '2026-03-02T11:00',
        round: 'SF',
        fedBy: ['MT|ko|QF|3', 'MT|ko|QF|4'],
        table: 'T2'
      }
    ])
    const f = seed.ties.find((t) => t.round === 'F')
    expect(f).toEqual({
      id: 'MT|ko|F|1',
      categoryId: 'MT',
      scheduledStart: '2026-03-02T13:00',
      round: 'F',
      fedBy: ['MT|ko|SF|1', 'MT|ko|SF|2'],
      table: 'T1'
    })
  })

  it('omits brackets entirely when no category has a knockout stage', () => {
    const seed = buildLineupSeed(buildFixture())
    expect('brackets' in seed).toBe(false)
  })

  it('labels a 256-slot round R256 and refuses sizes beyond the label set', () => {
    const tournament = buildFixture()
    // Generator-consistent shapes: a 256-entrant round holds 128 slots (only
    // the first scheduled here), a 128-entrant round holds 64.
    const unscheduled = (n: number) => Array.from({ length: n }, () => match(-1, -1, '', ''))
    tournament.categories[0].knockoutRounds = [
      { round: 256, matches: [match(-1, -1, '2026-03-02T09:00', 'T1'), ...unscheduled(127)] },
      { round: 128, matches: unscheduled(64) }
    ]
    const seed = buildLineupSeed(tournament)
    expect(seed.brackets![0].rounds.map((r) => [r.label, r.slots])).toEqual([
      ['R256', 128],
      ['R128', 64]
    ])
    expect(seed.ties.find((t) => t.round === 'R256')!.id).toBe('MT|ko|R256|T1|2026-03-02T09:00')

    tournament.categories[0].knockoutRounds = [
      { round: 512, matches: [match(-1, -1, '2026-03-02T09:00', 'T1')] }
    ]
    expect(() => buildLineupSeed(tournament)).toThrow(/power-of-two bracket size up to 256/)
  })

  it('fails loudly when the bracket does not halve (hand-edited document)', () => {
    const tournament = buildFixture()
    tournament.categories[0].knockoutRounds = [
      {
        round: 8,
        matches: [match(-1, -1, '', ''), match(-1, -1, '', ''), match(-1, -1, '', ''), match(-1, -1, '', '')]
      },
      { round: 2, matches: [match(-1, -1, '', '')] }
    ]
    expect(() => buildLineupSeed(tournament)).toThrow(/rounds do not halve/)
  })

  it('fails loudly when a scheduled knockout match has no table', () => {
    const tournament = buildFixture()
    tournament.categories[0].knockoutRounds = [
      { round: 4, matches: [match(-1, -1, '2026-03-02T09:00', ''), match(-1, -1, '', '')] },
      { round: 2, matches: [match(-1, -1, '', '')] }
    ]
    expect(() => buildLineupSeed(tournament)).toThrow(/without a table/)
  })
})
