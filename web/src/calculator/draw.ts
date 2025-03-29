import type { Group, Match, Entry, EntryType } from '@/types/types'
import { EntryEmptyIdx } from '@/types/types'
import { hasEmptyPlayer } from './groups'

export async function doDraw(
  groups: Array<Group>,
  seededPlayers: Array<Entry>,
  otherPlayers: Array<Entry>,
  sleepDur: number
) {
  const maxPos = Math.max(...groups.map((grp) => grp.entriesIdx.length))
  const randSeededPlayers = seededPlayers.map((p) => {
    const r = Math.random()
    const w = p.seeding! + r
    return {
      player: p,
      weight: w
    }
  })
  const randOtherPlayers = otherPlayers.map((p) => {
    const r = Math.random()
    return {
      player: p,
      weight: r
    }
  })
  randSeededPlayers.sort((p1, p2) => {
    return p2.weight - p1.weight
  })
  randOtherPlayers.sort((p1, p2) => {
    return p1.weight - p2.weight
  })
  const allPlayers = randOtherPlayers.concat(randSeededPlayers)
  const groupsClubs: { [key: number]: { [key: string]: boolean } } = {}

  for (let pos = 0; pos < maxPos; pos++) {
    if (pos % 2 === 0) {
      for (let j = 0; j < groups.length; j++) {
        if (groups[j].entriesIdx[pos] === undefined || groups[j].entriesIdx[pos] === EntryEmptyIdx) {
          continue
        }
        drawPlayerForGrpPos(groups, j, pos, allPlayers, groupsClubs)
        await new Promise((r) => setTimeout(r, sleepDur))
      }
    } else {
      for (let j = groups.length - 1; j >= 0; j--) {
        if (groups[j].entriesIdx[pos] === undefined || groups[j].entriesIdx[pos] === EntryEmptyIdx) {
          continue
        }
        drawPlayerForGrpPos(groups, j, pos, allPlayers, groupsClubs)
        await new Promise((r) => setTimeout(r, sleepDur))
      }
    }
  }

  if (allPlayers.length !== 0) {
    throw new Error('Something is wrong. Some players are not drawn!!!')
  }
  if (hasEmptyPlayer(groups)) {
    throw new Error('Something is wrong. Some positions are still empty!!!')
  }
}

function drawPlayerForGrpPos(
  groups: Array<Group>,
  j: number,
  pos: number,
  allPlayers: { player: Entry; weight: number }[],
  groupsClubs: { [key: number]: { [key: string]: boolean } }
) {
  if (allPlayers.length === 0) {
    // throw 'Something is wrong with the players list'
    return
  }
  if (!groupsClubs[j]) {
    groupsClubs[j] = {}
  }
  const player = allPlayers[allPlayers.length - 1]
  if (!groupsClubs[j][player.player.club ?? '']) {
    const poppedPlayer = allPlayers.pop()!.player
    // Find the index of this player in the entries array
    const entryIndex = groups[j].entriesIdx[pos]
    groups[j].entriesIdx[pos] = entryIndex // Update the index reference
    
    if (poppedPlayer.club) {
      groupsClubs[j][poppedPlayer.club!] = true
    }
  } else {
    let found = false
    for (let p = allPlayers.length - 1; p >= 0; p--) {
      if (!groupsClubs[j][allPlayers[p].player.club ?? '']) {
        const splicedPlayer = allPlayers.splice(p, 1)[0].player
        // Find the index of this player in the entries array
        const entryIndex = groups[j].entriesIdx[pos]
        groups[j].entriesIdx[pos] = entryIndex // Update the index reference
        
        if (splicedPlayer.club) {
          groupsClubs[j][splicedPlayer.club!] = true
        }
        found = true
        break
      }
    }
    if (!found) {
      const poppedPlayer = allPlayers.pop()!.player
      // Find the index of this player in the entries array
      const entryIndex = groups[j].entriesIdx[pos]
      groups[j].entriesIdx[pos] = entryIndex // Update the index reference
      
      if (poppedPlayer.club) {
        groupsClubs[j][poppedPlayer.club!] = true
      }
    }
  }
}

export function clearDraw(entryType: EntryType, groups: Array<Group>) {
  for (let i = 0; i < groups.length; i++) {
    const grp = groups[i]
    clearRound(entryType, grp.rounds)
    for (let j = 0; j < grp.entriesIdx.length; j++) {
      grp.entriesIdx[j] = EntryEmptyIdx // Use the empty index constant
    }
  }
}

function clearRound(entryType: EntryType, rounds: Match[][]) {
  for (let i = 0; i < rounds.length; i++) {
    const round = rounds[i]
    for (let j = 0; j < round.length; j++) {
      round[j].entry1Idx = EntryEmptyIdx // Use the empty index constant
      round[j].entry2Idx = EntryEmptyIdx // Use the empty index constant
    }
  }
}
