import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  openTournamentFromFile,
  OpenFileError,
  type FileSource
} from '@/features/tournament-doc/openDocument'
import { tournament, newTournament } from '@/app/documentStore'
import { listRecents, removeRecent } from '@/features/tournament-doc/storage/recents'
import { isFileSystemAccessSupported } from '@/features/tournament-doc/storage/fileAccess'
import { serialize } from '@/shared/model'

function sourceReturning(text: string | null, name = 't.json', handle?: unknown): FileSource {
  return {
    async pickAndRead() {
      return text == null ? null : { text, name, handle: handle as FileSystemFileHandle | undefined }
    }
  }
}

describe('openTournamentFromFile', () => {
  beforeEach(async () => {
    tournament.value = newTournament()
    for (const r of await listRecents()) await removeRecent(r.id)
  })

  it('loads a valid tournament into the active document and records a recent', async () => {
    const t = newTournament()
    t.name = 'From File'
    await openTournamentFromFile(sourceReturning(serialize(t)))

    expect(tournament.value.name).toBe('From File')
    const recents = await listRecents()
    expect(recents).toHaveLength(1)
    expect(recents[0].name).toBe('From File')
  })

  it('records sourceKind "file" when a handle is present, "downloaded" otherwise', async () => {
    const t = newTournament()
    await openTournamentFromFile(sourceReturning(serialize(t), 't.json', {}))
    expect((await listRecents())[0].sourceKind).toBe('file')

    for (const r of await listRecents()) await removeRecent(r.id)
    await openTournamentFromFile(sourceReturning(serialize(t)))
    expect((await listRecents())[0].sourceKind).toBe('downloaded')
  })

  it('throws OpenFileError on corrupt JSON and does NOT clobber the active document', async () => {
    tournament.value.name = 'Keep Me'
    await expect(openTournamentFromFile(sourceReturning('{not valid json'))).rejects.toBeInstanceOf(
      OpenFileError
    )
    expect(tournament.value.name).toBe('Keep Me')
    expect(await listRecents()).toEqual([])
  })

  it('throws OpenFileError on an empty/zero-byte file', async () => {
    await expect(openTournamentFromFile(sourceReturning('   '))).rejects.toBeInstanceOf(OpenFileError)
  })

  it('makes no change when the user cancels (source returns null)', async () => {
    tournament.value.name = 'Unchanged'
    await openTournamentFromFile(sourceReturning(null))
    expect(tournament.value.name).toBe('Unchanged')
    expect(await listRecents()).toEqual([])
  })
})

describe('isFileSystemAccessSupported', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns true when showOpenFilePicker is available', () => {
    vi.stubGlobal('showOpenFilePicker', vi.fn())
    expect(isFileSystemAccessSupported()).toBe(true)
  })

  it('returns false when showOpenFilePicker is absent (fallback path)', () => {
    expect(isFileSystemAccessSupported()).toBe(false)
  })
})
