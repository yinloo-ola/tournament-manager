import { EntryType } from '@/shared/model'

/**
 * The entry-import workbook layouts, per entry type — the single source the
 * pre-validator checks against and the round-trip test pins the Entry Template
 * assets to. Header labels are compared trimmed + case-insensitively; column
 * ORDER is positional and load-bearing (the importers read by index).
 */

export interface SheetLayout {
  sheet: string
  headers: string[]
}

export const ENTRIES_SHEET = 'entries'
export const PLAYERS_SHEET = 'players'

const SINGLES_ENTRIES_HEADERS = [
  'SN',
  'Name',
  'Club',
  'Seeding',
  'Date Of Birth',
  'Gender'
]

const DOUBLES_ENTRIES_HEADERS = ['SN', 'Player1', 'Player2', 'Club', 'Seeding']
const DOUBLES_PLAYERS_HEADERS = ['SN', 'Name', 'Date Of Birth', 'Gender']

const TEAM_ENTRIES_HEADERS = ['SN', 'Team', 'Club', 'Seeding', 'Manager Email']
const TEAM_PLAYERS_HEADERS = ['SN', 'Name', 'Date Of Birth', 'Gender', 'Team']

export function layoutFor(entryType: EntryType): SheetLayout[] {
  switch (entryType) {
    case EntryType.Singles:
      return [{ sheet: ENTRIES_SHEET, headers: SINGLES_ENTRIES_HEADERS }]
    case EntryType.Doubles:
      return [
        { sheet: PLAYERS_SHEET, headers: DOUBLES_PLAYERS_HEADERS },
        { sheet: ENTRIES_SHEET, headers: DOUBLES_ENTRIES_HEADERS }
      ]
    case EntryType.Team:
      return [
        { sheet: PLAYERS_SHEET, headers: TEAM_PLAYERS_HEADERS },
        { sheet: ENTRIES_SHEET, headers: TEAM_ENTRIES_HEADERS }
      ]
    case EntryType.Unknown:
      return []
  }
}
