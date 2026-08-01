import { ref, shallowRef } from 'vue'
import { EntryType, type Tournament } from '@/shared/model'
import { getDateStringFromNow } from '@/calculator/date'

// The active tournament document. This is the drop-in successor to the old
// store/state.ts `tournament` ref (same shape), so existing feature components
// keep working. Later requirements add file backing and autosave underneath.
export const tournament = ref<Tournament>(newTournament())

// The File System Access handle of the file the active document was opened from
// (null for a new/uploaded document). Used by save to write in place. shallowRef:
// the handle is an opaque browser object that must not be deep-reactified.
export const currentFileHandle = shallowRef<FileSystemFileHandle | null>(null)

// Create a fresh, empty tournament with sensible defaults (matches the
// defaults the app has always started with).
export function newTournament(): Tournament {
  return {
    name: '',
    numTables: 0,
    startTime: getDateStringFromNow(7, 9),
    categories: [
      {
        name: '',
        entryType: EntryType.Singles,
        shortName: '',
        entriesPerGrpMain: 3,
        entriesPerGrpRemainder: 4,
        entries: [],
        groups: [],
        durationMinutes: 0,
        knockoutRounds: [],
        numQualifiedPerGroup: 0
      }
    ]
  }
}
