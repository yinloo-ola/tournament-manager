/**
 * Feature acceptance test for Slice 3 — Schedule.
 *
 * Verifies the full in-browser round-trip:
 * 1. Generate draft schedule (scheduleMatches)
 * 2. Export as .xlsx (createDraftScheduleWorkbook → buffer)
 * 3. Re-import the .xlsx (importFinalScheduleFromBuffer)
 * 4. Merge into tournament (calculator/schedule.ts importFinalSchedule)
 * 5. Assert the merged tournament's match datetimes/tables agree
 *
 * No HTTP request is made (fetch is mocked and asserted unused).
 */

import { describe, it, expect, vi } from 'vitest'
import { scheduleMatches } from '@/features/schedule/domain/scheduleMatches'
import {
  createDraftScheduleWorkbook,
  workbookToBuffer
} from '@/features/schedule/excel/draftScheduleWorkbook'
import { importFinalScheduleFromBuffer } from '@/features/schedule/domain/importFinalSchedule'
import { importFinalSchedule as mergeFinalSchedule } from '@/calculator/schedule'
import { generateRoundsForTournament } from '@/features/matches/domain/generateRounds'
import { Entry, type Tournament } from '@/shared/model'

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

function buildFeatureTournament(): Tournament {
  return {
    name: 'Schedule Feature Test',
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

describe('Slice 3 Feature Acceptance: Schedule round-trip with no server', () => {
  it('should generate, export, re-import, and merge a draft schedule entirely in-browser', async () => {
    // Mock fetch to assert it's never called
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response())

    const tournament = buildFeatureTournament()

    // 1. Generate rounds + schedule
    generateRoundsForTournament(tournament)
    const schedule = scheduleMatches(tournament)
    expect(schedule.timeSlots.length).toBeGreaterThan(0)

    // 2. Export as .xlsx
    const wb = createDraftScheduleWorkbook(tournament, schedule)
    const buffer = await workbookToBuffer(wb)
    expect(buffer.byteLength).toBeGreaterThan(0)

    // 3. Re-import the .xlsx
    const imported = await importFinalScheduleFromBuffer(buffer)

    // 4. Merge into tournament
    const ok = mergeFinalSchedule(
      imported.categoriesGroupsMap,
      imported.categoriesKnockoutRoundsMap,
      tournament
    )
    expect(ok).toBe(true)

    // 5. Assert the merged tournament has datetimes and tables on group matches
    for (const category of tournament.categories) {
      for (const group of category.groups) {
        for (const round of group.rounds) {
          for (const match of round) {
            // Every group match should now have a datetime and table
            expect(match.datetime).toBeTruthy()
            expect(match.table).toMatch(/^T\d+$/)
          }
        }
      }
    }

    // 6. Assert no HTTP request was made
    expect(fetchSpy).not.toHaveBeenCalled()

    fetchSpy.mockRestore()
  })

  it('should produce consistent match counts across export and import', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response())

    const tournament = buildFeatureTournament()
    generateRoundsForTournament(tournament)
    const schedule = scheduleMatches(tournament)

    // Count original matches
    let originalGroupMatches = 0
    let originalKnockoutMatches = 0
    for (const slot of schedule.timeSlots) {
      for (const match of slot.tables) {
        if (!match) continue
        if (match.groupIdx >= 0) originalGroupMatches++
        else originalKnockoutMatches++
      }
    }

    // Export + import
    const wb = createDraftScheduleWorkbook(tournament, schedule)
    const buffer = await workbookToBuffer(wb)
    const imported = await importFinalScheduleFromBuffer(buffer)

    // Count imported matches
    let importedGroupMatches = 0
    let importedKnockoutMatches = 0
    for (const cat of Object.keys(imported.categoriesGroupsMap)) {
      for (const group of imported.categoriesGroupsMap[cat]) {
        for (const round of group.rounds) {
          importedGroupMatches += round.length
        }
      }
    }
    for (const cat of Object.keys(imported.categoriesKnockoutRoundsMap)) {
      for (const koRound of imported.categoriesKnockoutRoundsMap[cat]) {
        importedKnockoutMatches += koRound.matches.length
      }
    }

    expect(importedGroupMatches).toBe(originalGroupMatches)
    expect(importedKnockoutMatches).toBe(originalKnockoutMatches)

    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})
