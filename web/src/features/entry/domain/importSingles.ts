import { EntryType, type Player } from '@/shared/model'

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

const SINGLES_HEADER_LEN = 6 // SN, Name, Club, Seeding, Date Of Birth, Gender
const ENTRIES_SHEET = 'entries'

/**
 * importSinglesEntries is a synchronous port of Go's
 * endpoint/entry/internal/singles.go ImportSinglesEntries.
 *
 * Reads the 'entries' sheet from a pre-parsed workbook (Record<string,
 * string[][]> from readWorkbook), skipping the header row, trimming
 * Name/DOB/Gender, treating Club/Seeding as optional, and producing one
 * EntryLike per data row with entryType 'Singles'.
 *
 * Throws Go-parity error messages:
 *  - "sheet entries does not exist" (missing sheet)
 *  - "failed to parse seeding" (non-integer seeding)
 */
export function importSinglesEntries(workbook: Record<string, string[][]>): EntryLike[] {
  const rows = workbook[ENTRIES_SHEET]
  if (!rows) {
    throw new Error(`sheet ${ENTRIES_SHEET} does not exist`)
  }

  const entries: EntryLike[] = []
  for (const row of rows.slice(1)) {
    if (row.length < SINGLES_HEADER_LEN) {
      continue
    }

    const name = row[1].trim()
    const club = row[2]
    const seedingStr = row[3]
    const dobStr = row[4].trim()
    const gender = row[5].trim()

    let seeding = 0
    if (seedingStr.trim() !== '') {
      seeding = parseSeeding(seedingStr)
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

/**
 * parseSeeding mirrors Go's strconv.Atoi: optional sign + digits only.
 * Rejects whitespace, decimals, and non-numeric strings — matching Go's
 * behavior where Atoi("1.5") and Atoi(" 1 ") both error.
 *
 * Throws "failed to parse seeding" (the Go importer's inner message,
 * dropping the strconv.NumError detail per error-parity decisions).
 */
function parseSeeding(s: string): number {
  if (!/^[+-]?\d+$/.test(s)) {
    throw new Error('failed to parse seeding')
  }
  return parseInt(s, 10)
}