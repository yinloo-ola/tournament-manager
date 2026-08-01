import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import type { Tournament } from '@/shared/model'
import TournamentInfo from '@/features/tournament-config/ui/TournamentInfo.vue'

const baseTournament: Tournament = {
  name: 'Singapore Open 2025',
  numTables: 8,
  startTime: '2025-03-22T09:00',
  categories: []
}

describe('TournamentInfo', () => {
  // Regression guards for the verbatim relocation of components/
  // TournamentInfo.vue -> features/tournament-config/ui/TournamentInfo.vue.
  // They assert observable behavior (rendered values + v-model contract), not
  // import paths, so they remain meaningful after the move.
  //
  // TournamentInfo uses v-model="tournament.name" (a property-path v-model) on
  // its OutlinedInput children, so edits MUTATE the bound object in place rather
  // than emitting update:modelValue. The "persist on edit" behavior is owned by
  // the document store's reactive autosave watch (already covered by
  // foundation.feature.test.ts), so here we lock TournamentInfo's own contract:
  // rendering the bound fields and propagating edits into the model object.

  it('should render current tournament name, tables, and start time', () => {
    const wrapper = mount(TournamentInfo, {
      props: { modelValue: structuredClone(baseTournament) }
    })

    const nameInput = wrapper.find('input[type="text"]')
    expect(nameInput.element.value).toBe('Singapore Open 2025')

    // Two number inputs: numTables (editable) and "No. of Categories" (readonly).
    const tablesInput = wrapper
      .findAll('input[type="number"]')
      .filter((i) => !i.element.readOnly)[0]
    expect(tablesInput.element.value).toBe('8')

    const startInput = wrapper.find('input[type="datetime-local"]')
    expect(startInput.element.value).toBe('2025-03-22T09:00')
  })

  it('should update the bound model when a config field is edited', async () => {
    const tournament = structuredClone(baseTournament)
    const wrapper = mount(TournamentInfo, { props: { modelValue: tournament } })

    await wrapper.find('input[type="text"]').setValue('New Tournament Name')
    await nextTick()

    // Property-path v-model mutates the object in place (no update:modelValue emit).
    expect(tournament.name).toBe('New Tournament Name')
    // Sibling fields are preserved, not clobbered, by the edit.
    expect(tournament.numTables).toBe(8)
    expect(tournament.startTime).toBe('2025-03-22T09:00')
  })
})
