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
				for i := range category.Groups[g].Rounds {
					for j := range category.Groups[g].Rounds[i] {
						category.Groups[g].Rounds[i][j].Entry1Idx = rounds[i][j].Entry1Idx
						category.Groups[g].Rounds[i][j].Entry2Idx = rounds[i][j].Entry2Idx
					}
				}
			}
		}

		// Always generate knockout rounds based on the current NumQualifiedPerGroup
		koRounds, err := generateKnockoutRounds(category.Groups, category.NumQualifiedPerGroup)
		if err != nil {
			return tournament, fmt.Errorf("generate knock out rounds for category %s failed: %w", category.ShortName, err)
		}
		category.KnockoutRounds = koRounds

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
			koRound := model.KnockoutRound{
				Round:   round,
				Matches: make([]model.Match, numMatches),
			}
			koRounds = append(koRounds, koRound)
			continue
		}

		koRound := model.KnockoutRound{
			Round:   round,
			Matches: make([]model.Match, round/2),
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

func getRoundPlayersIndices(round, numPlayers int, res []int) {
	if numPlayers%2 == 1 {
		panic("num of players should be even")
	}
	if round+1 >= numPlayers {
		panic("invalid number of rounds or numPlayers")
	}

	res[0] = 0

	for i := 1; i < numPlayers; i++ {
		var newPos int
		if i%2 == 0 { // even pos, +2 per move
			newPos = i + 2*round
			if newPos >= numPlayers {
				newPos = 2*numPlayers - newPos - 1
				if newPos < 0 {
					newPos = -(newPos - 1)
				}
			}
		} else { // odd pos, -2 per move
			newPos = i - 2*round
			if newPos < 0 {
				newPos = -(newPos - 1)
				if newPos >= numPlayers {
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
