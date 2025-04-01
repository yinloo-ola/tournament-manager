package internal

import (
	"fmt"
	"log/slog"

	"github.com/yinloo-ola/tournament-manager/model"
)

func GenerateRoundsForTournament(tournament model.Tournament) (model.Tournament, error) {
	for i, category := range tournament.Categories {
		for g, grp := range category.Groups {
			rounds := generateGroupRounds(grp.EntriesIdx, category.DurationMinutes)
			if len(category.Groups[g].Rounds) == 0 {
				category.Groups[g].Rounds = rounds
			} else {
				if len(category.Groups[g].Rounds) != len(rounds) {
					return tournament, fmt.Errorf("number of rounds for group %d is not equal", g+1)
				}
				for j := range category.Groups[g].Rounds {
					for k := range category.Groups[g].Rounds[j] {
						category.Groups[g].Rounds[j][k].Entry1Idx = rounds[j][k].Entry1Idx
						category.Groups[g].Rounds[j][k].Entry2Idx = rounds[j][k].Entry2Idx
					}
				}
			}
		}

		// Always generate knockout rounds based on the current NumQualifiedPerGroup
		koRounds, err := generateKnockoutRounds(category.Groups, category.NumQualifiedPerGroup)
		if err != nil {
			return tournament, fmt.Errorf("generate knock out rounds for category %s failed: %w", category.ShortName, err)
		}
		if len(koRounds) != len(category.KnockoutRounds) {
			category.KnockoutRounds = koRounds
		} else {
			for j := range category.KnockoutRounds {
				if len(category.KnockoutRounds[j].Matches) != len(koRounds[j].Matches) {
					category.KnockoutRounds[j].Matches = koRounds[j].Matches
				} else {
					for k := range category.KnockoutRounds[j].Matches {
						category.KnockoutRounds[j].Matches[k].Entry1Idx = koRounds[j].Matches[k].Entry1Idx
						category.KnockoutRounds[j].Matches[k].Entry2Idx = koRounds[j].Matches[k].Entry2Idx
					}
				}
			}
		}
		tournament.Categories[i] = category
	}
	return tournament, nil
}

func swapRoundWithPlayersToEnd(rounds [][]model.Match, player1, player2 int) {
	roundIdx := -1
	for i, round := range rounds {
		if i == len(rounds)-1 {
			continue
		}
		if roundContains(round, player1, player2) {
			roundIdx = i
		}
	}
	if roundIdx >= 0 {
		rounds[roundIdx], rounds[len(rounds)-1] = rounds[len(rounds)-1], rounds[roundIdx]
	}
}

func roundContains(round []model.Match, player1Idx, player2Idx int) bool {
	for _, match := range round {
		if match.Entry1Idx == player1Idx && match.Entry2Idx == player2Idx {
			return true
		} else if match.Entry1Idx == player2Idx && match.Entry2Idx == player1Idx {
			return true
		}
	}
	return false
}

func isRoundValid(rounds [][]model.Match, numMatches int, numMatchesPerRound int) bool {
	totalMatchCount := 0
	for _, matches := range rounds {
		if len(matches) != numMatchesPerRound {
			slog.Error("num of matches wrong!", "expected", numMatchesPerRound, "gotten", len(matches))
			return false
		}
		totalMatchCount += len(matches)
	}

	return totalMatchCount == numMatches
}

func nextPowerOfTwo(x int) int {
	if x <= 1 {
		return 1
	}
	x--
	x |= x >> 1
	x |= x >> 2
	x |= x >> 4
	x |= x >> 8
	x |= x >> 16
	x |= x >> 32
	x++
	return x
}

