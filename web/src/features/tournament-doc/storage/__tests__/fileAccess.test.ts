import { describe, it, expect, vi } from 'vitest'
import { openFromHandleSource } from '@/features/tournament-doc/storage/fileAccess'
import { OpenFileError } from '@/features/tournament-doc/openDocument'

// A minimal fake FileSystemFileHandle: only the surface area the open path uses.
function makeFakeHandle(opts: {
  queried?: string // result of queryPermission (default 'prompt' = needs re-grant)
  granted?: string // result of requestPermission (default 'denied')
  fileText?: string
  fileName?: string
}): {
  handle: FileSystemFileHandle
  getFile: ReturnType<typeof vi.fn>
  requestPermission: ReturnType<typeof vi.fn>
  queryPermission: ReturnType<typeof vi.fn>
} {
  const getFile = vi.fn(async () => ({
    text: async () => opts.fileText ?? '{}',
    name: opts.fileName ?? 't.json'
  }))
  const queryPermission = vi.fn(async () => opts.queried ?? 'prompt')
  const requestPermission = vi.fn(async () => opts.granted ?? 'denied')
  const handle = { getFile, queryPermission, requestPermission } as unknown as FileSystemFileHandle
  return { handle, getFile, requestPermission, queryPermission }
}

describe('openFromHandleSource', () => {
  it('requests read permission (re-prompting) before getFile on a persisted handle', async () => {
    // A handle reloaded from IndexedDB starts at 'prompt' and must be re-granted
    // before getFile() is legal — otherwise the user agent rejects getFile with
    // NotAllowedError.
    const { handle, requestPermission } = makeFakeHandle({ granted: 'granted', fileText: '{"name":"x"}' })
    const result = await openFromHandleSource(handle, 't.json').pickAndRead()

    expect(requestPermission).toHaveBeenCalledWith({ mode: 'read' })
    expect(result).not.toBeNull()
    expect(result?.text).toBe('{"name":"x"}')
  })

  it('skips requestPermission when read permission is already granted', async () => {
    const { handle, requestPermission } = makeFakeHandle({ queried: 'granted', granted: 'granted' })
    await openFromHandleSource(handle, 't.json').pickAndRead()
    expect(requestPermission).not.toHaveBeenCalled()
  })

  it('throws an explicit OpenFileError (without calling getFile) when read permission is denied', async () => {
    // Regression: previously getFile() was called directly on a persisted handle
    // with permission 'denied', throwing NotAllowedError out to Vue's global
    // error handler (console.error) instead of a user-facing message.
    const { handle, getFile } = makeFakeHandle({ granted: 'denied' })
    await expect(openFromHandleSource(handle, 'cup.json').pickAndRead()).rejects.toThrowError(
      new OpenFileError('Permission to read "cup.json" was denied — please re-import the file to reopen it.')
    )
    expect(getFile).not.toHaveBeenCalled()
  })
})
