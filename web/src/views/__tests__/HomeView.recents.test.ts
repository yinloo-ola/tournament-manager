import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { listRecents, recordRecent, removeRecent } from '@/features/tournament-doc/storage/recents'

const pushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
  RouterLink: { template: '<a><slot /></a>' }
}))

// mock the file source so the Import button doesn't touch the real DOM picker
vi.mock('@/features/tournament-doc/storage/fileAccess', () => ({
  isFileSystemAccessSupported: () => false,
  pickOpenSource: () => ({ async pickAndRead() { return null } })
}))

import HomeView from '@/views/HomeView.vue'

describe('HomeView — recents list', () => {
  beforeEach(async () => {
    for (const r of await listRecents()) await removeRecent(r.id)
  })

  it('renders the recents list on the home screen', async () => {
    await recordRecent({ name: 'Spring Open', sourceKind: 'file' })
    await recordRecent({ name: 'Summer League', sourceKind: 'downloaded' })

    const wrapper = mount(HomeView)
    await flushPromises()

    expect(wrapper.text()).toContain('Spring Open')
    expect(wrapper.text()).toContain('Summer League')
  })

  it('removes an entry from the list and IndexedDB on click (not the source file)', async () => {
    await recordRecent({ name: 'Removable', sourceKind: 'file' })
    const wrapper = mount(HomeView)
    await flushPromises()

    expect(wrapper.text()).toContain('Removable')
    await wrapper.get('[data-test="recent-remove"]').trigger('click')
    // fake-indexeddb resolves on the task queue; let IDB settle, then flush Vue.
    await new Promise((r) => setTimeout(r, 10))
    await flushPromises()

    expect(wrapper.text()).not.toContain('Removable')
    expect((await listRecents()).find((r) => r.name === 'Removable')).toBeUndefined()
  })
})
