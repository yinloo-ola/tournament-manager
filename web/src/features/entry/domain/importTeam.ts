import { EntryType, type Player } from '@/shared/model'
import { parseSeedingWithRow } from './parseSeeding'
import { ENTRIES_SHEET, PLAYERS_SHEET } from './entryLayout'
import type { EntryLike } from './importSingles'

/**
 * importTeamEntries is a synchronous port of Go's
 * endpoint/entry/internal/team.go ImportTeamEntries.
 *
 * Reads the 'players' sheet to build a team→Player[] map (keyed by team
 * name in column 4), then iterates the 'entries' sheet. Each entry row
 * supplies a team name, which is resolved against the player map. Club
 * and Seeding are optional (missing trailing cells are treated as empty).
 *
 * Note: the team entries sheet layout differs from doubles — Club is at
 * column 2 and Seeding at column 3 (not 3 and 4 as in doubles).
 *
 * Throws the plain-language message contract (row numbers count the header
 * as Excel row 1):
 *  - "Player 'X' appears twice for team 'T'." (same name under one team)
 *  - "Row N: Team 'T' isn't in the 'players' sheet."
 *  - "Team 'T' has N players — allowed: min to max."
 *  - "Row N: Seeding 'X' isn't a whole number."
 *
 * The sheet-existence throws remain Go-parity internal invariants — the
 * readEntryWorkbook pre-validation normally delivers the user-facing
 * "Missing sheet …" messages before an importer runs.
 */
export function importTeamEntries(
  workbook: Record<string, string[][]>,
  minPlayers: number,
  maxPlayers: number
): EntryLike[] {
  // ── Build team→players map from 'players' sheet ──
  const playerRows = workbook[PLAYERS_SHEET]
  if (!playerRows) {
    throw new Error(`sheet ${PLAYERS_SHEET} does not exist`)
  }

  const teamMap = new Map<string, Player[]>()
  for (const row of playerRows.slice(1)) {
    // readWorkbook trims trailing blanks, so a player with an empty Gender
    // (or DOB) arrives shorter — the Name is still valid and must not be
    // skipped, or the player silently vanishes from the team map.
    if (row.length < 2) {
      continue
    }
    const name = row[1].trim()
    const dob = (row[2] ?? '').trim()
    const gender = (row[3] ?? '').trim()
    const team = (row[4] ?? '').trim()

    const players = teamMap.get(team)
    if (players) {
      // Names identify players within a team — a duplicate would silently
      // inflate the roster (and player counts feed the min/max check).
      if (players.some((player) => player.name === name)) {
        throw new Error(
          `Player '${name}' appears twice for team '${team}'.`
        )
      }
      players.push({ name, dateOfBirth: dob, gender })
    } else {
      teamMap.set(team, [{ name, dateOfBirth: dob, gender }])
    }
  }

  // ── Process entries sheet ──
  const entryRows = workbook[ENTRIES_SHEET]
  if (!entryRows) {
    throw new Error(`sheet ${ENTRIES_SHEET} does not exist`)
  }

  const entries: EntryLike[] = []
  for (let i = 1; i < entryRows.length; i++) {
    const row = entryRows[i]
    const rowNum = i + 1

    // readWorkbook trims trailing blank cells, so a row with only SN + Team
    // (no Club, no Seeding) arrives as length 2 — the team name is still
    // valid and must not be skipped.
    if (row.length < 2) {
      continue
    }

    const teamName = row[1].trim()
    let club = ''
    let seeding = 0
    club = (row[2] ?? '').trim()
    const seedingStr = (row[3] ?? '').trim()
    if (seedingStr !== '') {
      seeding = parseSeedingWithRow(seedingStr, rowNum)
    }

    // Resolve team players from the map
    const players = teamMap.get(teamName)
    if (!players) {
      throw new Error(
        `Row ${rowNum}: Team '${teamName}' isn't in the 'players' sheet.`
      )
    }

    // Validate player count
    if (players.length < minPlayers || players.length > maxPlayers) {
      throw new Error(
        `Team '${teamName}' has ${players.length} players — allowed: ${minPlayers} to ${maxPlayers}.`
      )
    }

    const entry: EntryLike = {
      entryType: EntryType.Team,
      ...(seeding !== 0 ? { seeding } : {}),
      ...(club !== '' ? { club } : {}),
      singlesEntry: null,
      doublesEntry: null,
      teamEntry: {
        teamName,
        players,
        minPlayers,
        maxPlayers
      }
    }
    entries.push(entry)
  }

  return entries
}