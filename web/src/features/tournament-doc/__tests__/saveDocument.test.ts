import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  saveTournamentDocument,
  SaveFileError,
  type FileSink,
  type SaveOutcome
} from '@/features/tournament-doc/saveDocument'
import { tournament, newTournament, currentFileHandle } from '@/app/documentStore'
import { listRecents, removeRecent } from '@/features/tournament-doc/storage/recents'
import { serialize } from '@/shared/model'

function sinkReturning(outcome: SaveOutcome): FileSink {
  return { write: vi.fn(async () => outcome) }
}

describe('saveTournamentDocument', () => {
  beforeEach(async () => {
    tournament.value = newTournament()
    currentFileHandle.value = null
    for (const r of await listRecents()) await removeRecent(r.id)
  })

  it('serializes the active tournament and writes exactly serialize() via the sink', async () => {
    tournament.value.name = 'To Save'
    const sink = sinkReturning({ kind: 'download' })
    await saveTournamentDocument(sink)
    expect(sink.write).toHaveBeenCalledWith(serialize(tournament.value))
  })

  it('remembers a handle returned by the sink (kind: file) as the current file handle', async () => {
    const handle = {} as FileSystemFileHandle
    await saveTournamentDocument(sinkReturning({ kind: 'file', handle }))
    expect(currentFileHandle.value).toBe(handle)
  })

  it('updates the recents list (refreshes lastModified) on save', async () => {
    tournament.value.name = 'Saved Doc'
    await saveTournamentDocument(sinkReturning({ kind: 'download' }))
    const recents = await listRecents()
    expect(recents).toHaveLength(1)
    expect(recents[0].name).toBe('Saved Doc')
  })

  it('records sourceKind "file" for a file save and "downloaded" for a download', async () => {
    await saveTournamentDocument(sinkReturning({ kind: 'download' }))
    expect((await listRecents())[0].sourceKind).toBe('downloaded')

    for (const r of await listRecents()) await removeRecent(r.id)
    const handle = {} as FileSystemFileHandle
    await saveTournamentDocument(sinkReturning({ kind: 'file', handle }))
    expect((await listRecents())[0].sourceKind).toBe('file')
  })

  it('is a no-op (saved=false, records nothing) when the user cancels', async () => {
    tournament.value.name = 'Unchanged'
    const result = await saveTournamentDocument(sinkReturning({ kind: 'cancelled' }))
    expect(result.saved).toBe(false)
    expect(await listRecents()).toEqual([])
  })

  it('throws SaveFileError when the sink fails (genuine write error)', async () => {
    const sink: FileSink = {
      write: async () => {
        throw new DOMException('disk full', 'NoModificationAllowedError')
      }
    }
    await expect(saveTournamentDocument(sink)).rejects.toBeInstanceOf(SaveFileError)
  })
})