func generateKnockoutRounds(groups []model.Group, numQualifiedPerGroup int) ([]model.KnockoutRound, error) {
	for _, group := range groups {
		if len(group.EntriesIdx) < numQualifiedPerGroup {
			return nil, fmt.Errorf("not enough players")
		}
	}

	qualifiedPlayersNum := len(groups) * numQualifiedPerGroup
	firstRound := nextPowerOfTwo(qualifiedPlayersNum)
	numByes := firstRound - qualifiedPlayersNum
	numMatches := (firstRound / 2) - numByes

	koRounds := make([]model.KnockoutRound, 0)

	round := firstRound
	for ; round >= 2; round = round / 2 {
		if round == firstRound {
			matches := make([]model.Match, numMatches)
			for i := range matches {
				matches[i] = model.Match{
					Entry1Idx: model.EntryEmptyIdx,
					Entry2Idx: model.EntryEmptyIdx,
				}
			}
			koRound := model.KnockoutRound{
				Round:   round,
				Matches: matches,
			}
			koRounds = append(koRounds, koRound)
			continue
		}

		matches := make([]model.Match, round/2)
		for i := range matches {
			matches[i] = model.Match{
				Entry1Idx: model.EntryEmptyIdx,
				Entry2Idx: model.EntryEmptyIdx,
			}
		}
		koRound := model.KnockoutRound{
			Round:   round,
			Matches: matches,
		}
		koRounds = append(koRounds, koRound)
	}

	return koRounds, nil
}

func generateGroupRounds(entriesIdx []int, matchDurationMinutes int) [][]model.Match {
	if len(entriesIdx) < 2 {
		return nil
	}

	numPlayers := len(entriesIdx)
	numMatches := (numPlayers * (numPlayers - 1)) / 2
	numMatchesPerRound := numPlayers / 2
	numRounds := numMatches / numMatchesPerRound

	if numPlayers%2 == 1 {
		entriesIdx = append(entriesIdx, model.EntryByeIdx)
		numPlayers++
	}

	rounds := make([][]model.Match, numRounds)
	indices := make([]int, numPlayers)
	for r := 0; r < numRounds; r++ {
		rounds[r] = getRoundMatches(r, entriesIdx, matchDurationMinutes, indices)
	}

	if !isRoundValid(rounds, numMatches, numMatchesPerRound) {
		slog.Error("generateGroupRounds encounter error", "rounds", rounds, "numMatches", numMatches)
		panic("generateGroupRounds encounter error")
	}

	if len(entriesIdx) > 2 {
		swapRoundWithPlayersToEnd(rounds, entriesIdx[1], entriesIdx[2])
	}
	return rounds
}

func getRoundMatches(round int, entriesIdx []int, matchDurationMinutes int, indices []int) []model.Match {
	getRoundPlayersIndices(round, len(entriesIdx), indices)
	matches := make([]model.Match, 0, len(entriesIdx)/2)

	for i := 0; i < len(indices); i += 2 {
		ind1, ind2 := indices[i], indices[i+1]
		if ind2 < ind1 {
			ind1, ind2 = ind2, ind1
		}
		p1 := entriesIdx[ind1]
		p2 := entriesIdx[ind2]
		if p1 == model.EntryByeIdx || p2 == model.EntryByeIdx {
			continue
		}
		match := model.Match{
			Entry1Idx:       p1,
			Entry2Idx:       p2,
			DurationMinutes: matchDurationMinutes,
		}
		matches = append(matches, match)
	}
	return matches
}

func getRoundPlayersIndicesWithRotation(round, numPlayers int, sliceForRotation, res []int) {
	if numPlayers%2 == 1 {
		panic("num of players should be even")
	}
	if round+1 >= numPlayers {
		panic("invalid number of rounds or numPlayers")
	}

	res[0] = 0

	indices := make([]int, len(sliceForRotation))
	copy(indices, sliceForRotation)
	ind := 0

	rotateInPlace(indices, round)

	// for all second players starting from the first
	for i := 1; i < numPlayers; i += 2 {
		res[i] = indices[ind]
		ind++
	}

	// for all first
	for i := numPlayers - 2; i > 0; i -= 2 {
		res[i] = indices[ind]
		ind++
	}
}

