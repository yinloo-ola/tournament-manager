import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import { EntryType } from '@/shared/model'
import type { Category } from '@/shared/model'
import CategoryCard from '@/features/tournament-config/ui/CategoryCard.vue'
import { Entry } from '@/shared/model'

const baseCategory: Category = {
  name: 'Men Singles',
  shortName: 'MS',
  entryType: EntryType.Singles,
  entries: [new Entry(EntryType.Singles)],
  groups: [],
  knockoutRounds: [],
  entriesPerGrpMain: 4,
  entriesPerGrpRemainder: 3,
  durationMinutes: 30,
  numQualifiedPerGroup: 2
}

describe('CategoryCard', () => {
  // Regression guards for the relocation of components/CategoryCard.vue ->
  // features/tournament-config/ui/CategoryCard.vue. They assert the observable
  // emit contract, not import paths, so they remain meaningful after the move.

  it('should emit startDraw when DO DRAW clicked', async () => {
    const wrapper = mount(CategoryCard, {
      props: { modelValue: structuredClone(baseCategory) }
    })

    const drawButton = wrapper
      .findAll('button')
      .filter((b) => b.text() === 'DO DRAW')[0]
    await drawButton.trigger('click')
    await nextTick()

    expect(wrapper.emitted('startDraw')).toBeTruthy()
    expect(wrapper.emitted('startDraw')!.length).toBe(1)
  })

  it('should emit remove when the remove icon clicked', async () => {
    const wrapper = mount(CategoryCard, {
      props: { modelValue: structuredClone(baseCategory) }
    })

    const removeIcon = wrapper.find('.i-line-md-close')
    await removeIcon.trigger('click')
    await nextTick()

    expect(wrapper.emitted('remove')).toBeTruthy()
    expect(wrapper.emitted('remove')!.length).toBe(1)
  })

  it('should emit playerCountChanged when player count edited', async () => {
    const wrapper = mount(CategoryCard, {
      props: { modelValue: structuredClone(baseCategory) }
    })

    // Two inputs share name="players" (Main + Remainder). The "Main" one is
    // first and fires playerCountChanged('main').
    const mainCount = wrapper.findAll('input[name="players"]')[0]
    await mainCount.trigger('change')
    await nextTick()

    expect(wrapper.emitted('playerCountChanged')).toBeTruthy()
    expect(wrapper.emitted('playerCountChanged')![0][0]).toBe('main')
  })

  // Matches button → router.push(`/tournament/matches/${shortName}`). shortName
  // is the routing key; empty pushes `/tournament/matches/`, which the catch-all
  // route redirects to the home launcher — discarding the user's place in setup.
  // The button must therefore stay disabled until a Short Form is entered.
  describe('Matches button', () => {
    function matchesButton(wrapper: ReturnType<typeof mount>) {
      return wrapper.findAll('button').filter((b) => b.text().includes('Matches'))[0]
    }

    it('is disabled when the category has no Short Form', () => {
      const cat = structuredClone(baseCategory)
      cat.shortName = ''
      cat.entries = [new Entry(EntryType.Singles)] // entries present (no entries also disables)
      const wrapper = mount(CategoryCard, { props: { modelValue: cat } })
      expect(matchesButton(wrapper).attributes('disabled')).toBeDefined()
    })

    it('is disabled when the category has no entries', () => {
      const cat = structuredClone(baseCategory)
      cat.shortName = 'MS'
      cat.entries = []
      const wrapper = mount(CategoryCard, { props: { modelValue: cat } })
      expect(matchesButton(wrapper).attributes('disabled')).toBeDefined()
    })

    it('is enabled when both a Short Form and entries are present', () => {
      const cat = structuredClone(baseCategory)
      cat.shortName = 'MS'
      cat.entries = [new Entry(EntryType.Singles)]
      const wrapper = mount(CategoryCard, { props: { modelValue: cat } })
      expect(matchesButton(wrapper).attributes('disabled')).toBeUndefined()
    })
  })
})
