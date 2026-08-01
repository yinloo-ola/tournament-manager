import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  serialize,
  parse,
  Entry,
  EntryType,
  EntryByeIdx,
  EntryEmptyIdx,
  type Tournament
} from '@/shared/model'

// ---------------------------------------------------------------------------
// EXHAUSTIVE FIELD VERIFICATION
//
// Method: assert against explicit, INDEPENDENT expected values using `toEqual`
// (deep, recursive — fails on any missing/extra/wrong field) plus
// `toBeInstanceOf(Entry)` (toEqual ignores prototypes). We avoid self-referential
// serialize↔parse round-trips as the PRIMARY assertion, because a bug present in
// both would hide. Inputs are plain objects (what arrives over the wire);
// expecteds carry Entry instances (what the in-memory model must hold).
// ---------------------------------------------------------------------------

// A comprehensive plain-object document covering every entry type, a group with
// a round-robin match, and a knockout round. This is the INPUT shape (plain).
const plainInput = {
  name: 'Comprehensive Cup',
  numTables: 4,
  startTime: '2025-03-01T09:00',
  categories: [
    {
      name: "Men's Singles",
      entryType: 'Singles',
      shortName: 'MS',
      entriesPerGrpMain: 4,
      entriesPerGrpRemainder: 2,
      durationMinutes: 30,
      numQualifiedPerGroup: 2,
      entries: [
        {
          entryType: 'Singles',
          seeding: 1,
          club: 'AC',
          singlesEntry: { player: { name: 'John Doe', dateOfBirth: '1990-01-01', gender: 'M' } }
        },
        {
          entryType: 'Singles',
          singlesEntry: { player: { name: 'Jane Roe', dateOfBirth: '1992-02-02', gender: 'F' } }
        }
      ],
      groups: [
        {
          entriesIdx: [0, 1, EntryByeIdx],
          rounds: [
            [
              {
                entry1Idx: 0,
                entry2Idx: 1,
                datetime: '2025-03-01T09:00',
                durationMinutes: 30,
                table: 'T1'
              }
            ]
          ]
        }
      ],
      knockoutRounds: [
        {
          round: 2,
          matches: [
            {
              entry1Idx: EntryEmptyIdx,
              entry2Idx: EntryEmptyIdx,
              datetime: '',
              durationMinutes: 30,
              table: '',
              round: 2
            }
          ]
        }
      ]
    },
    {
      name: "Men's Doubles",
      entryType: 'Doubles',
      shortName: 'MD',
      entriesPerGrpMain: 4,
      entriesPerGrpRemainder: 2,
      durationMinutes: 45,
      numQualifiedPerGroup: 2,
      entries: [
        {
          entryType: 'Doubles',
          seeding: 2,
          club: 'BC',
          doublesEntry: {
            players: [
              { name: 'A', dateOfBirth: '1990-01-01', gender: 'M' },
              { name: 'B', dateOfBirth: '1992-02-02', gender: 'F' }
            ]
          }
        }
      ],
      groups: [],
      knockoutRounds: []
    },
    {
      name: "Men's Team",
      entryType: 'Team',
      shortName: 'MT',
      entriesPerGrpMain: 4,
      entriesPerGrpRemainder: 2,
      durationMinutes: 60,
      numQualifiedPerGroup: 2,
      minPlayers: 2,
      maxPlayers: 3,
      entries: [
        {
          entryType: 'Team',
          teamEntry: {
            teamName: 'Team Alpha',
            players: [
              { name: 'P1', dateOfBirth: '1990-01-01', gender: 'M' },
              { name: 'P2', dateOfBirth: '1991-01-01', gender: 'M' }
            ],
            minPlayers: 2,
            maxPlayers: 3
          }
        }
      ],
      groups: [],
      knockoutRounds: []
    }
  ]
}

// The same document as the in-memory model must hold it: entries are Entry
// instances. Built field-for-field to match `plainInput` exactly.
function singlesEntry(
  player: { name: string; dateOfBirth: string; gender: string },
  opts?: { seeding?: number; club?: string }
): Entry {
  const e = new Entry(EntryType.Singles)
  e.singlesEntry = { player }
  if (opts?.seeding !== undefined) e.seeding = opts.seeding
  if (opts?.club !== undefined) e.club = opts.club
  return e
}

