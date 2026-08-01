import type { FileSource, OpenedFile } from '../openDocument'
import type { FileSink, SaveOutcome } from '../saveDocument'
import { currentFileHandle } from '@/app/documentStore'
import { openFileInputSource, downloadText } from './fileFallback'

const TOURNAMENT_FILE_TYPE = {
  description: 'Tournament',
  accept: { 'application/json': ['.json'] }
}

// Feature-detect the File System Access API.
export function isFileSystemAccessSupported(): boolean {
  return typeof (globalThis as { showOpenFilePicker?: unknown }).showOpenFilePicker === 'function'
}

// ---- Open sources ----------------------------------------------------------

export function openFilePickerSource(): FileSource {
  return {
    async pickAndRead(): Promise<OpenedFile | null> {
      const show = (globalThis as unknown as {
        showOpenFilePicker?: (opts: unknown) => Promise<FileSystemFileHandle[]>
      }).showOpenFilePicker!
      const [handle] = await show({ types: [TOURNAMENT_FILE_TYPE] })
      const file = await handle.getFile()
      return { text: await file.text(), name: file.name, handle }
    }
  }
}

export function pickOpenSource(): FileSource {
  return isFileSystemAccessSupported() ? openFilePickerSource() : openFileInputSource()
}

export function openFromHandleSource(handle: FileSystemFileHandle, name: string): FileSource {
  return {
    async pickAndRead() {
      const file = await handle.getFile()
      return { text: await file.text(), name, handle }
    }
  }
}

// ---- Save sink -------------------------------------------------------------

// Returns true if write permission is granted (re-prompting if necessary).
async function ensureWritePermission(handle: FileSystemFileHandle): Promise<boolean> {
  const opts = { mode: 'readwrite' }
  const h = handle as unknown as {
    queryPermission(o: typeof opts): Promise<string>
    requestPermission(o: typeof opts): Promise<string>
  }
  if ((await h.queryPermission(opts)) === 'granted') return true
  return (await h.requestPermission(opts)) === 'granted'
}

// Write text to a handle, always closing the stream (avoids leaking an
// exclusive lock that would make the next save fail).
async function writeToHandle(handle: FileSystemFileHandle, text: string): Promise<void> {
  const writable = await handle.createWritable()
  try {
    await writable.write(text)
  } finally {
    await writable.close()
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

// Save sink: write in place when we hold a handle (re-granting permission,
// falling back to download if denied) -> create a new file via the save picker
// (cancel is a no-op) -> download fallback.
export function saveFileSink(): FileSink {
  return {
    async write(text: string): Promise<SaveOutcome> {
      if (currentFileHandle.value) {
        if (await ensureWritePermission(currentFileHandle.value)) {
          await writeToHandle(currentFileHandle.value, text)
          return { kind: 'file', handle: currentFileHandle.value }
        }
        // permission denied: fall back to a download (the on-disk file is NOT updated)
        downloadText(text, 'tournament.json')
        return { kind: 'download' }
      }

      if (isFileSystemAccessSupported()) {
        const show = (globalThis as unknown as {
          showSaveFilePicker?: (opts: unknown) => Promise<FileSystemFileHandle>
        }).showSaveFilePicker!
        try {
          const handle = await show({ suggestedName: 'tournament.json', types: [TOURNAMENT_FILE_TYPE] })
          await writeToHandle(handle, text)
          return { kind: 'file', handle }
        } catch (error) {
          if (isAbortError(error)) return { kind: 'cancelled' }
          throw error
        }
      }

      downloadText(text, 'tournament.json')
      return { kind: 'download' }
    }
  }
}
