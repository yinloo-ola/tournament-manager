// Port of endpoint/schedule/internal/generate_rounds.go (pure logic, no I/O).
//
// Generates the round-robin matches within each group and the knockout bracket
// for a tournament, in place on the passed Tournament and returned. This
// replaces the legacy `POST /api/generateRounds` fetch with a synchronous local
// computation that produces the same `category.groups[].rounds` and
// `category.knockoutRounds` shape the Go endpoint returned.
//
// Field mapping (Go struct → TS type, from model/model.go vs @/shared/model):
//   Entry1Idx → entry1Idx, Entry2Idx → entry2Idx, DurationMinutes → durationMinutes,
//   Round → round, Matches → matches, EntriesIdx → entriesIdx,
//   KnockoutRounds → knockoutRounds, ShortName → shortName.
//   EntryByeIdx = -2, EntryEmptyIdx = -1 (same constants in @/shared/model).
//
// Go `panic`s on invalid generation become thrown `Error`s here; the UI is
// expected to catch them. Dead helpers from the Go file
// (getRoundPlayersIndicesWithRotation, generateSlice, rotateInPlace, reverse)
// are intentionally NOT ported — they are not on the active path.

import {
  EntryByeIdx,
  EntryEmptyIdx,
  type Match,
  type Group,
  type KnockoutRound,
  type Tournament
} from '@/shared/model'

// generateRoundsForTournament populates every category's group round-robins and
// knockout brackets on `tournament` and returns it. Mirrors GenerateRoundsForTournament.
export function generateRoundsForTournament(tournament: Tournament): Tournament {
  for (let i = 0; i < tournament.categories.length; i++) {
    const category = tournament.categories[i]

    for (let g = 0; g < category.groups.length; g++) {
      const rounds = generateGroupRounds(category.groups[g].entriesIdx, category.durationMinutes)
      if (category.groups[g].rounds.length === 0) {
        category.groups[g].rounds = rounds
      } else {
        if (category.groups[g].rounds.length !== rounds.length) {
          throw new Error(`number of rounds for group ${g + 1} is not equal`)
        }
        for (let j = 0; j < category.groups[g].rounds.length; j++) {
          for (let k = 0; k < category.groups[g].rounds[j].length; k++) {
            category.groups[g].rounds[j][k].entry1Idx = rounds[j][k].entry1Idx
            category.groups[g].rounds[j][k].entry2Idx = rounds[j][k].entry2Idx
          }
        }
      }
    }

    // Always generate knockout rounds based on the current NumQualifiedPerGroup.
    const koRounds = generateKnockoutRounds(category.groups, category.numQualifiedPerGroup)
    if (koRounds.length !== category.knockoutRounds.length) {
      category.knockoutRounds = koRounds
    } else {
      for (let j = 0; j < category.knockoutRounds.length; j++) {
        if (category.knockoutRounds[j].matches.length !== koRounds[j].matches.length) {
          category.knockoutRounds[j].matches = koRounds[j].matches
        } else {
          for (let k = 0; k < category.knockoutRounds[j].matches.length; k++) {
            category.knockoutRounds[j].matches[k].entry1Idx = koRounds[j].matches[k].entry1Idx
            category.knockoutRounds[j].matches[k].entry2Idx = koRounds[j].matches[k].entry2Idx
          }
        }
      }
    }
    tournament.categories[i] = category
  }
  return tournament
}

// swapRoundWithPlayersToEnd moves the round containing the (player1, player2)
// match to the final slot — port of the eponymous Go helper.
function swapRoundWithPlayersToEnd(rounds: Match[][], player1: number, player2: number): void {
  let roundIdx = -1
  for (let i = 0; i < rounds.length; i++) {
    if (i === rounds.length - 1) {
      continue
    }
    if (roundContains(rounds[i], player1, player2)) {
      roundIdx = i
    }
  }
  if (roundIdx >= 0) {
    const last = rounds.length - 1
    ;[rounds[roundIdx], rounds[last]] = [rounds[last], rounds[roundIdx]]
  }
}

function roundContains(round: Match[], player1Idx: number, player2Idx: number): boolean {
  for (const match of round) {
    if (match.entry1Idx === player1Idx && match.entry2Idx === player2Idx) {
      return true
    }
    if (match.entry1Idx === player2Idx && match.entry2Idx === player1Idx) {
      return true
    }
  }
  return false
}

function isRoundValid(rounds: Match[][], numMatches: number, numMatchesPerRound: number): boolean {
  let totalMatchCount = 0
  for (const matches of rounds) {
    if (matches.length !== numMatchesPerRound) {
      return false
    }
    totalMatchCount += matches.length
  }
  return totalMatchCount === numMatches
}

// nextPowerOfTwo returns the smallest power of two >= x.
// Port of the Go bit-twiddling implementation. (For the 32-bit JS operands used
// here the `>> 32` step is a no-op; this stays correct for all realistic player
// counts up to 2^31, which exceeds any tournament size.)
export function nextPowerOfTwo(x: number): number {
  if (x <= 1) {
    return 1
  }
  x--
  x |= x >> 1
  x |= x >> 2
  x |= x >> 4
  x |= x >> 8
  x |= x >> 16
  x |= x >> 32
  return x + 1
}

