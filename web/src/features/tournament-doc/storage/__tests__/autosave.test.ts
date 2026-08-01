import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import {
  saveAutosave,
  loadAutosave,
  clearAutosave,
  startAutosaveWatch,
  resumeFromAutosave
} from '@/features/tournament-doc/storage/autosave'
import { openDb, STORES } from '@/features/tournament-doc/storage/db'
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

describe('autosave — resume on reopen', () => {
  beforeEach(async () => {
    await clearAutosave()
  })

  it('restores the most recent state into the document ref after no explicit save', async () => {
    const editing = ref(newTournament())
    editing.value.name = 'Reopen Me'
    await saveAutosave(editing.value)

    const reopened = ref(newTournament())
    const restored = await resumeFromAutosave(reopened)
    expect(restored).toBe(true)
    expect(reopened.value.name).toBe('Reopen Me')
  })

  it('returns false (no restore) when nothing is saved', async () => {
    const t = ref(newTournament())
    expect(await resumeFromAutosave(t)).toBe(false)
    expect(t.value.name).toBe('')
  })

  it('does not throw and self-heals when the autosave record is corrupt', async () => {
    // write corrupt bytes directly into the autosave store
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.autosave, 'readwrite')
      tx.objectStore(STORES.autosave).put('{not valid json', 'latest')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })

    const t = ref(newTournament())
    t.value.name = 'Kept'
    const restored = await resumeFromAutosave(t) // must not throw
    expect(restored).toBe(false)
    expect(t.value.name).toBe('Kept') // current document not clobbered
    expect(await loadAutosave()).toBeNull() // corrupt record self-healed (cleared)
  })
})
