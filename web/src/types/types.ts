export type Tournament = {
  name: string
  numTables: number
  startTime: string
  categories: Array<Category>
}
export type Category = {
  name: string
  shortName: string
  entriesPerGrpMain: number
  entriesPerGrpRemainder: number
  entries: Array<Entry>
  groups: Array<Group>
  knockoutRounds: Array<KnockoutRound>
  durationMinutes: number
  numQualifiedPerGroup: number
}
/**
 * Represents the type of tournament entry
 */
export enum EntryType {
  Singles = 'Singles',
  Doubles = 'Doubles',
  Team = 'Team',
}

interface BaseEntry {
  entryType: EntryType
  name: string
  seeding?: number
  club?: string
}

export interface SinglesEntry extends BaseEntry {
  entryType: EntryType.Singles
  player: Player
}

export interface DoublesEntry extends BaseEntry {
  entryType: EntryType.Doubles
  players: [Player, Player]
}

export interface TeamEntry extends BaseEntry {
  entryType: EntryType.Team
  players: Player[]
  minPlayers: number
  maxPlayers: number
}

export type Entry = SinglesEntry | DoublesEntry | TeamEntry

export type Match = {
  entry1: Entry
  entry2: Entry
  datetime: string
  table: string
  durationMinutes: number
  round?: number
}
export type Group = {
  entries: Array<Entry>
  rounds: Array<Array<Match>>
}
export type KnockoutRound = {
  round: number
  matches: Array<Match>
}
export type Player = {
  name: string
  dateOfBirth: string // yyyy-mm-dd
  gender: string // M or F
}