// Shared IndexedDB connection for the tournament-doc storage layer.
// Centralizing schema/version here avoids two modules racing on the same DB's
// version (which would either drop a store or throw a VersionError).
const DB_NAME = 'tournament-manager'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

export function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('recents')) {
          db.createObjectStore('recents', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('autosave')) {
          db.createObjectStore('autosave') // out-of-line keys (single 'latest' record)
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}
