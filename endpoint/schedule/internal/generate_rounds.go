package internal

import (
	"fmt"
	"log/slog"

	"github.com/yinloo-ola/tournament-manager/model"
)

func GenerateRoundsForTournament(tournament model.Tournament) (model.Tournament, error) {
	for i, category := range tournament.Categories {
		for g, grp := range category.Groups {
			rounds := generateRounds(grp.Players, category.DurationMinutes)
			if len(category.Groups[g].Rounds) == 0 {
				category.Groups[g].Rounds = rounds
			} else {
				if len(category.Groups[g].Rounds) != len(rounds) {
					return tournament, fmt.Errorf("number of rounds for group %d is not equal", g+1)
				}
				for i := range category.Groups[g].Rounds {
					for j := range category.Groups[g].Rounds[i] {
						category.Groups[g].Rounds[i][j].Player1 = rounds[i][j].Player1
						category.Groups[g].Rounds[i][j].Player2 = rounds[i][j].Player2
					}
				}
			}
		}
		tournament.Categories[i] = category
	}
	return tournament, nil
}

func swapRoundWithPlayersToEnd(rounds [][]model.Match, player1, player2 model.Player) {
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

func roundContains(round []model.Match, player1, player2 model.Player) bool {
	for _, match := range round {
		if match.Player1 == player1 && match.Player2 == player2 {
			return true
		} else if match.Player1 == player2 && match.Player2 == player1 {
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

const playerByeName = "{BYE}"

func generateRounds(players []model.Player, matchDurationMinutes int) [][]model.Match {
	if len(players) < 2 {
		return nil
	}

	numPlayers := len(players)
	numMatches := (numPlayers * (numPlayers - 1)) / 2
	numMatchesPerRound := numPlayers / 2
	numRounds := numMatches / numMatchesPerRound

	if numPlayers%2 == 1 {
		players = append(players, model.Player{
			Name: playerByeName,
		})
		numPlayers++
	}

	rounds := make([][]model.Match, numRounds)
	indices := make([]int, numPlayers)
	for r := 0; r < numRounds; r++ {
		rounds[r] = getRoundMatches(r, players, matchDurationMinutes, indices)
	}

	if !isRoundValid(rounds, numMatches, numMatchesPerRound) {
		slog.Error("generateRounds encounter error", "rounds", rounds, "numMatches", numMatches)
		panic("generateRounds encounter error")
	}

	swapRoundWithPlayersToEnd(rounds, players[1], players[2])
	return rounds
}

func getRoundMatches(round int, players []model.Player, matchDurationMinutes int, indices []int) []model.Match {
	getRoundPlayersIndices(round, len(players), indices)
	matches := make([]model.Match, 0, len(players)/2)

	for i := 0; i < len(indices); i += 2 {
		ind1, ind2 := indices[i], indices[i+1]
		if ind2 < ind1 {
			ind1, ind2 = ind2, ind1
		}
		p1 := players[ind1]
		p2 := players[ind2]
		if p1.Name == playerByeName || p2.Name == playerByeName {
			continue
		}
		match := model.Match{
			Player1:         p1,
			Player2:         p2,
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
