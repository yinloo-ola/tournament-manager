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
// document -> record a recent. On a parse failure, throws OpenFileError and
// LEAVES THE ACTIVE DOCUMENT UNTOUCHED (never clobbers).
export async function openTournamentFromFile(source: FileSource): Promise<void> {
  const file = await source.pickAndRead()
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