// getRoundPlayersIndices computes the indices of players for a given round in a round-robin tournament.
// This function fills the `res` slice with indices of players for the specified `round`.
// It expects an even number of players and the number of rounds should not exceed the number of players.
// The `res` slice will contain the calculated indices, with `res[0]` always being 0.
// The function panics if the input constraints are not met.
// Example:
// For 4 players (0, 1, 2, 3):
//   - Round 0: res = [0, 1, 2, 3]
//   - Round 1: res = [0, 3, 1, 2]
//   - Round 2: res = [0, 2, 3, 1]
func getRoundPlayersIndices(round, numPlayers int, res []int) {
	if numPlayers%2 == 1 {
		panic("num of players should be even")
	}
	if round+1 >= numPlayers {
		panic("invalid number of rounds or numPlayers")
	}

	res[0] = 0

	// Iterate through all players except player 0 (who stays fixed at position 0)
	for i := 1; i < numPlayers; i++ {
		var newPos int

		if i%2 == 0 { // For players at even positions (2, 4, 6, etc.)
			// Move forward by 2*round positions for each round
			// This creates a clockwise rotation pattern for even-positioned players
			newPos = i + 2*round

			// If the new position exceeds the valid range (0 to numPlayers-1)
			if newPos >= numPlayers {
				// Apply "bouncing" logic when we hit the boundary
				// This formula reflects the position back from the boundary
				// Example: With 8 players, if newPos = 9, it becomes 2*8-9-1 = 6
				newPos = 2*numPlayers - newPos - 1

				// Handle double reflection case (when the reflection itself is out of bounds)
				// This can happen with larger round numbers
				if newPos < 0 {
					// Second reflection: if we bounce back past 0, reflect again
					// The formula -(newPos - 1) ensures we stay within valid range
					newPos = -(newPos - 1)
				}
			}
		} else { // For players at odd positions (1, 3, 5, etc.)
			// Move backward by 2*round positions for each round
			// This creates a counterclockwise rotation pattern for odd-positioned players
			newPos = i - 2*round

			// If the new position is negative (below the valid range)
			if newPos < 0 {
				// Apply "bouncing" logic when we hit the lower boundary
				// This formula reflects the position back from the boundary
				// Example: With 8 players, if newPos = -1, it becomes -(-1-1) = 2
				newPos = -(newPos - 1)

				// Handle double reflection case (when the reflection exceeds upper bound)
				if newPos >= numPlayers {
					// Second reflection: if we bounce past numPlayers, reflect again
					// The formula 2*numPlayers - newPos - 1 ensures we stay within valid range
					newPos = 2*numPlayers - newPos - 1
				}
			}
		}

		res[i] = newPos
	}
}

func generateSlice(n int) []int {
	if n%2 == 0 {
		panic("only odd slice supported")
	}
	// Create a slice to hold the result
	result := make([]int, n)

	// Calculate the midpoint (N/2 + 1) for odd numbers
	midpoint := n/2 + 1

	// Fill the first half of the slice with odd numbers starting from 1
	for i := 0; i < midpoint; i++ {
		result[i] = 2*i + 1
	}

	// Fill the second half with even numbers in reverse order starting from 2
	for i := midpoint; i < n; i++ {
		result[i] = 2 * (n - i)
	}

	return result
}

func rotateInPlace(s []int, n int) {
	n %= len(s) // Handle rotations greater than slice length

	// Reverse the entire array
	reverse(s, 0, len(s)-1)

	// Reverse the first n elements
	reverse(s, 0, n-1)

	// Reverse the last len(s) - n elements
	reverse(s, n, len(s)-1)
}

func reverse(s []int, start, end int) {
	for i, j := start, end; i < j; i, j = i+1, j-1 {
		s[i], s[j] = s[j], s[i]
	}
}
