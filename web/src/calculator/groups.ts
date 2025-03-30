import { type Group, Entry, EntryType, EntryEmptyIdx } from '@/types/types'

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

// removePlayerFromAllGroups iterates through all the groups and removes the player
// specified by entryIdx
export function removePlayerFromAllGroups(groups: Array<Group>, entryIdx: number) {
  for (let i = 0; i < groups.length; i++) {
    const grp = groups[i]
    if (!grp || !grp.entriesIdx) {
      continue
    }
    for (let j = 0; j < grp.entriesIdx.length; j++) {
      const idx = grp.entriesIdx[j]
      if (idx === entryIdx) {
        grp.entriesIdx[j] = EntryEmptyIdx
      }
    }
  }
}

export function getGroup(numPlayers: number): Group {
  const group: Group = {
    rounds: [],
    entriesIdx: []
  }
  const entriesIdx: number[] = []
  for (let j = 0; j < numPlayers; j++) {
    entriesIdx.push(EntryEmptyIdx)
    group.entriesIdx = entriesIdx
    group.rounds = []
  }
  return group
}

export function getEmptyPlayer(entryType: EntryType): Entry {
  return new Entry(entryType)
}

export function isPlayerChosen(entryIdx: number, groups: Array<Group>): boolean {
  // Check if the player's index exists in any group's entriesIdx array
  for (const group of groups) {
    if (group.entriesIdx.includes(entryIdx)) {
      return true
    }
  }

  return false
}

export function hasEmptyPlayer(groups: Array<Group>): boolean {
  for (let idx = 0; idx < groups.length; idx++) {
    const grp = groups[idx]
    if (!grp) {
      continue
    }
    for (let j = 0; j < grp.entriesIdx.length; j++) {
      const entryIdx = grp.entriesIdx[j]
      if (entryIdx === EntryEmptyIdx) {
        return true
      }
    }
  }
  return false
}

export function isGroupEmpty(groups: Array<Group>): boolean {
  for (let idx = 0; idx < groups.length; idx++) {
    const grp = groups[idx]
    if (!grp) {
      continue
    }
    for (let j = 0; j < grp.entriesIdx.length; j++) {
      const entryIdx = grp.entriesIdx[j]
      if (entryIdx !== EntryEmptyIdx) {
        return false
      }
    }
  }
  return true
}
