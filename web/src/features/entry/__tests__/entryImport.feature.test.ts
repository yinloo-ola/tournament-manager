import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readWorkbook } from '@/shared/excel/readWorkbook'
import { importSinglesEntries } from '@/features/entry/domain/importSingles'
import { importDoublesEntries } from '@/features/entry/domain/importDoubles'
import { importTeamEntries } from '@/features/entry/domain/importTeam'
import { Entry } from '@/shared/model'

function fixtureBuffer(name: string): Uint8Array {
  return readFileSync(resolve(process.cwd(), 'testdata', name))
}

function loadGolden(name: string): unknown {
  const path = resolve(process.cwd(), 'src/features/entry/__tests__/golden', name)
  return JSON.parse(readFileSync(path, 'utf-8'))
}

// Project away the grpIdx that TournamentView.playersImported assigns, mirroring
// the rehydration step (Entry.from + entry.grpIdx = i) in reverse.
function projectEntries(entries: unknown[]): unknown[] {
  return entries.map((e) => {
    const { grpIdx: _grpIdx, ...rest } = e as Record<string, unknown>
    return rest
  })
}

const fetchSpy = vi.fn()

beforeEach(() => {
  fetchSpy.mockClear()
  ;(globalThis as { fetch: unknown }).fetch = fetchSpy
})

describe('Feature acceptance: pure-frontend entry import (R1–R5)', () => {
  it('should import all three fixtures to byte-identical Go entries with no server', async () => {
    // ── Singles ──
    const singlesWorkbook = await readWorkbook(fixtureBuffer('Men Singles.xlsx'))
    const singles = importSinglesEntries(singlesWorkbook)
    const singlesRehydrated = projectEntries(
      singles.map((e) => Object.assign(new Entry(e.entryType), e))
    )
    expect(JSON.stringify(singlesRehydrated)).toBe(
      JSON.stringify(loadGolden('singles.golden.json'))
    )

    // ── Doubles ──
    const doublesWorkbook = await readWorkbook(fixtureBuffer('Mens Doubles.xlsx'))
    const doubles = importDoublesEntries(doublesWorkbook)
    const doublesRehydrated = projectEntries(
      doubles.map((e) => Object.assign(new Entry(e.entryType), e))
    )
    expect(JSON.stringify(doublesRehydrated)).toBe(
      JSON.stringify(loadGolden('doubles.golden.json'))
    )

    // ── Team (min = max = 3, the golden-safe bound) ──
    const teamWorkbook = await readWorkbook(fixtureBuffer('Mens Team.xlsx'))
    const team = importTeamEntries(teamWorkbook, 3, 3)
    const teamRehydrated = projectEntries(
      team.map((e) => Object.assign(new Entry(e.entryType), e))
    )
    expect(JSON.stringify(teamRehydrated)).toBe(
      JSON.stringify(loadGolden('team.golden.json'))
    )

    // No HTTP request was made anywhere in the pipeline.
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
