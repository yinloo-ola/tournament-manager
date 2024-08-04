export type Tournament = {
  name: string
  numTables: number
  startTime: string
  categories: Array<Category>
}
export type Category = {
  name: string
  shortName: string
  playersPerGrpMain: number
  playersPerGrpRemainder: number
  players: Array<Player>
  groups: Array<Group>
  durationMinutes: number
}
export type Player = {
  name: string
  seeding: number | undefined
  club: string | undefined
}
export type Match = {
  player1: Player
  player2: Player
  datetime: string
  table: string
  durationMinutes: number
}
export type Group = {
  players: Array<Player>
  rounds: Array<Array<Match>>
}
