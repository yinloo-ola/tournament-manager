import { describe, it, expect } from 'vitest'
import { EntryByeIdx, EntryEmptyIdx, type Match, type Tournament } from '@/shared/model'
import {
  generateRoundsForTournament,
  generateGroupRounds,
  getRoundMatches,
  getRoundPlayersIndices,
  generateKnockoutRounds,
  nextPowerOfTwo
} from '../generateRounds'

// Project a Match to the fields the Go generator actually populates. The TS
// Match type carries extra fields (datetime, table, round, …) that
// generateRounds leaves unset, so a full toEqual would fail on undefined
// extras. Comparing only the populated fields keeps the oracle faithful to
// Go's `[]model.Match{Entry1Idx, Entry2Idx, DurationMinutes}`.
function projected(matches: Match[]): { entry1Idx: number; entry2Idx: number; durationMinutes: number }[] {
  return matches.map((m) => ({ entry1Idx: m.entry1Idx, entry2Idx: m.entry2Idx, durationMinutes: m.durationMinutes }))
}

// Golden values copied VERBATIM from endpoint/schedule/internal/generate_rounds_test.go
// (Test_generateRounds "6 players", durationMinutes=30). entriesIdx=[0,1,2,3,4,5].
const sixPlayerGolden: { entry1Idx: number; entry2Idx: number; durationMinutes: number }[][] = [
  [
    { entry1Idx: 0, entry2Idx: 1, durationMinutes: 30 },
    { entry1Idx: 2, entry2Idx: 3, durationMinutes: 30 },
    { entry1Idx: 4, entry2Idx: 5, durationMinutes: 30 }
  ],
  [
    { entry1Idx: 0, entry2Idx: 2, durationMinutes: 30 },
    { entry1Idx: 1, entry2Idx: 4, durationMinutes: 30 },
    { entry1Idx: 3, entry2Idx: 5, durationMinutes: 30 }
  ],
  [
    { entry1Idx: 0, entry2Idx: 4, durationMinutes: 30 },
    { entry1Idx: 2, entry2Idx: 5, durationMinutes: 30 },
    { entry1Idx: 1, entry2Idx: 3, durationMinutes: 30 }
  ],
  [
    { entry1Idx: 0, entry2Idx: 3, durationMinutes: 30 },
    { entry1Idx: 1, entry2Idx: 5, durationMinutes: 30 },
    { entry1Idx: 2, entry2Idx: 4, durationMinutes: 30 }
  ],
  [
    { entry1Idx: 0, entry2Idx: 5, durationMinutes: 30 },
    { entry1Idx: 3, entry2Idx: 4, durationMinutes: 30 },
    { entry1Idx: 1, entry2Idx: 2, durationMinutes: 30 }
  ]
]

// Test_getRoundMatches (4 players, durationMinutes=30). entriesIdx=[0,1,2,3].
const fourPlayerGolden: { entry1Idx: number; entry2Idx: number; durationMinutes: number }[][] = [
  [
    { entry1Idx: 0, entry2Idx: 1, durationMinutes: 30 },
    { entry1Idx: 2, entry2Idx: 3, durationMinutes: 30 }
  ],
  [
    { entry1Idx: 0, entry2Idx: 2, durationMinutes: 30 },
    { entry1Idx: 1, entry2Idx: 3, durationMinutes: 30 }
  ],
  [
    { entry1Idx: 0, entry2Idx: 3, durationMinutes: 30 },
    { entry1Idx: 1, entry2Idx: 2, durationMinutes: 30 }
  ]
]

describe('nextPowerOfTwo', () => {
  // TestNextPowerOfTwo table (verbatim).
  const table: [number, number][] = [
    [0, 1], [1, 1], [2, 2], [3, 4], [4, 4], [5, 8], [7, 8], [8, 8], [9, 16],
    [15, 16], [16, 16], [63, 64], [127, 128], [129, 256], [1025, 2048]
  ]
  for (const [input, expected] of table) {
    it(`returns ${expected} for input ${input}`, () => {
      expect(nextPowerOfTwo(input)).toBe(expected)
    })
  }
})

