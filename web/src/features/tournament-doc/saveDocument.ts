import { tournament, currentFileHandle } from '@/app/documentStore'
import { recordRecent } from './storage/recents'
import { serialize } from '@/shared/model'

export interface FileSink {
  // Write the text. Returns the handle now associated with the document (an
  // in-place write or a newly-created file), or null if saved via download.
  write(text: string): Promise<FileSystemFileHandle | null>
}

export class SaveFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SaveFileError'
  }
}

// Save the active tournament through a sink: serialize -> write -> remember any
// returned handle -> refresh the recent's lastModified. Sink failures become
// SaveFileError (the caller surfaces them; the document is never corrupted).
export async function saveTournamentDocument(sink: FileSink): Promise<{ downloaded: boolean }> {
  const text = serialize(tournament.value)

  let handle: FileSystemFileHandle | null
  try {
    handle = await sink.write(text)
  } catch (error) {
    throw new SaveFileError(
      error instanceof Error ? `Could not save the file: ${error.message}` : 'Could not save the file.'
    )
  }

  if (handle) currentFileHandle.value = handle

  await recordRecent({
    name: tournament.value.name || 'tournament',
    sourceKind: handle ? 'file' : 'downloaded',
    fileHandle: handle ?? undefined
  })

  return { downloaded: !handle }
}
