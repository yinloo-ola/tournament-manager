import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import GroupMatchesTab from '@/features/matches/ui/GroupMatchesTab.vue'
import { generateRoundsForTournament } from '@/features/matches/domain/generateRounds'
import { Entry, EntryType, type Tournament, type Category } from '@/shared/model'

function entry(name: string): Entry {
  const e = new Entry(EntryType.Singles)
  e.singlesEntry!.player.name = name
  return e
}

function makeTournament(): Tournament {
  const category: Category = {
    name: 'Singles',
    shortName: 'main',
    entryType: EntryType.Singles,
    entriesPerGrpMain: 3,
    entriesPerGrpRemainder: 4,
    entries: [entry('Alice'), entry('Bob'), entry('Carol'), entry('Dave')],
    groups: [{ entriesIdx: [0, 1, 2, 3], rounds: [] }],
    knockoutRounds: [],
    durationMinutes: 30,
    numQualifiedPerGroup: 2
  }
  return { name: 'T', numTables: 2, startTime: '', categories: [category] }
}

describe('GroupMatchesTab (relocated to features/matches/ui)', () => {
  // R5 test #1 — relocation regression: the tab must render one row per
  // round-robin match, resolving the two entries by index to their names.
  it('renders a round-robin match row for every generated match, showing entry names', () => {
    const t = makeTournament()
    generateRoundsForTournament(t)
    const cat = t.categories[0]

    const wrapper = mount(GroupMatchesTab, { props: { category: cat } })
    const rows = wrapper.findAll('tbody tr')

    // 4 players round-robin = 3 rounds x 2 matches = 6 matches
    expect(rows).toHaveLength(6)

    const cells = rows.flatMap((r) => r.findAll('td')).map((c) => c.text())
    for (const name of cat.entries.map((e) => e.name)) {
      expect(cells).toContain(name)
    }
  })
})
