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

// TODO: This function needs to be updated to work with the category entries array
// to properly find and remove entries by index
export function removePlayerFromAllGroups(groups: Array<Group>) {
  for (let i = 0; i < groups.length; i++) {
    const grp = groups[i]
    if (!grp || !grp.entriesIdx) {
      continue
    }
    for (let j = 0; j < grp.entriesIdx.length; j++) {
      const entryIdx = grp.entriesIdx[j]
      // We need to find the actual entry from the category entries array
      // This would require access to the category object which isn't available here
      // For now, we'll just set the index to EntryEmptyIdx
      if (entryIdx !== EntryEmptyIdx) {
        // In the real implementation, you'd need to check if this entry matches the one to remove
        grp.entriesIdx[j] = EntryEmptyIdx
      }
    }
  }
}

export function getGroup(entryType: EntryType, numPlayers: number): Group {
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

export function isSameEntry(p1: Entry, p2: Entry): boolean {
  if (p1.name === p2.name && p1.club === p2.club && p1.seeding === p2.seeding) {
    return true
  }
  return false
}

export function isPlayerChosen(p: Entry, groups: Array<Group>, categoryEntries: Array<Entry>): boolean {
  for (let idx = 0; idx < groups.length; idx++) {
    const grp = groups[idx]
    if (!grp || !grp.entriesIdx) {
      continue
    }
    for (let j = 0; j < grp.entriesIdx.length; j++) {
      const entryIdx = grp.entriesIdx[j]
      if (entryIdx >= 0 && entryIdx < categoryEntries.length) {
        const player = categoryEntries[entryIdx]
        if (isSameEntry(player, p)) {
          return true
        }
      }
    }
  }
  return false
}

export function hasEmptyPlayer(groups: Array<Group>): boolean {
  for (let idx = 0; idx < groups.length; idx++) {
    const grp = groups[idx]
    if (!grp || !grp.entriesIdx) {
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
    if (!grp || !grp.entriesIdx) {
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
