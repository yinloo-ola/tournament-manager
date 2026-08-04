import { tournament, currentFileHandle } from '@/app/documentStore'
import { recordRecent } from './storage/recents'
import { parse, type Tournament } from '@/shared/model'

export interface OpenedFile {
  text: string
  name: string
  handle?: FileSystemFileHandle
}

// Injectable file source so the File System Access path and the upload fallback
// are interchangeable (and unit-testable without a real browser picker).
export interface FileSource {
  pickAndRead(): Promise<OpenedFile | null> // null => user cancelled
}

export class OpenFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OpenFileError'
  }
}

// Open a tournament from a file source: read -> parse -> load into the active
// document -> record a recent. On a read or parse failure, throws OpenFileError
// and LEAVES THE ACTIVE DOCUMENT UNTOUCHED (never clobbers). Wrapping read
// failures here (not just parse failures) ensures a raw DOMException — e.g.
// NotAllowedError when a persisted handle lacks read permission, or a revoked
// file — surfaces as a user-facing error instead of escaping to Vue's global
// error handler as an unhandled rejection.
export async function openTournamentFromFile(source: FileSource): Promise<void> {
  let file: OpenedFile | null
  try {
    file = await source.pickAndRead()
  } catch (error) {
    // A FileSource may throw OpenFileError with a precise message (e.g. read
    // permission denied on a persisted handle); pass it through unchanged. Any
    // other failure gets the generic wrapping so nothing escapes to Vue's global
    // error handler as an unhandled rejection.
    if (error instanceof OpenFileError) throw error
    throw new OpenFileError(
      error instanceof Error
        ? `Could not open this file: ${error.message}`
        : 'Could not open this file.'
    )
  }
  if (file == null) return // user cancelled — no change

  let parsed: Tournament
  try {
    parsed = parse(file.text)
  } catch {
    throw new OpenFileError(
      file.text.trim() === ''
        ? 'The file is empty.'
        : 'Could not open this file: invalid tournament JSON.'
    )
  }

  tournament.value = parsed
  currentFileHandle.value = file.handle ?? null
  await recordRecent({
    name: parsed.name || file.name,
    sourceKind: file.handle ? 'file' : 'downloaded',
    fileHandle: file.handle
  })
}
