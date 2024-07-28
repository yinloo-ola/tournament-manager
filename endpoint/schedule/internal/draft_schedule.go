package internal

import (
	"fmt"
	"log/slog"

	"github.com/tealeg/xlsx/v3"
	"github.com/yinloo-ola/tournament-manager/endpoint"
	"github.com/yinloo-ola/tournament-manager/model"
)

func CreateDraftSchedule(tournament model.Tournament) (endpoint.IoWriter, error) {
	schedule := createDraftSchedule(tournament)
	slog.Debug("CreateDraftSchedule", "schedule", schedule)

	book := xlsx.NewFile()
	_, err := book.AddSheet("schedule")
	if err != nil {
		return nil, fmt.Errorf("fail to add sheet %s: %w", "schedule", err)
	}

	return book, nil
}

func createDraftSchedule(tournament model.Tournament) model.Schedule {
	// slot categories with longest match duration behind
	// go through categories and assign unused slots
	return model.Schedule{}
}