// generateKnockoutRounds builds the empty bracket (all EntryEmptyIdx matches)
// down to the final, sized to the next power of two over the qualified players.
export function generateKnockoutRounds(
  groups: Group[],
  numQualifiedPerGroup: number
): KnockoutRound[] {
  for (const group of groups) {
    if (group.entriesIdx.length < numQualifiedPerGroup) {
      throw new Error('not enough players')
    }
  }

  const qualifiedPlayersNum = groups.length * numQualifiedPerGroup
  const firstRound = nextPowerOfTwo(qualifiedPlayersNum)
  const numByes = firstRound - qualifiedPlayersNum
  const numMatches = firstRound / 2 - numByes

  const koRounds: KnockoutRound[] = []

  for (let round = firstRound; round >= 2; round = Math.floor(round / 2)) {
    const matchesCount = round === firstRound ? numMatches : round / 2
    const matches: Match[] = Array.from({ length: matchesCount }, () => ({
      entry1Idx: EntryEmptyIdx,
      entry2Idx: EntryEmptyIdx,
      datetime: '',
      durationMinutes: 0,
      table: ''
    }))
    koRounds.push({ round, matches })
  }

  return koRounds
}

// generateGroupRounds produces a complete round-robin for one group's entries
// using the circle method with the "bouncing" boundary reflection. Odd entry
// counts get a bye appended (EntryByeIdx). Mirrors generateGroupRounds.
export function generateGroupRounds(entriesIdx: number[], matchDurationMinutes: number): Match[][] {
  if (entriesIdx.length < 2) {
    return []
  }

  // Copy so we never mutate the caller's entriesIdx slice (Go's append returns a
  // new slice header; slice + push here gives the same isolation).
  const players = entriesIdx.slice()
  let numPlayers = players.length
  const numMatches = (numPlayers * (numPlayers - 1)) / 2
  // Integer division (Go used integer `/`; the JS port must floor). For even
  // group sizes this is identical to plain division, so even-size golden
  // outputs are unchanged. For ODD sizes a bye is appended below, and flooring
  // keeps numMatchesPerRound/numRounds whole (e.g. 3 players -> 1 match/round
  // over 3 rounds) so isRoundValid() does not reject the valid schedule.
  const numMatchesPerRound = Math.floor(numPlayers / 2)
  const numRounds = Math.floor(numMatches / numMatchesPerRound)

  if (numPlayers % 2 === 1) {
    players.push(EntryByeIdx)
    numPlayers++
  }

  const rounds: Match[][] = Array.from({ length: numRounds }, (_, r) =>
    getRoundMatches(r, players, matchDurationMinutes)
  )

  if (!isRoundValid(rounds, numMatches, numMatchesPerRound)) {
    throw new Error('generateGroupRounds encounter error')
  }

  if (players.length > 2) {
    swapRoundWithPlayersToEnd(rounds, players[1], players[2])
  }
  return rounds
}

// getRoundMatches builds the list of matches for a single round from the player
// indices produced by getRoundPlayersIndices. A bye entry is skipped (no match).
// Port of getRoundMatches; the in/out `indices` buffer is allocated locally.
export function getRoundMatches(
  round: number,
  entriesIdx: number[],
  matchDurationMinutes: number
): Match[] {
  const indices = getRoundPlayersIndices(round, entriesIdx.length)
  const matches: Match[] = []

  for (let i = 0; i < indices.length; i += 2) {
    let ind1 = indices[i]
    let ind2 = indices[i + 1]
    if (ind2 < ind1) {
      ;[ind1, ind2] = [ind2, ind1]
    }
    const p1 = entriesIdx[ind1]
    const p2 = entriesIdx[ind2]
    if (p1 === EntryByeIdx || p2 === EntryByeIdx) {
      continue
    }
    matches.push({
      entry1Idx: p1,
      entry2Idx: p2,
      datetime: '',
      durationMinutes: matchDurationMinutes,
      table: ''
    })
  }
  return matches
}

// getRoundPlayersIndices computes the player indices for a given round in a
// round-robin draw via the "bouncing" boundary reflection. res[0] is always 0
// (player 0 stays fixed); the rest rotate with reflection at both boundaries.
// Port of getRoundPlayersIndices verbatim — this is the subtle part.
export function getRoundPlayersIndices(round: number, numPlayers: number): number[] {
  if (numPlayers % 2 === 1) {
    throw new Error('num of players should be even')
  }
  if (round + 1 >= numPlayers) {
    throw new Error('invalid number of rounds or numPlayers')
  }

  const res: number[] = new Array(numPlayers)
  res[0] = 0

  // Iterate through all players except player 0 (who stays fixed at position 0)
  for (let i = 1; i < numPlayers; i++) {
    let newPos: number

    if (i % 2 === 0) {
      // For players at even positions (2, 4, 6, etc.) — clockwise rotation
      newPos = i + 2 * round
      if (newPos >= numPlayers) {
        // Bounce off the upper boundary
        newPos = 2 * numPlayers - newPos - 1
        if (newPos < 0) {
          newPos = -(newPos - 1)
        }
      }
    } else {
      // For players at odd positions (1, 3, 5, etc.) — counterclockwise rotation
      newPos = i - 2 * round
      if (newPos < 0) {
        // Bounce off the lower boundary
        newPos = -(newPos - 1)
        if (newPos >= numPlayers) {
          newPos = 2 * numPlayers - newPos - 1
        }
      }
    }

    res[i] = newPos
  }
  return res
}
