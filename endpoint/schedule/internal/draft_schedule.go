package internal

import (
	"fmt"
	"log/slog"

	xlsx "github.com/tealeg/xlsx/v3"
	"github.com/yinloo-ola/tournament-manager/endpoint"
	"github.com/yinloo-ola/tournament-manager/model"
)

func CreateDraftSchedule(tournament model.Tournament) (endpoint.IoWriter, error) {
	book := xlsx.NewFile()
	_, err := book.AddSheet("schedule")
	for i, category := range tournament.Categories {
		if err != nil {
			return nil, fmt.Errorf("fail to add sheet %s: %w", category.ShortName, err)
		}
		for g, grp := range category.Groups {
			matches := generateMatches(grp.Players)

			category.Groups[g].Matches = matches
		}
		tournament.Categories[i] = category
		slog.Debug("tournament", "category", category)
	}

	return book, nil
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
