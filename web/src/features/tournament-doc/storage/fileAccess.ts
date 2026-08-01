import type { FileSource, OpenedFile } from '../openDocument'
import { openFileInputSource } from './fileFallback'

// Feature-detect the File System Access API.
export function isFileSystemAccessSupported(): boolean {
  return typeof (globalThis as { showOpenFilePicker?: unknown }).showOpenFilePicker === 'function'
}

// File System Access source: native picker, retains the handle so the file can
// be reopened in place (and saved back in Req 6).
export function openFilePickerSource(): FileSource {
  return {
    async pickAndRead(): Promise<OpenedFile | null> {
      const show = (globalThis as {
        showOpenFilePicker?: (opts: unknown[]) => Promise<FileSystemFileHandle[]>
      }).showOpenFilePicker!
      const [handle] = await show([
        {
          description: 'Tournament',
          accept: { 'application/json': ['.json'] }
        }
      ])
      const file = await handle.getFile()
      return { text: await file.text(), name: file.name, handle }
    }
  }
}

// Pick the best available open source for the current browser.
export function pickOpenSource(): FileSource {
  return isFileSystemAccessSupported() ? openFilePickerSource() : openFileInputSource()
}

// Build a source that reads from an already-held file handle (reopening a
// file-backed recent without re-prompting).
export function openFromHandleSource(handle: FileSystemFileHandle, name: string): FileSource {
  return {
    async pickAndRead() {
      const file = await handle.getFile()
      return { text: await file.text(), name, handle }
    }
  }
}
