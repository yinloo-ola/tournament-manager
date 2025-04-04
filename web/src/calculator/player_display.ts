import { Entry } from '@/types/types'

export function getPlayerDisplay(player: Entry) {
  // if type of player is not Entry class, convert it to Entry class
  if (!(player instanceof Entry)) {
    player = Entry.from(player)
  }
  let s = player.name
  if (player.seeding) {
    s = '#' + player.seeding + ' ' + s
  }
  if (player.club) {
    s = s + ' (' + player.club + ')'
  }
  return s
}
