import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { tournament, newTournament } from '@/app/documentStore'

const pushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
  // re-export anything else HomeView may touch
  RouterLink: { template: '<a><slot /></a>' }
}))

// Imported after the mock is registered.
import HomeView from '@/views/HomeView.vue'

describe('HomeView — Create New Tournament', () => {
  it('resets the active document to a fresh default and navigates to /tournament', async () => {
    // pre-pollute to prove "New" resets rather than reuses stale state
    tournament.value = newTournament()
    tournament.value.name = 'Stale edits'

    const wrapper = mount(HomeView)
    await wrapper.get('[data-test="create-new"]').trigger('click')

    expect(tournament.value.name).toBe('')
    expect(pushMock).toHaveBeenCalledWith('/tournament')
  })
})
