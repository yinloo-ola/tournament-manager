export type Tournament = {
  name: string
  categories: Array<Category>
}
export type Category = {
  name: string
  playersPerGrpMain: number
  playersPerGrpRemainder: number
  players: Array<Player>
  groups: Array<Array<Player>>
}
export type Player = {
  name: string
  seeding: number | undefined
  club: string | undefined
}