const expected: Tournament = {
  name: 'Comprehensive Cup',
  numTables: 4,
  startTime: '2025-03-01T09:00',
  categories: [
    {
      name: "Men's Singles",
      entryType: EntryType.Singles,
      shortName: 'MS',
      entriesPerGrpMain: 4,
      entriesPerGrpRemainder: 2,
      durationMinutes: 30,
      numQualifiedPerGroup: 2,
      entries: [
        singlesEntry({ name: 'John Doe', dateOfBirth: '1990-01-01', gender: 'M' }, { seeding: 1, club: 'AC' }),
        singlesEntry({ name: 'Jane Roe', dateOfBirth: '1992-02-02', gender: 'F' })
      ],
      groups: [
        {
          entriesIdx: [0, 1, EntryByeIdx],
          rounds: [[{ entry1Idx: 0, entry2Idx: 1, datetime: '2025-03-01T09:00', durationMinutes: 30, table: 'T1' }]]
        }
      ],
      knockoutRounds: [
        {
          round: 2,
          matches: [{ entry1Idx: EntryEmptyIdx, entry2Idx: EntryEmptyIdx, datetime: '', durationMinutes: 30, table: '', round: 2 }]
        }
      ]
    },
    {
      name: "Men's Doubles",
      entryType: EntryType.Doubles,
      shortName: 'MD',
      entriesPerGrpMain: 4,
      entriesPerGrpRemainder: 2,
      durationMinutes: 45,
      numQualifiedPerGroup: 2,
      entries: (() => {
        const e = new Entry(EntryType.Doubles)
        e.seeding = 2
        e.club = 'BC'
        e.doublesEntry = {
          players: [
            { name: 'A', dateOfBirth: '1990-01-01', gender: 'M' },
            { name: 'B', dateOfBirth: '1992-02-02', gender: 'F' }
          ]
        }
        return [e]
      })(),
      groups: [],
      knockoutRounds: []
    },
    {
      name: "Men's Team",
      entryType: EntryType.Team,
      shortName: 'MT',
      entriesPerGrpMain: 4,
      entriesPerGrpRemainder: 2,
      durationMinutes: 60,
      numQualifiedPerGroup: 2,
      minPlayers: 2,
      maxPlayers: 3,
      entries: (() => {
        const e = new Entry(EntryType.Team)
        e.teamEntry = {
          teamName: 'Team Alpha',
          players: [
            { name: 'P1', dateOfBirth: '1990-01-01', gender: 'M' },
            { name: 'P2', dateOfBirth: '1991-01-01', gender: 'M' }
          ],
          minPlayers: 2,
          maxPlayers: 3
        }
        return [e]
      })(),
      groups: [],
      knockoutRounds: []
    }
  ]
}

describe('canonical model — parse()', () => {
  it('reproduces every field of a comprehensive document (deep equality)', () => {
    const parsed = parse(JSON.stringify(plainInput))
    expect(parsed).toEqual(expected)
  })

  it('rehydrates every entry as an Entry instance', () => {
    const parsed = parse(JSON.stringify(plainInput))
    for (const cat of parsed.categories) {
      for (const entry of cat.entries) expect(entry).toBeInstanceOf(Entry)
    }
  })

  it('computes each entry type\'s name getter correctly', () => {
    const parsed = parse(JSON.stringify(plainInput))
    const [singles, doubles, team] = parsed.categories
    expect(singles.entries[0].name).toBe('John Doe')
    expect(doubles.entries[0].name).toBe('A / B')
    expect(team.entries[0].name).toBe('Team Alpha')
  })

  it('preserves group entriesIdx (incl. bye) and knockout round fields', () => {
    const parsed = parse(JSON.stringify(plainInput))
    expect(parsed.categories[0].groups[0].entriesIdx).toEqual([0, 1, EntryByeIdx])
    expect(parsed.categories[0].knockoutRounds[0].round).toBe(2)
    expect(parsed.categories[0].knockoutRounds[0].matches[0].entry1Idx).toBe(EntryEmptyIdx)
  })
})

describe('canonical model — serialize()', () => {
  it('emits every field of the in-memory document (deep equality)', () => {
    // Native JSON.parse on OUR serialize output, compared to the independent
    // plainInput — verifies serialize drops nothing and adds nothing.
    expect(JSON.parse(serialize(expected))).toEqual(plainInput)
  })
})

describe('canonical model — grounding with real fixture', () => {
  it('parses testdata/tournament.json, rehydrates entries, and is stable', () => {
    const path = resolve(process.cwd(), '../testdata/tournament.json')
    const json = readFileSync(path, 'utf-8')
    const parsed = parse(json)
    // exhaustive rehydration across the real document
    for (const cat of parsed.categories) {
      for (const entry of cat.entries) expect(entry).toBeInstanceOf(Entry)
    }
    // stability: normalizing once is a fixed point (secondary property check)
    const once = serialize(parsed)
    expect(serialize(parse(once))).toBe(once)
  })
})

describe('canonical model — constants', () => {
  it('exposes EntryByeIdx / EntryEmptyIdx', () => {
    expect(EntryByeIdx).toBe(-2)
    expect(EntryEmptyIdx).toBe(-1)
  })
})
