import { openDb } from './db'

// Recent-tournaments metadata store, backed by IndexedDB.
//
// Scope note: this is the DATA layer only. The HomeView UI for listing /
// opening / removing recents is built in Req 5 (open-from-file), where HomeView
// is reconstructed for the full open/recent/new UX — so the UI is not built
// twice. Each recent holds metadata plus an optional File System Access handle
// (used by Req 5 to reopen a file-backed document).

export const MAX_RECENTS = 10

export type RecentSourceKind = 'file' | 'downloaded'

export interface RecentEntry {
  id: string
  name: string
  lastModified: number
  sourceKind: RecentSourceKind
  fileHandle?: FileSystemFileHandle
}

const STORE = 'recents'

// One logical operation per transaction: IndexedDB auto-closes a transaction
// once its request queue drains, so each helper below owns its own transaction.
async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function getAll(): Promise<RecentEntry[]> {
  return withStore('readonly', (s) => s.getAll() as IDBRequest<RecentEntry[]>)
}

function putEntry(entry: RecentEntry): Promise<void> {
  return withStore('readwrite', (s) => s.put(entry) as IDBRequest<IDBValidKey>).then(() => undefined)
}

function deleteEntry(id: string): Promise<void> {
  return withStore('readwrite', (s) => s.delete(id) as IDBRequest<undefined>).then(() => undefined)
}

// List recents newest-first.
export async function listRecents(): Promise<RecentEntry[]> {
  return (await getAll()).sort((a, b) => b.lastModified - a.lastModified)
}

// Record (or update) a recent. Upserts by name — re-opening the same tournament
// refreshes its lastModified instead of duplicating — then prunes oldest beyond
// MAX_RECENTS.
export async function recordRecent(input: {
  name: string
  sourceKind: RecentSourceKind
  fileHandle?: FileSystemFileHandle
}): Promise<RecentEntry> {
  const existing = (await getAll()).find((r) => r.name === input.name)
  const entry: RecentEntry = {
    id: existing?.id ?? crypto.randomUUID(),
    name: input.name,
    lastModified: Date.now(),
    sourceKind: input.sourceKind,
    fileHandle: input.fileHandle ?? existing?.fileHandle
  }

  await putEntry(entry)

  const prunable = (await listRecents()).slice(MAX_RECENTS)
  await Promise.all(prunable.map((old) => deleteEntry(old.id)))

  return entry
}

export async function removeRecent(id: string): Promise<void> {
  await deleteEntry(id)
}
