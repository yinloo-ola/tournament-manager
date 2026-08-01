import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import {
  saveAutosave,
  loadAutosave,
  clearAutosave,
  startAutosaveWatch
} from '@/features/tournament-doc/storage/autosave'
import { newTournament } from '@/app/documentStore'
import { Entry, EntryType } from '@/shared/model'

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms))

function singlesEntry(name: string): Entry {
  const e = new Entry(EntryType.Singles)
  e.singlesEntry = { player: { name, dateOfBirth: '', gender: 'M' } }
  return e
}

describe('autosave — data layer', () => {
  beforeEach(async () => {
    await clearAutosave()
  })

  it('saveAutosave/loadAutosave round-trip a tournament (rehydrated as Entry instances)', async () => {
    const t = newTournament()
    t.name = 'Round Trip'
    t.categories[0].entries.push(singlesEntry('Alice'))
    await saveAutosave(t)

    const restored = await loadAutosave()
    expect(restored).not.toBeNull()
    expect(restored!.name).toBe('Round Trip')
    expect(restored!.categories[0].entries[0]).toBeInstanceOf(Entry)
    expect(restored!.categories[0].entries[0].name).toBe('Alice')
  })

  it('loadAutosave returns null when nothing is saved', async () => {
    expect(await loadAutosave()).toBeNull()
  })
})

describe('autosave — debounced watch', () => {
  beforeEach(async () => {
    await clearAutosave()
  })

  it('persists the active tournament to IndexedDB after a change', async () => {
    const tournament = ref(newTournament())
    const stop = startAutosaveWatch(tournament, { debounceMs: 20 })
    tournament.value.name = 'Persisted'
    await tick(60)
    stop()

    const restored = await loadAutosave()
    expect(restored).not.toBeNull()
    expect(restored!.name).toBe('Persisted')
  })

  it('coalesces a burst of rapid changes into a single write', async () => {
    let writes = 0
    const tournament = ref(newTournament())
    const stop = startAutosaveWatch(tournament, {
      debounceMs: 20,
      write: async () => {
        writes++
      }
    })

    for (let i = 0; i < 5; i++) tournament.value.name = `N${i}`
    await tick(60)
    stop()

    expect(writes).toBe(1)
  })

  it('autosaves a new, never-saved tournament', async () => {
    const tournament = ref(newTournament())
    const stop = startAutosaveWatch(tournament, { debounceMs: 20 })
    tournament.value.numTables = 5
    await tick(60)
    stop()

    expect((await loadAutosave())!.numTables).toBe(5)
  })

  it('on a write error (e.g. quota), calls onWarning and does not throw into the watcher', async () => {
    const onWarning = vi.fn()
    const tournament = ref(newTournament())
    const stop = startAutosaveWatch(tournament, {
      debounceMs: 20,
      write: async () => {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
      },
      onWarning
    })

    tournament.value.name = 'X'
    await tick(60) // must not throw
    stop()

    expect(onWarning).toHaveBeenCalledTimes(1)
  })
})
