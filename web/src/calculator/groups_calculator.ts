import type { Player } from '@/types/types'

export function calculatorGroups(
  playersCount: number,
  playersPerGrpMain: number,
  playersPerGrpRemainder: number
) {
  const isAdd = playersPerGrpMain < playersPerGrpRemainder
  if (isAdd) {
    const remainder = playersCount % playersPerGrpMain
    return {
      numGroupsMain: Math.floor(playersCount / playersPerGrpMain) - remainder,
      numGroupsRemainder: remainder
    }
  } else {
    const grps = Math.ceil(playersCount / playersPerGrpMain)
    const remainder = grps * playersPerGrpMain - playersCount
    return {
      numGroupsMain: grps - remainder,
      numGroupsRemainder: remainder
    }
  }
}

export function removePlayerFromAllGroups(groups: Array<Array<Player>>, player: Player) {
  for (let i = 0; i < groups.length; i++) {
    const grp = groups[i]
    for (let j = 0; j < grp.length; j++) {
      const p = grp[j]
      if (isSamePlayer(p, player)) {
        grp[j] = getEmptyPlayer()
      }
    }
  }
}

export function getGroup(numPlayers: number) {
  const players: Array<Player> = []
  for (let j = 0; j < numPlayers; j++) {
    players.push(getEmptyPlayer())
  }
  return players
}

export function getEmptyPlayer(): Player {
  return {
    name: '',
    club: undefined,
    seeding: undefined
  }
}

export function isSamePlayer(p1: Player, p2: Player): boolean {
  if (p1.name === p2.name && p1.club === p2.club && p1.seeding === p2.seeding) {
    return true
  }
  return false
}
