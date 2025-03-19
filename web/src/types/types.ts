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
export type Entry = {
  name: string
  seeding: number | undefined
  club: string | undefined
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
