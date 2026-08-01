import { watch, type Ref } from 'vue'
import { parse, serialize, type Tournament } from '@/shared/model'
import { openDb } from './db'

// Crash-recovery autosave: a debounced deep watcher persists the active
// tournament to IndexedDB so a refresh/crash never loses unsaved work. This is
// a SAFETY NET only — explicit file save (Req 6) remains the user's
// authoritative action. Write failures never throw into the UI (onWarning sink).

const STORE = 'autosave'
const KEY = 'latest'
export const AUTOSAVE_DEBOUNCE_MS = 1000

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveAutosave(tournament: Tournament): Promise<void> {
  await withStore('readwrite', (s) => s.put(serialize(tournament), KEY) as IDBRequest<IDBValidKey>).then(
    () => undefined
  )
}

export async function loadAutosave(): Promise<Tournament | null> {
  const raw = await withStore<string | undefined>('readonly', (s) => s.get(KEY) as IDBRequest<string | undefined>)
  return raw == null ? null : parse(raw)
}

export async function clearAutosave(): Promise<void> {
  await withStore('readwrite', (s) => s.delete(KEY) as IDBRequest<undefined>).then(() => undefined)
}

export interface AutosaveWatchOptions {
  debounceMs?: number
  write?: (t: Tournament) => Promise<void>
  onWarning?: (error: unknown) => void
}

// Start a debounced deep watcher that persists the tournament on every change.
// Returns a stop function. `write` and `onWarning` are injectable for testing.
export function startAutosaveWatch(tournament: Ref<Tournament>, opts: AutosaveWatchOptions = {}): () => void {
  const debounceMs = opts.debounceMs ?? AUTOSAVE_DEBOUNCE_MS
  const write = opts.write ?? saveAutosave
  const onWarning = opts.onWarning ?? ((error: unknown) => console.warn('autosave write failed', error))
  let timer: ReturnType<typeof setTimeout> | null = null

  const stopWatch = watch(
    tournament,
    () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        write(tournament.value).catch(onWarning)
      }, debounceMs)
    },
    { deep: true }
  )

  return () => {
    stopWatch()
    if (timer) clearTimeout(timer)
  }
}
