import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import KnockoutMatchesTab from '@/features/matches/ui/KnockoutMatchesTab.vue'
import { generateRoundsForTournament } from '@/features/matches/domain/generateRounds'
import { Entry, EntryType, type Tournament, type Category } from '@/shared/model'

function entry(name: string): Entry {
  const e = new Entry(EntryType.Singles)
  e.singlesEntry!.player.name = name
  return e
}

function makeTournament(): Tournament {
  const entries = Array.from({ length: 8 }, (_, i) => entry(`P${i + 1}`))
  const groupEntryIdx = [[0, 1], [2, 3], [4, 5], [6, 7]]
  const groups = groupEntryIdx.map((idx) => ({ entriesIdx: idx, rounds: [] }))
  const category: Category = {
    name: 'Singles',
    shortName: 'main',
    entryType: EntryType.Singles,
    entriesPerGrpMain: 3,
    entriesPerGrpRemainder: 4,
    entries,
    groups,
    knockoutRounds: [],
    durationMinutes: 30,
    numQualifiedPerGroup: 2
  }
  return { name: 'T', numTables: 2, startTime: '', categories: [category] }
}

describe('KnockoutMatchesTab (relocated to features/matches/ui)', () => {
  // R5 test #2 — relocation regression: the tab must render the descending
  // knockout bracket (8 -> 4 -> 2) and show 'NA' placeholders for empty
  // (EntryEmptyIdx) slots.
  it('renders descending knockout rounds (8 -> 4 -> 2) with empty-slot placeholders', () => {
    const t = makeTournament()
    generateRoundsForTournament(t)
    const cat = t.categories[0]

    const wrapper = mount(KnockoutMatchesTab, { props: { category: cat } })
    const rows = wrapper.findAll('tbody tr')

    // 8 -> 4 -> 2 bracket: 4 + 2 + 1 = 7 matches, all EntryEmptyIdx (-1)
    expect(rows).toHaveLength(7)

    const rounds = rows.map((r) => Number(r.findAll('td')[0].text()))
    // descending via the stable sort over empty datetime/table
    expect(rounds).toEqual([8, 8, 8, 8, 4, 4, 2])

    const cells = rows.flatMap((r) => r.findAll('td')).map((c) => c.text())
    // EntryEmptyIdx (-1) -> undefined entry -> 'NA' placeholder
    expect(cells).toContain('NA')
  })
})
