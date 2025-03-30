import type { Group, Match, Entry, EntryType } from '@/types/types'
import { EntryEmptyIdx } from '@/types/types'
import { hasEmptyPlayer } from './groups'

/**
 * This file contains functions for tournament draw operations.
 * It handles the automatic assignment of players to tournament groups
 * while respecting seeding and club separation rules.
 */

/**
 * Performs an automatic draw of players into tournament groups.
 *
 * This function takes seeded and non-seeded players and assigns them to positions
 * in tournament groups. It tries to distribute players fairly while respecting seeding
 * and avoiding players from the same club being in the same group when possible.
 *
 * The algorithm works as follows:
 * 1. Assigns random weights to players (seeded players get higher weights)
 * 2. Sorts players by their weights
 * 3. Processes positions in groups in a zigzag pattern (even positions: top to bottom, odd: bottom to top)
 * 4. For each position, tries to assign a player while avoiding club conflicts
 *
 * @param groups - Array of tournament groups where players will be placed
 * @param seededPlayers - Players with seeding priority, including their indices in the original entries array
 * @param otherPlayers - Players without seeding, including their indices in the original entries array
 * @param sleepDur - Delay in milliseconds between operations (for animation purposes)
 * @throws Error if not all players are assigned or if positions remain empty
 */
export async function doDraw(
  groups: Array<Group>,
  seededPlayers: Array<{ player: Entry; entryIdx: number }>,
  otherPlayers: Array<{ player: Entry; entryIdx: number }>,
  sleepDur: number
) {
  // Find the maximum number of positions across all groups
  // This determines how many iterations we need to process all positions
  const maxPos = Math.max(...groups.map((grp) => grp.entriesIdx.length))
  // Add random weights to seeded players
  // The weight is calculated as: seeding value + random factor
  // This ensures seeded players generally get higher weights while adding some randomness
  // Higher weights mean these players will be drawn later (from the end of the array)
  const randSeededPlayers = seededPlayers.map((p) => {
    const r = Math.random() // Random factor between 0 and 1
    const w = p.player.seeding! + r // Add seeding value to random factor
    return {
      player: p.player, // The actual player object
      entryIdx: p.entryIdx, // Index of this player in the original entries array
      weight: w // Calculated weight for sorting
    }
  })
  // Add random weights to non-seeded players
  // The weight is just a random value between 0 and 1
  // These players will generally have lower weights than seeded players
  const randOtherPlayers = otherPlayers.map((p) => {
    const r = Math.random() // Random factor between 0 and 1
    return {
      player: p.player, // The actual player object
      entryIdx: p.entryIdx, // Index of this player in the original entries array
      weight: r // Random weight for sorting
    }
  })
  // Sort seeded players by weight in DESCENDING order (higher weights first)
  // This means players with higher seeding will generally be at the beginning of the array
  randSeededPlayers.sort((p1, p2) => {
    return p2.weight - p1.weight // Descending order
  })
  // Sort non-seeded players by weight in ASCENDING order (lower weights first)
  // This means players with lower random weights will be at the beginning of the array
  randOtherPlayers.sort((p1, p2) => {
    return p1.weight - p2.weight // Ascending order
  })
  // Combine all players with non-seeded players first, then seeded players
  // Since we'll be drawing players from the end of this array,
  // seeded players (at the end) will be drawn first
  const allPlayers = randOtherPlayers.concat(randSeededPlayers)
  // Track which clubs are already in each group to avoid club conflicts
  // Structure: { groupIndex: { clubName: true } }
  // This helps ensure players from the same club are separated when possible
  const groupsClubs: { [key: number]: { [key: string]: boolean } } = {}

  // Process each position in the groups in a zigzag pattern
  // This helps distribute players more evenly across groups
  for (let pos = 0; pos < maxPos; pos++) {
    if (pos % 2 === 0) {
      // For even positions, process groups from first to last (top to bottom)
      for (let j = 0; j < groups.length; j++) {
        // Skip if position doesn't exist or is marked as empty
        if (groups[j].entriesIdx[pos] === undefined) {
          continue
        }
        // Assign a player to this position
        drawPlayerForGrpPos(groups, j, pos, allPlayers, groupsClubs)
        // Add delay for animation purposes
        await new Promise((r) => setTimeout(r, sleepDur))
      }
    } else {
      // For odd positions, process groups from last to first (bottom to top)
      // This zigzag pattern helps distribute players more evenly
      for (let j = groups.length - 1; j >= 0; j--) {
        // Skip if position doesn't exist or is marked as empty
        if (groups[j].entriesIdx[pos] === undefined) {
          continue
        }
        // Assign a player to this position
        drawPlayerForGrpPos(groups, j, pos, allPlayers, groupsClubs)
        // Add delay for animation purposes
        await new Promise((r) => setTimeout(r, sleepDur))
      }
    }
  }

  // Validation: ensure all players have been assigned
  // If there are still players left in the allPlayers array, something went wrong
  if (allPlayers.length !== 0) {
    throw new Error('Something is wrong. Some players are not drawn!!!')
  }

  // Validation: ensure no positions are empty
  // If any position that should have a player is still empty, something went wrong
  if (hasEmptyPlayer(groups)) {
    throw new Error('Something is wrong. Some positions are still empty!!!')
  }
}

