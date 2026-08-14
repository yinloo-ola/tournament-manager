import { EntryType, type Player } from '@/shared/model'
import { parseSeeding } from './parseSeeding'
import type { EntryLike } from './importSingles'

const PLAYERS_SHEET = 'players'
const ENTRIES_SHEET = 'entries'

/**
 * importDoublesEntries is a synchronous port of Go's
 * endpoint/entry/internal/doubles.go ImportDoublesEntries.
 *
 * Reads the 'players' sheet to build a name→Player map, then iterates
 * the 'entries' sheet. Each entry row supplies two player names, which
 * are resolved against the player map. Club and Seeding are optional
 * (Go checks len(row) > 3 and len(row) > 4 respectively).
 *
 * Note: Go trims Club in doubles (unlike singles where Club is untrimmed).
 * Go trims Seeding before Atoi (unlike singles where untrimmed is parsed).
 *
 * Throws Go-parity error messages:
 *  - "sheet players does not exist" (missing players sheet)
 *  - "sheet entries does not exist" (missing entries sheet)
 *  - "player with SN <name> not found in players sheet" (no match)
 *  - "failed to parse seeding" (non-integer seeding)
 */
export function importDoublesEntries(
  workbook: Record<string, string[][]>
): EntryLike[] {
  // ── Build player map from 'players' sheet ──
  const playerRows = workbook[PLAYERS_SHEET]
  if (!playerRows) {
    throw new Error(`sheet ${PLAYERS_SHEET} does not exist`)
  }

  const playerMap = new Map<string, Player>()
  for (const row of playerRows.slice(1)) {
    // readWorkbook trims trailing blanks, so a player with an empty Gender
    // (or DOB) arrives shorter — the Name is still valid and must not be
    // skipped, or the player silently vanishes from the lookup map.
    if (row.length < 2) {
      continue
    }
    const name = row[1].trim()
    const dob = (row[2] ?? '').trim()
    const gender = (row[3] ?? '').trim()

    playerMap.set(name, { name, dateOfBirth: dob, gender })
  }

  // ── Process entries sheet ──
  const entryRows = workbook[ENTRIES_SHEET]
  if (!entryRows) {
    throw new Error(`sheet ${ENTRIES_SHEET} does not exist`)
  }

  const entries: EntryLike[] = []
  for (const row of entryRows.slice(1)) {
    if (row.length < 3) {
      continue
    }

    const player1Name = row[1].trim()
    const player2Name = row[2].trim()

    let club = ''
    let seeding = 0
    if (row.length > 3) {
      club = row[3].trim()
    }
    if (row.length > 4) {
      const seedingStr = row[4].trim()
      if (seedingStr !== '') {
        seeding = parseSeeding(seedingStr)
      }
    }

    // Resolve players by name from the player map
    const player1 = playerMap.get(player1Name)
    if (!player1) {
      throw new Error(
        `player with SN ${player1Name} not found in players sheet`
      )
    }
    const player2 = playerMap.get(player2Name)
    if (!player2) {
      throw new Error(
        `player with SN ${player2Name} not found in players sheet`
      )
    }

    const entry: EntryLike = {
      entryType: EntryType.Doubles,
      ...(seeding !== 0 ? { seeding } : {}),
      ...(club !== '' ? { club } : {}),
      singlesEntry: null,
      doublesEntry: {
        players: [player1, player2] as [Player, Player]
      },
      teamEntry: null
    }
    entries.push(entry)
  }

  return entries
}