import { EntryType, type Player } from '@/shared/model'
import { parseSeedingWithRow } from './parseSeeding'
import { ENTRIES_SHEET } from './entryLayout'

/**
 * EntryLike is the plain Entry-shaped object produced by importers.
 *
 * It mirrors the Go model.Entry JSON contract (the old res.json() shape):
 * field order is entryType, seeding?, club?, singlesEntry, doublesEntry,
 * teamEntry. The entry-type-specific field is set; the other two are null
 * (Go has no omitempty on these fields). seeding and club are omitted when
 * zero/empty (Go pointer.OrNil + omitempty).
 *
 * TournamentView.playersImported rehydrates via Entry.from(obj), which
 * Object.assigns these properties onto a new Entry instance.
 */
export type EntryLike = {
  entryType: EntryType
  seeding?: number
  club?: string
  singlesEntry?: { player: Player } | null
  doublesEntry?: { players: [Player, Player] } | null
  teamEntry?: {
    teamName: string
    players: Player[]
    minPlayers: number
    maxPlayers: number
  } | null
}


/**
 * importSinglesEntries is a synchronous port of Go's
 * endpoint/entry/internal/singles.go ImportSinglesEntries.
 *
 * Reads the 'entries' sheet from a pre-parsed workbook (Record<string,
 * string[][]> from readWorkbook), skipping the header row, trimming
 * Name/DOB/Gender, treating Club/Seeding as optional, and producing one
 * EntryLike per data row with entryType 'Singles'.
 *
 * Throws the plain-language message contract (row numbers count the header
 * as Excel row 1):
 *  - "Row N: Seeding 'X' isn't a whole number."
 *
 * The sheet-existence throw remains a Go-parity internal invariant — the
 * readEntryWorkbook pre-validation normally delivers the user-facing
 * "Missing sheet …" message before an importer runs.
 */
export function importSinglesEntries(workbook: Record<string, string[][]>): EntryLike[] {
  const rows = workbook[ENTRIES_SHEET]
  if (!rows) {
    throw new Error(`sheet ${ENTRIES_SHEET} does not exist`)
  }

  const entries: EntryLike[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 1

    // readWorkbook trims trailing blank cells, so rows missing trailing
    // optionals (DOB, Gender) arrive shorter than the header — the Name is
    // still valid and must not be skipped.
    if (row.length < 2) {
      continue
    }

    const name = row[1].trim()
    const club = row[2] ?? ''
    const seedingStr = row[3] ?? ''
    const dobStr = (row[4] ?? '').trim()
    const gender = (row[5] ?? '').trim()

    let seeding = 0
    if (seedingStr.trim() !== '') {
      seeding = parseSeedingWithRow(seedingStr, rowNum)
    }

    const entry: EntryLike = {
      entryType: EntryType.Singles,
      ...(seeding !== 0 ? { seeding } : {}),
      ...(club !== '' ? { club } : {}),
      singlesEntry: {
        player: { name, dateOfBirth: dobStr, gender }
      },
      doublesEntry: null,
      teamEntry: null
    }
    entries.push(entry)
  }

  return entries
}

