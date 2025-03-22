export type Tournament = {
  name: string
  numTables: number
  startTime: string
  categories: Array<Category>
}

export type Category = {
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
}

export enum EntryType {
  Unknown = 'Unknown',
  Singles = 'Singles',
  Doubles = 'Doubles',
  Team = 'Team'
}
export interface SinglesEntry {
  player: Player
}

export interface DoublesEntry {
  players: [Player, Player]
}

export interface TeamEntry {
  teamName: string
  players: Player[]
  minPlayers: number
  maxPlayers: number
}

export class Entry {
  constructor(
    public entryType: EntryType,
    public seeding?: number,
    public club?: string,
    public singleEntry?: SinglesEntry,
    public doubleEntry?: DoublesEntry,
    public teamEntry?: TeamEntry
  ) {}

  get name(): string {
    switch (this.entryType) {
      case EntryType.Singles:
        return this.singleEntry!.player.name
      case EntryType.Doubles:
        return `${this.doubleEntry!.players[0].name} / ${this.doubleEntry!.players[1].name}`
      case EntryType.Team:
        return this.teamEntry!.teamName
      default:
        throw new Error(`Invalid entry type: ${this.entryType}`)
    }
  }
}

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
