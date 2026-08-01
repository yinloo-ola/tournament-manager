import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, computed } from 'vue'
import { tournament, newTournament } from '@/app/documentStore'
import { EntryType } from '@/shared/model'

describe('documentStore — newTournament()', () => {
  it('creates a tournament with sensible defaults (matching today\'s store/state.ts)', () => {
    const t = newTournament()
    expect(t.name).toBe('')
    expect(t.numTables).toBe(0)
    expect(t.startTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    expect(t.categories).toHaveLength(1)

    const cat = t.categories[0]
    expect(cat.entryType).toBe(EntryType.Singles)
    expect(cat.shortName).toBe('')
    expect(cat.entriesPerGrpMain).toBe(3)
    expect(cat.entriesPerGrpRemainder).toBe(4)
    expect(cat.durationMinutes).toBe(0)
    expect(cat.numQualifiedPerGroup).toBe(0)
    expect(cat.entries).toEqual([])
    expect(cat.groups).toEqual([])
    expect(cat.knockoutRounds).toEqual([])
  })

  it('returns a fresh object each call (no shared mutable default)', () => {
    expect(newTournament()).not.toBe(newTournament())
  })
})

describe('documentStore — tournament ref', () => {
  it('is a reactive ref consumable by a component', async () => {
    tournament.value = newTournament()
    tournament.value.name = 'Init'

    const Comp = defineComponent({
      setup() {
        return { name: computed(() => tournament.value.name) }
      },
      template: '<div>{{ name }}</div>'
    })

    const wrapper = mount(Comp)
    expect(wrapper.text()).toBe('Init')

    tournament.value.name = 'Updated'
    await nextTick()
    expect(wrapper.text()).toBe('Updated')
  })
})
