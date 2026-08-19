import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { scheduleMatches, type Schedule, type ScheduledMatch } from '../scheduleMatches'
import { generateRoundsForTournament } from '@/features/matches/domain/generateRounds'
import { Entry, type Tournament } from '@/shared/model'

// ---------------------------------------------------------------------------
// Helpers: build the same tournament as the Go oracle
// (endpoint/schedule/internal/schedule_oracle_test.go buildOracleTournament).
// ---------------------------------------------------------------------------

function buildSinglesEntries(n: number): Entry[] {
  const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry']
  const entries: Entry[] = []
  for (let i = 0; i < n; i++) {
    entries.push(
      Entry.from({
        entryType: 'Singles',
        singlesEntry: {
          player: {
            name: names[i % names.length],
            dateOfBirth: '2000-01-01',
            gender: 'M'
          }
        }
      })
    )
  }
  return entries
}

function buildOracleTournament(): Tournament {
  return {
    name: 'Schedule Test',
    numTables: 4,
    startTime: '2025-03-22T09:00',
    categories: [
      {
        name: "Men's Singles",
        shortName: 'MS',
        entryType: 'Singles',
        durationMinutes: 30,
        entriesPerGrpMain: 4,
        entriesPerGrpRemainder: 0,
        numQualifiedPerGroup: 2,
        entries: buildSinglesEntries(8),
        groups: [
          { entriesIdx: [0, 1, 2, 3], rounds: [] },
          { entriesIdx: [4, 5, 6, 7], rounds: [] }
        ],
        knockoutRounds: []
      },
      {
        name: "Women's Singles",
        shortName: 'WS',
        entryType: 'Singles',
        durationMinutes: 30,
        entriesPerGrpMain: 4,
        entriesPerGrpRemainder: 0,
        numQualifiedPerGroup: 2,
        entries: buildSinglesEntries(8),
        groups: [
          { entriesIdx: [0, 1, 2, 3], rounds: [] },
          { entriesIdx: [4, 5, 6, 7], rounds: [] }
        ],
        knockoutRounds: []
      }
    ]
  }
}

