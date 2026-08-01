import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  listRecents,
  recordRecent,
  removeRecent,
  MAX_RECENTS,
  type RecentEntry
} from '@/features/tournament-doc/storage/recents'

// Small helper to space out timestamps (lastModified is ms-resolution).
const tick = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('recents store (IndexedDB) — data layer', () => {
  beforeEach(async () => {
    for (const r of await listRecents()) await removeRecent(r.id)
  })

  it('starts empty', async () => {
    expect(await listRecents()).toEqual([])
  })

  it('persists an entry with name, sourceKind, and lastModified', async () => {
    const entry = await recordRecent({ name: 'Spring Open', sourceKind: 'file' })
    expect(entry.id).toBeTruthy()
    expect(entry.name).toBe('Spring Open')
    expect(entry.sourceKind).toBe('file')
    expect(typeof entry.lastModified).toBe('number')

    const list = await listRecents()
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Spring Open')
  })

  it('upserts by name: re-recording updates lastModified without duplicating', async () => {
    const first = await recordRecent({ name: 'Dup', sourceKind: 'file' })
    await tick(5)
    const second = await recordRecent({ name: 'Dup', sourceKind: 'file' })
    expect(second.lastModified).toBeGreaterThan(first.lastModified)
    expect(await listRecents()).toHaveLength(1)
  })

  it('records sourceKind "downloaded" for upload-fallback opens', async () => {
    const entry = await recordRecent({ name: 'Imported', sourceKind: 'downloaded' })
    expect(entry.sourceKind).toBe('downloaded')
  })

  it('returns the list newest-first', async () => {
    await recordRecent({ name: 'Old', sourceKind: 'file' })
    await tick(5)
    await recordRecent({ name: 'New', sourceKind: 'file' })
    expect((await listRecents()).map((r) => r.name)).toEqual(['New', 'Old'])
  })

  it('removes an entry by id', async () => {
    const entry = await recordRecent({ name: 'Gone', sourceKind: 'file' })
    await removeRecent(entry.id)
    expect(await listRecents()).toEqual([])
  })

  it('prunes oldest beyond MAX_RECENTS (FIFO by lastModified)', async () => {
    for (let i = 0; i < MAX_RECENTS + 3; i++) {
      await recordRecent({ name: `T${i}`, sourceKind: 'file' })
      await tick(2)
    }
    const list = await listRecents()
    expect(list).toHaveLength(MAX_RECENTS)
    // the three oldest (T0, T1, T2) are pruned; the newest survives
    expect(list.find((r) => r.name === 'T0')).toBeUndefined()
    expect(list.find((r) => r.name === 'T2')).toBeUndefined()
    expect(list.find((r) => r.name === `T${MAX_RECENTS + 2}`)).toBeTruthy()
  })
})
