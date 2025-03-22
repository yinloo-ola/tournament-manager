import { type Group, Entry, EntryType } from '@/types/types'

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

export function removePlayerFromAllGroups(groups: Array<Group>, entry: Entry) {
  for (let i = 0; i < groups.length; i++) {
    const grp = groups[i]
    if (!grp || !grp.entries) {
      continue
    }
    for (let j = 0; j < grp.entries.length; j++) {
      const p = grp.entries[j]
      if (isSameEntry(p, entry)) {
        grp.entries[j] = getEmptyPlayer()
      }
    }
  }
}

export function getGroup(numPlayers: number): Group {
  const group: Group = {
    rounds: [],
    entries: []
  }
  const entries: Array<Entry> = []
  for (let j = 0; j < numPlayers; j++) {
    entries.push(getEmptyPlayer())
    group.entries = entries
    group.rounds = []
  }
  return group
}

export function getEmptyPlayer(entryType: EntryType = EntryType.Unknown): Entry {
  return new Entry(entryType)
}

export function isSameEntry(p1: Entry, p2: Entry): boolean {
  if (p1.name === p2.name && p1.club === p2.club && p1.seeding === p2.seeding) {
    return true
  }
  return false
}

export function isPlayerChosen(p: Entry, groups: Array<Group>): boolean {
  for (let idx = 0; idx < groups.length; idx++) {
    const grp = groups[idx]
    if (!grp || !grp.entries) {
      continue
    }
    for (let j = 0; j < grp.entries.length; j++) {
      const player = grp.entries[j]
      if (isSameEntry(player, p)) {
        return true
      }
    }
  }
  return false
}

export function hasEmptyPlayer(groups: Array<Group>): boolean {
  for (let idx = 0; idx < groups.length; idx++) {
    const grp = groups[idx]
    if (!grp || !grp.entries) {
      continue
    }
    for (let j = 0; j < grp.entries.length; j++) {
      const player = grp.entries[j]
      if (player.name.length === 0) {
        return true
      }
    }
  }
  return false
}

export function isGroupEmpty(groups: Array<Group>): boolean {
  for (let idx = 0; idx < groups.length; idx++) {
    const grp = groups[idx]
    if (!grp || !grp.entries) {
      continue
    }
    for (let j = 0; j < grp.entries.length; j++) {
      const player = grp.entries[j]
      if (player.name.length > 0) {
        return false
      }
    }
  }
  return true
}
