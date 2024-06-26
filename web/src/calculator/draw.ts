import type { Player } from '@/types/types'
import { forEachChild } from 'typescript'

export function doDraw(
  groups: Array<Array<Player>>,
  seededPlayers: Array<Player>,
  otherPlayers: Array<Player>
) {
  groups[0][0] = seededPlayers[0]
  console.debug('implement auto draw', seededPlayers.length, otherPlayers.length)
}
