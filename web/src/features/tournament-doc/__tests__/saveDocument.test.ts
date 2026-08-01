import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  saveTournamentDocument,
  SaveFileError,
  type FileSink
} from '@/features/tournament-doc/saveDocument'
import { tournament, newTournament, currentFileHandle } from '@/app/documentStore'
import { listRecents, removeRecent } from '@/features/tournament-doc/storage/recents'
import { serialize } from '@/shared/model'

function sinkReturning(handle: FileSystemFileHandle | null): FileSink {
  return { write: vi.fn(async () => handle) }
}

describe('saveTournamentDocument', () => {
  beforeEach(async () => {
    tournament.value = newTournament()
    currentFileHandle.value = null
    for (const r of await listRecents()) await removeRecent(r.id)
  })

  it('serializes the active tournament and writes exactly serialize() via the sink', async () => {
    tournament.value.name = 'To Save'
    const sink = sinkReturning(null)
    await saveTournamentDocument(sink)
    expect(sink.write).toHaveBeenCalledWith(serialize(tournament.value))
  })

  it('remembers a handle returned by the sink as the current file handle', async () => {
    const handle = {} as FileSystemFileHandle
    await saveTournamentDocument(sinkReturning(handle))
    expect(currentFileHandle.value).toBe(handle)
  })

  it('updates the recents list (refreshes lastModified) on save', async () => {
    tournament.value.name = 'Saved Doc'
    await saveTournamentDocument(sinkReturning(null))
    const recents = await listRecents()
    expect(recents).toHaveLength(1)
    expect(recents[0].name).toBe('Saved Doc')
  })

  it('records sourceKind "downloaded" when the sink returns no handle', async () => {
    await saveTournamentDocument(sinkReturning(null))
    expect((await listRecents())[0].sourceKind).toBe('downloaded')
  })

  it('throws SaveFileError when the sink fails (e.g. permission denied)', async () => {
    const sink: FileSink = {
      write: async () => {
        throw new DOMException('permission denied', 'SecurityError')
      }
    }
    await expect(saveTournamentDocument(sink)).rejects.toBeInstanceOf(SaveFileError)
  })
})
