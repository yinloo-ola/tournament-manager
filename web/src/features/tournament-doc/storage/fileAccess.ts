import type { FileSource, OpenedFile } from '../openDocument'
import type { FileSink } from '../saveDocument'
import { currentFileHandle } from '@/app/documentStore'
import { openFileInputSource, downloadText } from './fileFallback'

// Feature-detect the File System Access API.
export function isFileSystemAccessSupported(): boolean {
  return typeof (globalThis as { showOpenFilePicker?: unknown }).showOpenFilePicker === 'function'
}

// ---- Open sources ----------------------------------------------------------

export function openFilePickerSource(): FileSource {
  return {
    async pickAndRead(): Promise<OpenedFile | null> {
      const show = (globalThis as {
        showOpenFilePicker?: (opts: unknown[]) => Promise<FileSystemFileHandle[]>
      }).showOpenFilePicker!
      const [handle] = await show([
        { description: 'Tournament', accept: { 'application/json': ['.json'] } }
      ])
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

async function ensureWritePermission(handle: FileSystemFileHandle): Promise<void> {
  const opts = { mode: 'readwrite' }
  const h = handle as unknown as {
    queryPermission(o: typeof opts): Promise<string>
    requestPermission(o: typeof opts): Promise<string>
  }
  if ((await h.queryPermission(opts)) === 'granted') return
  if ((await h.requestPermission(opts)) !== 'granted') {
    throw new Error('Write permission denied for this file.')
  }
}

// Save sink: write in place when we hold a handle (re-granting permission as
// needed), else create a new file via the save picker (FSA), else download.
export function saveFileSink(): FileSink {
  return {
    async write(text: string): Promise<FileSystemFileHandle | null> {
      if (currentFileHandle.value) {
        await ensureWritePermission(currentFileHandle.value)
        const writable = await currentFileHandle.value.createWritable()
        await writable.write(text)
        await writable.close()
        return currentFileHandle.value
      }

      if (isFileSystemAccessSupported()) {
        const show = (globalThis as {
          showSaveFilePicker?: (opts: unknown[]) => Promise<FileSystemFileHandle>
        }).showSaveFilePicker!
        const handle = await show([
          {
            suggestedName: 'tournament.json',
            types: [{ description: 'Tournament', accept: { 'application/json': ['.json'] } }]
          }
        ])
        const writable = await handle.createWritable()
        await writable.write(text)
        await writable.close()
        return handle
      }

      downloadText(text, 'tournament.json')
      return null
    }
  }
}
