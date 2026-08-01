import { describe, it, expect } from 'vitest'
import { Entry, EntryByeIdx, EntryEmptyIdx, EntryType, type Group, type Match } from '@/shared/model'
import { doDraw, clearDraw } from '../draw'
import { calculatorGroups, getGroup } from '../groups'

describe('calculatorGroups', () => {
  // Regression lock for the relocated @/calculator/groups logic: total capacity
  // must cover the player count, and for a balanced input (main and remainder
  // sizes differ by 1) the count must be exact with no empty slots.
  it('should compute group counts preserving legacy capacity', () => {
    // 6 players, main=4, remainder=3 (sizes differ by 1).
    const { numGroupsMain, numGroupsRemainder } = calculatorGroups(6, 4, 3)
    expect(numGroupsMain + numGroupsRemainder).toBe(2)
    const totalSlots = numGroupsMain * 4 + numGroupsRemainder * 3
    expect(totalSlots).toBe(6)
  })
})

describe('doDraw', () => {
  // Builds 6 single entries and two 3-slot groups, then asserts the draw is a
  // complete, conflict-free assignment — independent of the Math.random weights.
  function makeEntries(n: number) {
    return Array.from({ length: n }, (_, i) => {
      const e = new Entry(EntryType.Singles)
      e.singlesEntry!.player = { name: `P${i}`, dateOfBirth: '1990-01-01', gender: 'M' }
      return e
    })
  }

  it('should assign every player exactly once with no empty slots', async () => {
    const groups: Group[] = [getGroup(3), getGroup(3)]
    const entries = makeEntries(6)
    const otherPlayers = entries.map((player, entryIdx) => ({ player, entryIdx }))

    await doDraw(groups, [], otherPlayers, 0)

    // No empty slots remain anywhere.
    const all = groups.flatMap((g) => g.entriesIdx)
    expect(all).not.toContain(EntryEmptyIdx)
    expect(all).not.toContain(EntryByeIdx)

    // Every input entry index appears exactly once.
    const sorted = [...all].sort((a, b) => a - b)
    expect(sorted).toEqual([0, 1, 2, 3, 4, 5])
  })
})

describe('clearDraw', () => {
  it('should reset all rounds and entries to EntryEmptyIdx', () => {
    const groups: Group[] = [{
      entriesIdx: [0, 1, 2],
      rounds: [[
        { entry1Idx: 0, entry2Idx: 1, datetime: '', durationMinutes: 30, table: 'T1' } as Match,
        { entry1Idx: 2, entry2Idx: 0, datetime: '', durationMinutes: 30, table: 'T2' } as Match
      ]]
    }]

    clearDraw(EntryType.Singles, groups)

    for (const g of groups) {
      for (const idx of g.entriesIdx) {
        expect(idx).toBe(EntryEmptyIdx)
      }
      for (const round of g.rounds) {
        for (const match of round) {
          expect(match.entry1Idx).toBe(EntryEmptyIdx)
          expect(match.entry2Idx).toBe(EntryEmptyIdx)
        }
      }
    }
  })
})
