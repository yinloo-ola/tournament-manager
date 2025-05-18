// Constants matching the Go model
export const EntryByeIdx = -2
export const EntryEmptyIdx = -1

export type Tournament = {
  id: number
  name: string
  numTables: number
  startTime: string // Format: "2006-01-02T15:04"
  categories: Array<Category>
}

export type Category = {
  id: number
  tournamentID: number
  name: string
  entryType: EntryType
  shortName: string
  entriesPerGrpMain: number
  entriesPerGrpRemainder: number
  entries: Array<Entry>
  groups: Array<Group>
  knockoutRounds: Array<KnockoutRound>
  durationMinutes: number
  numQualifiedPerGroup: number
  minPlayers?: number
  maxPlayers?: number
  lineup?: Array<LineupItem>
}

export enum EntryType {
  Unknown = 'Unknown',
  Singles = 'Singles',
  Doubles = 'Doubles',
  Team = 'Team'
}

export interface Entry {
  id: number
  categoryID: number
  entryType: EntryType
  name: string
  seeding?: number
  club?: string
  players?: Player[]
  minPlayersPerTeam?: number
  maxPlayersPerTeam?: number
}

export type Player = {
  id: number
  name: string
  dateOfBirth: string // yyyy-mm-dd
  gender: string // M or F
}

export type Group = {
  id: number
  tournamentID: number
  categoryID: number
  entriesIdx: number[]
  rounds: Array<Array<Match>>
}

export type Match = {
  entry1Idx: number
  entry2Idx: number
  datetime: string
  durationMinutes: number
  table: string
  categoryShortName?: string
  groupIdx?: number
  roundIdx?: number
  round?: number
  matchIdx?: number
}

export type KnockoutRound = {
  round: number
  matches: Array<Match>
}

export type LineupItem = {
  name: string
  matchType: EntryType
  genderRequirement: 'M' | 'F' | 'Mixed' | 'Any'
  ageRequirement?: {
    type: 'minimum' | 'maximum'
    value: number
  }
}
