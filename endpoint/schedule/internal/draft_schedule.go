package internal

import (
	"container/list"
	"fmt"
	"log/slog"

	xlsx "github.com/tealeg/xlsx/v3"
	"github.com/yinloo-ola/tournament-manager/endpoint"
	"github.com/yinloo-ola/tournament-manager/model"
	"github.com/yinloo-ola/tournament-manager/utils/pointer"
)

func CreateDraftSchedule(tournament model.Tournament) (endpoint.IoWriter, error) {
	book := xlsx.NewFile()
	_, err := book.AddSheet("schedule")
	if err != nil {
		return nil, fmt.Errorf("fail to add sheet %s: %w", "schedule", err)
	}

	return book, nil
}

func GenerateRoundsForTournament(tournament model.Tournament) (model.Tournament, error) {
	for i, category := range tournament.Categories {
		for g, grp := range category.Groups {
			rounds := generateRounds(grp.Players)
			category.Groups[g].Rounds = rounds
		}
		tournament.Categories[i] = category
		slog.Debug("tournament", "category", category)
	}
	return tournament, nil
}

func generateRounds(players []model.Player) [][]model.Match {
	if len(players) < 2 {
		return nil
	}
	player0 := players[0]
	otherPlayers := list.New()
	for i := 1; i < len(players); i++ {
		otherPlayers.PushBack(pointer.Of(players[i]))
	}
	if len(players)%2 == 1 {
		otherPlayers.PushBack(pointer.Nil[model.Player]())
	}
	if otherPlayers.Len()%2 != 1 {
		panic("invalid num of players to rotate. remember to add bye")
	}

	numMatches := (len(players) * (len(players) - 1)) / 2
	numMatchesPerRound := len(players) / 2
	numRounds := numMatches / numMatchesPerRound
	rounds := make([][]model.Match, 0, numRounds)

	for r := 0; r < numRounds; r++ {
		round := make([]model.Match, 0, numMatchesPerRound)
		frontElem := otherPlayers.Front()
		frontPlayer := frontElem.Value.(*model.Player)
		matchIdx := 0
		if frontPlayer != nil {
			match0 := model.Match{
				Player1: player0,
				Player2: *frontPlayer,
			}
			round = append(round, match0)
			matchIdx++
		}
		p1Elem := otherPlayers.Back()
		p2Elem := frontElem.Next()
		for matchIdx < numMatchesPerRound {
			if p1Elem == nil || p2Elem == nil {
				break
			}
			p1 := p1Elem.Value.(*model.Player)
			p2 := p2Elem.Value.(*model.Player)
			if p1 != nil && p2 != nil {
				m := model.Match{
					Player1: *p1,
					Player2: *p2,
				}
				round = append(round, m)
				matchIdx++
			}
			p1Elem = p1Elem.Prev()
			p2Elem = p2Elem.Next()
		}
		rounds = append(rounds, round)
		last := otherPlayers.Remove(otherPlayers.Back()) // rotate
		otherPlayers.PushFront(last)
	}
	isValid := validateRounds(rounds, numMatches, numMatchesPerRound)
	if !isValid {
		slog.Error("generateRounds encounter error", "rounds", rounds, "numMatches", numMatches)
	}
	return rounds
}

func validateRounds(rounds [][]model.Match, numMatches int, numMatchesPerRound int) bool {
	// TODO
	return true
}

func generateMatches(players []model.Player) []model.Match {
	matches := make([]model.Match, 0, (len(players)-1)*(len(players)-2))
	for i := 0; i < len(players); i++ {
		for j := len(players) - 1; j > i; j-- {
			m := model.Match{
				Player1: players[i],
				Player2: players[j],
			}
			matches = append(matches, m)
		}
	}
	return matches
}
