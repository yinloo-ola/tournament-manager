import { tournament, currentFileHandle } from '@/app/documentStore'
import { recordRecent } from './storage/recents'
import { serialize } from '@/shared/model'

// What a save produced. Distinguishing these lets the UI inform the user
// correctly (e.g. "saved as a download — the on-disk file was not updated").
export type SaveOutcome =
  | { kind: 'file'; handle: FileSystemFileHandle } // written to a file (in-place or newly created)
  | { kind: 'download' } // saved via browser download (no FSA, or permission-denied fallback)
  | { kind: 'cancelled' } // user dismissed the save picker

export interface FileSink {
  write(text: string): Promise<SaveOutcome> // throws on genuine failure
}

export class SaveFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SaveFileError'
  }
}

export interface SaveResult {
  saved: boolean
  downloaded: boolean
}

// Save the active tournament through a sink: serialize -> write -> remember any
// handle -> refresh the recent. Cancel is a no-op; genuine sink failures become
// SaveFileError. The document is never corrupted (we only remember a handle /
// touch recents after a successful write).
export async function saveTournamentDocument(sink: FileSink): Promise<SaveResult> {
  const text = serialize(tournament.value)

  let outcome: SaveOutcome
  try {
    outcome = await sink.write(text)
  } catch (error) {
    throw new SaveFileError(
      error instanceof Error ? `Could not save the file: ${error.message}` : 'Could not save the file.'
    )
  }

  if (outcome.kind === 'cancelled') return { saved: false, downloaded: false }

  const handle = outcome.kind === 'file' ? outcome.handle : null
  if (handle) currentFileHandle.value = handle

  // Recents is best-effort: a failure here must not turn a successful file save
  // into a misleading "Save failed".
  try {
    await recordRecent({
      name: tournament.value.name || 'tournament',
      sourceKind: handle ? 'file' : 'downloaded',
      fileHandle: handle ?? undefined
    })
  } catch (error) {
    console.warn('failed to update recents after save', error)
  }

  return { saved: true, downloaded: outcome.kind === 'download' }
}