describe('generateGroupRounds', () => {
  it('should match the Go golden output for the 6-player round-robin', () => {
    const rounds = generateGroupRounds([0, 1, 2, 3, 4, 5], 30)
    expect(rounds).toHaveLength(5)
    for (let r = 0; r < 5; r++) {
      expect(projected(rounds[r])).toEqual(sixPlayerGolden[r])
    }
  })

  it('should return an empty array for a single entry (no matches, no throw)', () => {
    expect(generateGroupRounds([0], 30)).toEqual([])
  })

  it('generates a complete round-robin for an ODD group size (3 players + bye)', () => {
    // Regression: the JS port used float division where Go used integer
    // division, so odd group sizes undercounted rounds and isRoundValid()
    // threw 'generateGroupRounds encounter error'. With a bye appended, 3
    // players must yield 3 rounds of exactly 1 real match each (the bye pair is
    // dropped), covering all 3 pairings exactly once.
    const rounds = generateGroupRounds([0, 1, 2], 30)
    expect(rounds).toHaveLength(3)
    const pairs = rounds
      .map((r) => ({ entry1Idx: r[0].entry1Idx, entry2Idx: r[0].entry2Idx }))
      .map((p) =>
        p.entry1Idx < p.entry2Idx ? [p.entry1Idx, p.entry2Idx] : [p.entry2Idx, p.entry1Idx]
      )
    expect(pairs).toEqual(
      expect.arrayContaining([
        [0, 1],
        [0, 2],
        [1, 2]
      ])
    )
    // No match references the virtual bye entry.
    for (const round of rounds) {
      for (const m of round) {
        expect(m.entry1Idx).not.toBe(EntryByeIdx)
        expect(m.entry2Idx).not.toBe(EntryByeIdx)
      }
    }
  })

  it('generates a complete round-robin for 5 players + bye (10 matches, 5 rounds)', () => {
    const rounds = generateGroupRounds([0, 1, 2, 3, 4], 30)
    expect(rounds).toHaveLength(5)
    const seen = new Set<string>()
    let total = 0
    for (const round of rounds) {
      for (const m of round) {
        const key = [m.entry1Idx, m.entry2Idx].sort((a, b) => a - b).join('-')
        expect(seen.has(key)).toBe(false)
        seen.add(key)
        total++
      }
    }
    expect(total).toBe(10)
  })
})

describe('getRoundMatches', () => {
  it('should match the Go golden output for 4-player round 0, 1, 2', () => {
    const entriesIdx = [0, 1, 2, 3]
    for (let r = 0; r < 3; r++) {
      const matches = getRoundMatches(r, entriesIdx, 30)
      expect(projected(matches)).toEqual(fourPlayerGolden[r])
    }
  })
})

describe('getRoundPlayersIndices', () => {
  // Port of Go's Test_getRoundPlayersIndices: the bouncing rotation must yield a
  // complete, disjoint pairing for every even player count — each round pairs
  // every player exactly once. (We drop the rotation-based reference half per
  // the design's dead-code list and assert the round-robin completeness property
  // directly, which is independent of the reference.)
  for (let numPlayers = 4; numPlayers <= 14; numPlayers += 2) {
    it(`yields a complete round-robin for ${numPlayers} players across all rounds`, () => {
      const numRounds = numPlayers - 1
      for (let r = 0; r < numRounds; r++) {
        const indices = getRoundPlayersIndices(r, numPlayers)
        expect(indices).toHaveLength(numPlayers)
        // Each player index appears exactly once in this round's pairing.
        const sorted = [...indices].sort((a, b) => a - b)
        expect(sorted).toEqual(Array.from({ length: numPlayers }, (_, i) => i))
        // Every consecutive pair is a distinct match (no pairing repeats within the round).
        for (let i = 0; i < numPlayers; i += 2) {
          expect(indices[i]).not.toBe(indices[i + 1])
        }
      }
    })
  }
})