/** Format a Date as UTC ISO string without milliseconds, matching Go's format. */
function fmtUTC(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/** Serialize a Schedule to the same JSON format as the Go oracle. */
function scheduleToJSON(s: Schedule) {
  return {
    startTime: fmtUTC(s.startTime),
    timeSlots: s.timeSlots.map((slot) => ({
      tables: slot.tables.map((m: ScheduledMatch | null) => ({
        match: m
          ? {
              entry1Idx: m.entry1Idx,
              entry2Idx: m.entry2Idx,
              datetime: fmtUTC(m.dateTime),
              durationMinutes: m.durationMinutes,
              table: m.table,
              categoryShortName: m.categoryShortName,
              groupIdx: m.groupIdx,
              roundIdx: m.roundIdx,
              round: m.round,
              matchIdx: m.matchIdx
            }
          : null
      }))
    }))
  }
}

function loadGolden(): unknown {
  const path = resolve(
    process.cwd(),
    'src/features/schedule/__tests__/golden',
    'schedule.golden.json'
  )
  return JSON.parse(readFileSync(path, 'utf-8'))
}

describe('scheduleMatches', () => {
  it('should match the Go golden schedule output', () => {
    const tournament = buildOracleTournament()
    generateRoundsForTournament(tournament)
    const schedule = scheduleMatches(tournament)
    const actual = scheduleToJSON(schedule)
    expect(actual).toEqual(loadGolden())
  })

  it('should parse startTime as UTC (not local time)', () => {
    const tournament = buildOracleTournament()
    generateRoundsForTournament(tournament)
    const schedule = scheduleMatches(tournament)
    // First slot's first match should start at 09:00 UTC
    const firstMatch = schedule.timeSlots[0].tables[0]!
    expect(fmtUTC(firstMatch.dateTime)).toBe('2025-03-22T09:00:00Z')
  })

  it('should advance nextStartTime per category by durationMinutes', () => {
    const tournament = buildOracleTournament()
    generateRoundsForTournament(tournament)
    const schedule = scheduleMatches(tournament)

    // MS group stage: slots 0-2 (09:00, 09:30, 10:00)
    // WS group stage starts after MS last slot + 30min = 10:30
    const wsFirstSlot = schedule.timeSlots[3].tables[0]!
    expect(wsFirstSlot.categoryShortName).toBe('WS')
    expect(fmtUTC(wsFirstSlot.dateTime)).toBe('2025-03-22T10:30:00Z')
  })

  it('should schedule all group stages before knockout stages', () => {
    const tournament = buildOracleTournament()
    generateRoundsForTournament(tournament)
    const schedule = scheduleMatches(tournament)

    // First 6 slots should be group matches (MS 3 + WS 3)
    for (let i = 0; i < 6; i++) {
      const match = schedule.timeSlots[i].tables[0]!
      expect(match.groupIdx).toBeGreaterThanOrEqual(0)
    }
    // Slots 6+ should be knockout (groupIdx = -1)
    for (let i = 6; i < schedule.timeSlots.length; i++) {
      const slot = schedule.timeSlots[i]
      for (const table of slot.tables) {
        if (table) {
          expect(table.groupIdx).toBe(-1)
        }
      }
    }
  })

  it('should assign group matches using the round-robin table assignment', () => {
    const tournament = buildOracleTournament()
    generateRoundsForTournament(tournament)
    const schedule = scheduleMatches(tournament)

    // MS has 2 groups, each with 2 matches per round. With 4 tables:
    // Group 0 matches land on T1, T2; group 1 on T3, T4
    const slot0 = schedule.timeSlots[0]
    expect(slot0.tables[0]!.categoryShortName).toBe('MS')
    expect(slot0.tables[0]!.groupIdx).toBe(0)
    expect(slot0.tables[1]!.groupIdx).toBe(0)
    expect(slot0.tables[2]!.groupIdx).toBe(1)
    expect(slot0.tables[3]!.groupIdx).toBe(1)
  })

  it('should skip categories with no group matches', () => {
    const tournament: Tournament = {
      name: 'Empty',
      numTables: 4,
      startTime: '2025-03-22T09:00',
      categories: [
        {
          name: 'Empty Cat',
          shortName: 'EC',
          entryType: 'Singles',
          durationMinutes: 30,
          entriesPerGrpMain: 4,
          entriesPerGrpRemainder: 0,
          numQualifiedPerGroup: 2,
          entries: [],
          groups: [],
          knockoutRounds: []
        }
      ]
    }
    const schedule = scheduleMatches(tournament)
    expect(schedule.timeSlots).toHaveLength(0)
  })

  it('should produce correct number of time slots', () => {
    const tournament = buildOracleTournament()
    generateRoundsForTournament(tournament)
    const schedule = scheduleMatches(tournament)
    // MS groups: 3 slots, WS groups: 3 slots
    // MS knockout: 2 slots (SF + F), WS knockout: 2 slots
    // Total: 10 slots
    expect(schedule.timeSlots).toHaveLength(10)
  })

  it('should throw a clear error when numTables is 0 (the newTournament default)', () => {
    // Regression: with numTables=0, slots got empty `tables` arrays and matches
    // landed in sparse-array holes, so iterating them threw the opaque
    // "Cannot read properties of undefined (reading 'dateTime')" from deep in
    // the scheduler/export path instead of a user-facing message.
    const tournament: Tournament = {
      name: 'Zero Tables',
      numTables: 0,
      startTime: '2025-03-22T09:00',
      categories: [
        {
          name: 'MS',
          shortName: 'MS',
          entryType: 'Singles',
          durationMinutes: 30,
          entriesPerGrpMain: 4,
          entriesPerGrpRemainder: 0,
          numQualifiedPerGroup: 2,
          entries: buildSinglesEntries(4),
          groups: [{ entriesIdx: [0, 1, 2, 3], rounds: [] }],
          knockoutRounds: []
        }
      ]
    }
    generateRoundsForTournament(tournament)
    expect(() => scheduleMatches(tournament)).toThrowError(
      /Number of Tables must be greater than 0/
    )
  })

  it('should throw a clear error when a category match duration is 0 (the newTournament default)', () => {
    // Regression: with durationMinutes=0, the slot formula
    // `addMinutes(startTime, durationMinutes * slotIdx)` collapses every slot
    // onto startTime, so all matches across all slots landed on the same time
    // instead of a clear, user-facing error.
    const tournament: Tournament = {
      name: 'Zero Duration',
      numTables: 2,
      startTime: '2025-03-22T09:00',
      categories: [
        {
          name: 'MS',
          shortName: 'MS',
          entryType: 'Singles',
          durationMinutes: 0,
          entriesPerGrpMain: 4,
          entriesPerGrpRemainder: 0,
          numQualifiedPerGroup: 2,
          entries: buildSinglesEntries(4),
          groups: [{ entriesIdx: [0, 1, 2, 3], rounds: [] }],
          knockoutRounds: []
        }
      ]
    }
    generateRoundsForTournament(tournament)
    expect(() => scheduleMatches(tournament)).toThrowError(
      /Match Duration for "MS" must be greater than 0/
    )
  })
})

describe('knockout structural byes', () => {
  // ko-import spec §4: the entry round keeps every bracket slot; bye matches
  // are structural (Match.bye) and the scheduler must skip them entirely —
  // no table, no time slot, no ScheduledMatch.
  it('gives bye matches no slot while every real knockout match gets one', () => {
    // 3 groups x 4 entries, 2 qualifiers per group -> 6 qualified -> draw of 8:
    // entry round has 4 slots (2 byes at indices 0 and 2), then rounds of 2 and 1.
    const tournament: Tournament = {
      name: 'Bye Schedule Test',
      numTables: 2,
      startTime: '2025-03-22T09:00',
      categories: [
        {
          name: "Men's Singles",
          shortName: 'MS',
          entryType: 'Singles',
          durationMinutes: 30,
          entriesPerGrpMain: 4,
          entriesPerGrpRemainder: 0,
          numQualifiedPerGroup: 2,
          entries: buildSinglesEntries(12),
          groups: [
            { entriesIdx: [0, 1, 2, 3], rounds: [] },
            { entriesIdx: [4, 5, 6, 7], rounds: [] },
            { entriesIdx: [8, 9, 10, 11], rounds: [] }
          ],
          knockoutRounds: []
        }
      ]
    }
    generateRoundsForTournament(tournament)

    const category = tournament.categories[0]
    expect(category.knockoutRounds[0].matches).toHaveLength(4)
    expect(category.knockoutRounds[0].matches.filter((m) => m.bye)).toHaveLength(2)

    const schedule = scheduleMatches(tournament)
    const koMatches: ScheduledMatch[] = []
    for (const slot of schedule.timeSlots) {
      for (const match of slot.tables) {
        if (match && match.groupIdx === -1 && match.categoryShortName === 'MS') {
          koMatches.push(match)
        }
      }
    }
    // Real KO matches only: 2 (entry round) + 2 (semis) + 1 (final) = 5.
    expect(koMatches).toHaveLength(5)
    for (const match of koMatches) {
      expect(match.table).not.toBe('')
      expect(match.dateTime.getTime()).toBeGreaterThanOrEqual(
        new Date('2025-03-22T09:00Z').getTime()
      )
    }
  })
})
