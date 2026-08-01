import type { FileSource, OpenedFile } from '../openDocument'

// Fallback file source for browsers without the File System Access API
// (Firefox/Safari): a standard <input type=file> upload. No file handle is
// retained, so the recent is recorded as "downloaded" (not reopenable in place).
export function openFileInputSource(): FileSource {
  return {
    pickAndRead(): Promise<OpenedFile | null> {
      return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json,application/json'
        input.onchange = () => {
          const f = input.files?.[0]
          if (!f) {
            resolve(null)
            return
          }
          f.text().then((text) => resolve({ text, name: f.name }))
        }
        // If the user cancels the native picker, onchange never fires and this
        // promise stays pending (acceptable for the fallback path).
        input.click()
      })
    }
  }
}
