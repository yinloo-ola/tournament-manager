import type { Player } from '@/types/types'

export function getPlayerDisplay(player: Player) {
  let s = player.name
  if (player.seeding) {
    s = player.seeding + '. ' + s
  }
  if (player.club) {
    s = s + ' (' + player.club + ')'
  }
  return s
}
