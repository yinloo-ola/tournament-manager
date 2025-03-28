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
  minPlayers?: number
  maxPlayers?: number
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
  static from(json: any): Entry {
    return Object.assign(new Entry(json.entryType), json)
  }
  constructor(
    public entryType: EntryType,
    public seeding?: number,
    public club?: string,
    public singlesEntry?: SinglesEntry,
    public doublesEntry?: DoublesEntry,
    public teamEntry?: TeamEntry
  ) {
    switch (this.entryType) {
      case EntryType.Singles:
        this.singlesEntry = { player: { name: '', dateOfBirth: '', gender: '' } }
        break
      case EntryType.Doubles:
        this.doublesEntry = { players: [{ name: '', dateOfBirth: '', gender: '' }, { name: '', dateOfBirth: '', gender: '' }] }
        break
      case EntryType.Team:
        this.teamEntry = { teamName: '', players: [{ name: '', dateOfBirth: '', gender: '' }], minPlayers: 0, maxPlayers: 0 }
        break
    }
  }

  get name(): string {
    switch (this.entryType) {
      case EntryType.Singles:
        if (!this.singlesEntry) {
          return ''
        }
        return this.singlesEntry!.player.name
      case EntryType.Doubles:
        if (!this.doublesEntry) {
          return ''
        }
        return `${this.doublesEntry!.players[0].name} / ${this.doublesEntry!.players[1].name}`
      case EntryType.Team:
        if (!this.teamEntry) {
          return ''
        }
        return this.teamEntry!.teamName
      default:
        return ''
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