describe('generateKnockoutRounds', () => {
  it('should throw "not enough players" when a group has fewer entries than qualifiers', () => {
    expect(() => generateKnockoutRounds([{ entriesIdx: [0], rounds: [] }], 2)).toThrow(
      'not enough players'
    )
  })

  it('should build FULL knockout rounds with structural byes in the entry round', () => {
    // ko-import spec §4 (lineup-manager .scratch/ko-import): knockout rounds are
    // full power-of-two brackets — the entry round keeps every slot and carries
    // its byes structurally (Match.bye, evenly distributed), replacing the Go
    // oracle's shrunk first round (numMatches = firstRound/2 − byes). The Go
    // golden is retained for the bye-free cases, which are unchanged.
    // Each case: [numGroups, groupSize, numQualifiedPerGroup, expectedRounds, entryRoundByeIdxs]
    // where expectedRounds is [roundSize, numMatches][].
    const cases: [number, number, number, [number, number][], number[]][] = [
      // "2 groups, 2 qualified per group": 4 qualified -> nextPowerOfTwo(4)=4, no byes
      [2, 2, 2, [[4, 2], [2, 1]], []],
      // "4 groups, 1 qualified per group": 4 qualified -> 4, no byes
      [4, 2, 1, [[4, 2], [2, 1]], []],
      // "3 groups, 2 qualified per group": 6 qualified -> 8: 4 entry matches, 2 byes
      [3, 4, 2, [[8, 4], [4, 2], [2, 1]], [0, 2]],
      // "5 groups, 4 qualified per group": 20 qualified -> 32: 16 entry matches, 12 byes
      [
        5,
        4,
        4,
        [
          [32, 16],
          [16, 8],
          [8, 4],
          [4, 2],
          [2, 1]
        ],
        [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14]
      ]
    ]

    for (const [numGroups, groupSize, qualified, expectedRounds, expectedByeIdxs] of cases) {
      const groups = Array.from({ length: numGroups }, (_, g) => ({
        entriesIdx: Array.from({ length: groupSize }, (_, i) => i + g * groupSize),
        rounds: [] as Array<Array<Match>>
      }))
      const rounds = generateKnockoutRounds(groups, qualified)
      expect(rounds).toHaveLength(expectedRounds.length)
      for (let i = 0; i < expectedRounds.length; i++) {
        const [round, numMatches] = expectedRounds[i]
        expect(rounds[i].round).toBe(round)
        expect(rounds[i].matches).toHaveLength(numMatches)
        // Every knockout match is an empty placeholder in a fresh bracket.
        for (const match of rounds[i].matches) {
          expect(match.entry1Idx).toBe(EntryEmptyIdx)
          expect(match.entry2Idx).toBe(EntryEmptyIdx)
        }
      }
      // Byes live only in the entry round, at the evenly spread indices.
      const byeIdxs = rounds[0].matches.map((m, i) => (m.bye ? i : -1)).filter((i) => i >= 0)
      expect(byeIdxs).toEqual(expectedByeIdxs)
      for (const round of rounds.slice(1)) {
        expect(round.matches.some((m) => m.bye)).toBe(false)
      }
    }
  })
})

describe('generateRoundsForTournament', () => {
  it('should produce rounds and knockoutRounds for a multi-group tournament identical to Go', () => {
    // A category whose single group carries the 6-player Go golden input.
    const tournament: Tournament = {
      name: 'Golden',
      numTables: 1,
      startTime: '2025-03-22T09:00',
      categories: [
        {
          name: "Men's Singles",
          entryType: 'Singles',
          shortName: 'MS',
          entriesPerGrpMain: 6,
          entriesPerGrpRemainder: 5,
          durationMinutes: 30,
          numQualifiedPerGroup: 2,
          entries: Array.from({ length: 6 }, (_, i) => ({
            entryType: 'Singles',
            singlesEntry: { player: { name: `P${i}`, dateOfBirth: '1990-01-01', gender: 'M' } }
          })),
          groups: [{ entriesIdx: [0, 1, 2, 3, 4, 5], rounds: [] }],
          knockoutRounds: []
        }
      ]
    }

    const result = generateRoundsForTournament(tournament)
    const group = result.categories[0].groups[0]
    expect(group.rounds).toHaveLength(5)
    for (let r = 0; r < 5; r++) {
      expect(projected(group.rounds[r])).toEqual(sixPlayerGolden[r])
    }

    // 1 group × 2 qualified -> nextPowerOfTwo(2)=2 -> Round 2 (1 match).
    expect(result.categories[0].knockoutRounds).toHaveLength(1)
    expect(result.categories[0].knockoutRounds[0].round).toBe(2)
    expect(result.categories[0].knockoutRounds[0].matches).toHaveLength(1)
    expect(result.categories[0].knockoutRounds[0].matches[0].entry1Idx).toBe(EntryEmptyIdx)
    expect(result.categories[0].knockoutRounds[0].matches[0].entry2Idx).toBe(EntryEmptyIdx)
  })
})