/**
 * Assigns a player to a specific position in a group.
 *
 * This function tries to find a suitable player for the given position
 * while avoiding club conflicts when possible. It prioritizes club separation
 * but will assign a player from the same club if no alternatives are available.
 *
 * The algorithm works as follows:
 * 1. First tries to assign the last player in the array (highest priority)
 * 2. If that player's club already exists in the group, tries to find another player
 * 3. If no suitable player is found, uses the highest priority player anyway
 *
 * @param groups - Array of tournament groups
 * @param j - Index of the current group
 * @param pos - Position in the group to fill
 * @param allPlayers - Array of available players with their weights and indices
 * @param groupsClubs - Tracking structure for clubs already in each group
 */
function drawPlayerForGrpPos(
  groups: Array<Group>,
  j: number,
  pos: number,
  allPlayers: { player: Entry; entryIdx: number; weight: number }[],
  groupsClubs: { [key: number]: { [key: string]: boolean } }
) {
  // Check if there are any players left to assign
  if (allPlayers.length === 0) {
    // No players left, can't assign anyone
    // This should not happen in normal operation
    return
  }

  // Initialize the club tracking for this group if it doesn't exist yet
  if (!groupsClubs[j]) {
    groupsClubs[j] = {}
  }
  // Get the last player in the array (highest priority player)
  const player = allPlayers[allPlayers.length - 1]

  // Check if this player's club is already in the current group
  if (!groupsClubs[j][player.player.club ?? '']) {
    // Club not in group yet, we can use this player
    const poppedPlayer = allPlayers.pop()! // Remove player from available list

    // Assign this player's index to the position in the group
    groups[j].entriesIdx[pos] = poppedPlayer.entryIdx

    // Mark this player's club as present in this group
    if (poppedPlayer.player.club) {
      groupsClubs[j][poppedPlayer.player.club!] = true
    }
  } else {
    // Club conflict: this player's club is already in the group
    // Try to find another player whose club is not in this group
    // Search for a player whose club is not already in this group
    // Start from the end (highest priority) and work backwards
    let found = false
    for (let p = allPlayers.length - 1; p >= 0; p--) {
      // Check if this player's club is already in the group
      if (!groupsClubs[j][allPlayers[p].player.club ?? '']) {
        // Found a player whose club is not in the group
        const splicedPlayer = allPlayers.splice(p, 1)[0] // Remove this specific player

        // Assign this player's index to the position in the group
        groups[j].entriesIdx[pos] = splicedPlayer.entryIdx

        // Mark this player's club as present in this group
        if (splicedPlayer.player.club) {
          groupsClubs[j][splicedPlayer.player.club!] = true
        }
        found = true
        break
      }
    }
    // If no suitable player was found (all have club conflicts)
    // Use the highest priority player anyway
    if (!found) {
      const poppedPlayer = allPlayers.pop()! // Remove the highest priority player

      // Assign this player's index to the position in the group
      // Even though their club is already in this group
      groups[j].entriesIdx[pos] = poppedPlayer.entryIdx

      // Mark this player's club as present in this group
      // (It should already be marked, but just to be safe)
      if (poppedPlayer.player.club) {
        groupsClubs[j][poppedPlayer.player.club!] = true
      }
    }
  }
}

/**
 * Clears all player assignments from groups and rounds.
 *
 * This function resets the tournament draw by:
 * 1. Clearing all matches in all rounds
 * 2. Resetting all entry positions to empty
 *
 * This is typically called before performing a new draw.
 *
 * @param entryType - Type of entries in the tournament (e.g., SINGLE, DOUBLE)
 * @param groups - Array of tournament groups to clear
 */
export function clearDraw(entryType: EntryType, groups: Array<Group>) {
  for (let i = 0; i < groups.length; i++) {
    const grp = groups[i]
    // Clear all matches in all rounds
    clearRound(entryType, grp.rounds)

    // Reset all entry positions to empty
    for (let j = 0; j < grp.entriesIdx.length; j++) {
      grp.entriesIdx[j] = EntryEmptyIdx // Use the empty index constant
    }
  }
}

/**
 * Clears all player assignments from matches in rounds.
 *
 * This function resets all matches by setting both entry indices to empty.
 * It's called by clearDraw to reset the tournament structure.
 *
 * @param entryType - Type of entries in the tournament (e.g., SINGLE, DOUBLE)
 * @param rounds - Array of rounds, where each round contains multiple matches
 */
function clearRound(entryType: EntryType, rounds: Match[][]) {
  // Iterate through each round
  for (let i = 0; i < rounds.length; i++) {
    const round = rounds[i]

    // Iterate through each match in the round
    for (let j = 0; j < round.length; j++) {
      // Reset both entry indices to empty
      round[j].entry1Idx = EntryEmptyIdx // Use the empty index constant
      round[j].entry2Idx = EntryEmptyIdx // Use the empty index constant
    }
  }
}
