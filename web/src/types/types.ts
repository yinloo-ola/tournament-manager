export type Tournament = {
  name: string
  categories: Array<Category>
}
export type Category = {
  name: string
  shortName: string
  playersPerGrpMain: number
  playersPerGrpRemainder: number
  players: Array<Player>
  groups: Array<Group>
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
}
export type Group = {
  players: Array<Player>
  matches: Array<Match>
}
