package internal

import (
	"log/slog"

	"github.com/yinloo-ola/tournament-manager/utils/list"

	"github.com/yinloo-ola/tournament-manager/model"
	"github.com/yinloo-ola/tournament-manager/utils/pointer"
)

func GenerateRoundsForTournament(tournament model.Tournament) (model.Tournament, error) {
	for i, category := range tournament.Categories {
		for g, grp := range category.Groups {
			rounds := generateRounds(grp.Players, category.DurationMinutes)
			category.Groups[g].Rounds = rounds
		}
		tournament.Categories[i] = category
	}
	return tournament, nil
}

func generateRounds(players []model.Player, matchDurationMinutes int) [][]model.Match {
	if len(players) < 2 {
		return nil
	}
	player0 := players[0]

	otherPlayers := list.FromSlice([]*model.Player{})
	for i := 1; i < len(players); i++ {
		otherPlayers.PushBack(pointer.Of(players[i]))
	}
	if len(players)%2 == 1 {
		otherPlayers.PushBack(pointer.Nil[model.Player]())
	}
	if otherPlayers.Len%2 != 1 {
		panic("invalid num of players to rotate. remember to add bye")
	}

	numMatches := (len(players) * (len(players) - 1)) / 2
	numMatchesPerRound := len(players) / 2
	numRounds := numMatches / numMatchesPerRound
	rounds := list.FromSlice([][]model.Match{})

	for r := 0; r < numRounds; r++ {
		round := make([]model.Match, 0, numMatchesPerRound)
		frontElem := otherPlayers.First()
		frontPlayer := frontElem.Value
		matchIdx := 0
		if frontPlayer != nil {
			match0 := model.Match{
				Player1:         player0,
				Player2:         *frontPlayer,
				DurationMinutes: matchDurationMinutes,
			}
			round = append(round, match0)
			matchIdx++
		}
		p1Elem := otherPlayers.Last()
		p2Elem := frontElem.Next()
		for matchIdx < numMatchesPerRound {
			if p1Elem == nil || p2Elem == nil {
				break
			}
			p1 := p1Elem.Value
			p2 := p2Elem.Value
			if p1 != nil && p2 != nil {
				m := model.Match{
					Player1:         *p1,
					Player2:         *p2,
					DurationMinutes: matchDurationMinutes,
				}
				round = append(round, m)
				matchIdx++
			}
			p1Elem = p1Elem.Prev()
			p2Elem = p2Elem.Next()
		}
		rounds.PushBack(round)
		last := otherPlayers.Remove(otherPlayers.Last()) // rotate list
		otherPlayers.PushFront(last)
	}
	isValid := isRoundValid(rounds, numMatches, numMatchesPerRound)
	if !isValid {
		slog.Error("generateRounds encounter error", "rounds", rounds, "numMatches", numMatches)
		panic("generateRounds encounter error")
	}
	rotateTillLastRoundContains(rounds, players[1], players[2])
	return rounds.ToSlice()
}

func rotateTillLastRoundContains(rounds *list.List[[]model.Match], player1, player2 model.Player) {
	round := rounds.First()
	for round != nil {
		if roundContains(round.Value, player1, player2) {
			lastRound := rounds.Remove(round)
			rounds.PushBack(lastRound)
			break
		}
		round = round.Next()
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

func isRoundValid(rounds *list.List[[]model.Match], numMatches int, numMatchesPerRound int) bool {
	round := rounds.First()
	totalMatchCount := 0
	for round != nil {
		matches := round.Value
		if len(matches) != numMatchesPerRound {
			slog.Error("num of matches wrong!", "expected", numMatchesPerRound, "gotten", len(matches))
			return false
		}
		totalMatchCount += len(matches)
		round = round.Next()
	}
	return totalMatchCount == numMatches
}

// func generateMatches(players []model.Player) []model.Match {
// 	matches := make([]model.Match, 0, (len(players)-1)*(len(players)-2))
// 	for i := 0; i < len(players); i++ {
// 		for j := len(players) - 1; j > i; j-- {
// 			m := model.Match{
// 				Player1: players[i],
// 				Player2: players[j],
// 			}
// 			matches = append(matches, m)
// 		}
// 	}
// 	return matches
// }
