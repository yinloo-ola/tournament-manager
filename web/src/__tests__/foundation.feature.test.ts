import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { ref } from 'vue'
import { tournament, newTournament, currentFileHandle } from '@/app/documentStore'
import {
  startAutosaveWatch,
  resumeFromAutosave,
  saveAutosave,
  clearAutosave
} from '@/features/tournament-doc/storage/autosave'
import { saveTournamentDocument, type SaveOutcome } from '@/features/tournament-doc/saveDocument'
import { listRecents, removeRecent } from '@/features/tournament-doc/storage/recents'
import { serialize } from '@/shared/model'

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Feature acceptance (from the design doc): the requirements compose into an
// end-to-end document lifecycle with no server.
describe('feature acceptance — document lifecycle (no server)', () => {
  beforeEach(async () => {
    tournament.value = newTournament()
    currentFileHandle.value = null
    await clearAutosave()
    for (const r of await listRecents()) await removeRecent(r.id)
  })

  it('open -> edit -> reload -> save: autosave bridges the reload and save persists the edits', async () => {
    // user creates + edits a tournament while autosave is watching
    const stop = startAutosaveWatch(tournament, { debounceMs: 20 })
    tournament.value.name = 'Edits Before Reload'
    tournament.value.numTables = 6
    await tick(60) // autosave flushes to IndexedDB
    stop()

    // simulate a tab reload: a fresh boot restores from autosave
    tournament.value = newTournament()
    expect(tournament.value.name).toBe('') // back to defaults, as if reloaded
    await resumeFromAutosave(tournament)
    expect(tournament.value.name).toBe('Edits Before Reload')
    expect(tournament.value.numTables).toBe(6) // edits survived the reload

    // user saves (fake sink captures the bytes that would be written to the file)
    let savedBytes: string | null = null
    const sink = {
      write: async (text: string): Promise<SaveOutcome> => {
        savedBytes = text
        return { kind: 'file', handle: {} as FileSystemFileHandle }
      }
    }
    const result = await saveTournamentDocument(sink)
    expect(result.saved).toBe(true)
    expect(savedBytes).toBe(serialize(tournament.value)) // the file reflects the edits
    expect((await listRecents()).some((r) => r.name === 'Edits Before Reload')).toBe(true)
  })

  it('crash recovery: unsaved edits with no explicit save are restored on reopen', async () => {
    const editing = ref(newTournament())
    editing.value.name = 'Crash Recovery'
    await saveAutosave(editing.value)

    // crash + reopen: a fresh document with no explicit save
    const reopened = ref(newTournament())
    const restored = await resumeFromAutosave(reopened)
    expect(restored).toBe(true)
    expect(reopened.value.name).toBe('Crash Recovery')
  })
})
