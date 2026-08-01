// Shared IndexedDB connection for the tournament-doc storage layer.
// Centralizing schema/version + the request helper here avoids two modules
// racing on the same DB version and keeps the store names in one place.

export const STORES = {
  recents: 'recents',
  autosave: 'autosave'
} as const
export type StoreName = (typeof STORES)[keyof typeof STORES]

const DB_NAME = 'tournament-manager'
// v2: adds the 'autosave' store. (v1 created only 'recents'.)
const DB_VERSION = 2

let dbPromise: Promise<IDBDatabase> | null = null

export function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORES.recents)) {
          db.createObjectStore(STORES.recents, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(STORES.autosave)) {
          db.createObjectStore(STORES.autosave) // out-of-line keys (single 'latest' record)
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

// One logical operation per transaction: IndexedDB auto-closes a transaction
// once its request queue drains, so each call owns its own transaction.
export async function withStore<T>(
  mode: IDBTransactionMode,
  store: StoreName,
  fn: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const req = fn(tx.objectStore(store))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
