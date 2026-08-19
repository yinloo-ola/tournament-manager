import { describe, it, expect } from 'vitest'
import { importFinalSchedule } from '../schedule'
import type { Group, KnockoutRound, Match, Tournament } from '@/shared/model'

// ko-import spec §4 (lineup-manager .scratch/ko-import): the final-schedule
// workbook contains only scheduled matches, so structural byes (Match.bye,
// never scheduled) are absent from the imported map — the merge must re-attach
// them from the existing model so the full bracket survives the import.

const EMPTY = -1

function koMatch(partial: Partial<Match> = {}): Match {
  return {
    entry1Idx: EMPTY,
    entry2Idx: EMPTY,
    datetime: '',
    durationMinutes: 30,
    table: '',
    ...partial
  }
}

function buildTournament(knockoutRounds: KnockoutRound[]): Tournament {
  return {
    name: 'Merge Test',
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
        entries: [],
        groups: [{ entriesIdx: [0, 1, 2, 3], rounds: [] }],
        knockoutRounds
      }
    ]
  }
}

const emptyGroupsMap: { [category: string]: Group[] } = {
  MS: [{ entriesIdx: [0, 1, 2, 3], rounds: [] }]
}

describe('importFinalSchedule (calculator) — knockout byes', () => {
  it('preserves structural byes positionally while real matches take imported times', () => {
    // Existing: 6 qualifiers -> draw of 8 with byes at entry-round indices 0 and 2.
    const tournament = buildTournament([
      {
        round: 8,
        matches: [
          koMatch({ bye: true }),
          koMatch({ datetime: '2025-03-22T09:00:00.000Z', table: 'T1' }),
          koMatch({ bye: true }),
          koMatch({ datetime: '2025-03-22T09:00:00.000Z', table: 'T2' })
        ]
      },
      { round: 4, matches: [koMatch(), koMatch()] },
      { round: 2, matches: [koMatch()] }
    ])

    // Imported map: the workbook's rows — scheduled (non-bye) matches only.
    const imported: { [category: string]: KnockoutRound[] } = {
      MS: [
        {
          round: 8,
          matches: [
            koMatch({ datetime: '2025-03-22T14:00:00.000Z', table: 'T1' }),
            koMatch({ datetime: '2025-03-22T14:00:00.000Z', table: 'T2' })
          ]
        },
        {
          round: 4,
          matches: [
            koMatch({ datetime: '2025-03-22T15:00:00.000Z', table: 'T1' }),
            koMatch({ datetime: '2025-03-22T15:00:00.000Z', table: 'T2' })
          ]
        },
        { round: 2, matches: [koMatch({ datetime: '2025-03-22T16:00:00.000Z', table: 'T1' })] }
      ]
    }

    expect(importFinalSchedule(emptyGroupsMap, imported, tournament)).toBe(true)

    const rounds = tournament.categories[0].knockoutRounds
    expect(rounds).toHaveLength(3)

    const entry = rounds[0]
    expect(entry.matches).toHaveLength(4)
    expect(entry.matches[0].bye).toBe(true)
    expect(entry.matches[0].datetime).toBe('')
    expect(entry.matches[1].bye).toBeUndefined()
    expect(entry.matches[1].datetime).toBe('2025-03-22T14:00:00.000Z')
    expect(entry.matches[1].table).toBe('T1')
    expect(entry.matches[2].bye).toBe(true)
    expect(entry.matches[3].datetime).toBe('2025-03-22T14:00:00.000Z')
    expect(entry.matches[3].table).toBe('T2')

    expect(rounds[1].matches).toHaveLength(2)
    expect(rounds[1].matches[0].datetime).toBe('2025-03-22T15:00:00.000Z')
    expect(rounds[2].matches).toHaveLength(1)
    expect(rounds[2].matches[0].datetime).toBe('2025-03-22T16:00:00.000Z')
  })

  it('falls back to wholesale replace when the imported shape disagrees with the existing bracket', () => {
    // Existing bracket from a different qualifier config (draw of 4); the
    // import (draw of 8, no byes to align) must win outright, as before.
    const tournament = buildTournament([
      { round: 4, matches: [koMatch({ bye: true }), koMatch()] },
      { round: 2, matches: [koMatch()] }
    ])
    const imported: { [category: string]: KnockoutRound[] } = {
      MS: [{ round: 2, matches: [koMatch({ datetime: '2025-03-22T16:00:00.000Z', table: 'T1' })] }]
    }

    expect(importFinalSchedule(emptyGroupsMap, imported, tournament)).toBe(true)
    const rounds = tournament.categories[0].knockoutRounds
    expect(rounds).toHaveLength(1)
    expect(rounds[0].round).toBe(2)
    expect(rounds[0].matches).toHaveLength(1)
    expect(rounds[0].matches[0].bye).toBeUndefined()
  })
})
