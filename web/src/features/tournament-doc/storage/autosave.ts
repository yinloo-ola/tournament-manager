import { watch, type Ref } from 'vue'
import { parse, serialize, type Tournament } from '@/shared/model'
import { STORES, withStore } from './db'

// Crash-recovery autosave: a debounced deep watcher persists the active
// tournament to IndexedDB so a refresh/crash never loses unsaved work. This is
// a SAFETY NET only — explicit file save (Req 6) remains the user's
// authoritative action. Write failures never throw into the UI (onWarning sink).

const KEY = 'latest'
export const AUTOSAVE_DEBOUNCE_MS = 1000

export async function saveAutosave(tournament: Tournament): Promise<void> {
  await withStore('readwrite', STORES.autosave, (s) =>
    s.put(serialize(tournament), KEY) as IDBRequest<IDBValidKey>
  )
}

export async function loadAutosave(): Promise<Tournament | null> {
  const raw = await withStore<string | undefined>('readonly', STORES.autosave, (s) =>
    s.get(KEY) as IDBRequest<string | undefined>
  )
  return raw == null ? null : parse(raw)
}

export async function clearAutosave(): Promise<void> {
  await withStore('readwrite', STORES.autosave, (s) => s.delete(KEY) as IDBRequest<undefined>)
}

// Restore the most recent autosaved state into the given ref on reopen/boot.
// Never throws: a corrupt/unparseable record self-heals (cleared) and the
// default document is left intact. Returns whether a state was restored.
export async function resumeFromAutosave(tournament: Ref<Tournament>): Promise<boolean> {
  try {
    const saved = await loadAutosave()
    if (saved) {
      tournament.value = saved
      return true
    }
    return false
  } catch (error) {
    // Poison record (corrupt bytes / incompatible old build): clear it so the
    // app doesn't re-fail on every launch. Keep the default document.
    console.warn('autosave restore failed; clearing corrupt record', error)
    await clearAutosave().catch(() => undefined)
    return false
  }
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
