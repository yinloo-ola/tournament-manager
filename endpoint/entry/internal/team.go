package internal

import (
	"context"
	"fmt"
	"io"
	"strconv"
	"strings"

	"github.com/xuri/excelize/v2"
	"github.com/yinloo-ola/tournament-manager/model"
	"github.com/yinloo-ola/tournament-manager/utils/pointer"
)

const (
	entrySheetName   = "entries"
	playersSheetName = "players"
)

func ImportTeamEntries(ctx context.Context, xlsxReader io.Reader, minPlayers, maxPlayers int) ([]model.Entry, error) {
	file, err := excelize.OpenReader(xlsxReader)
	if err != nil {
		return nil, fmt.Errorf("failed to open reader: %w", err)
	}
	defer file.Close()

	// Read players sheet to get player details
	playerRows, err := file.GetRows(playersSheetName, excelize.Options{
		RawCellValue: true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get player rows: %w", err)
	}

	// Create a map of player SN to player details
	playerMap := make(map[string][]model.Player)
	for _, row := range playerRows[1:] { // Skip header row
		if len(row) < len(playersHeader) {
			continue
		}

		name := strings.TrimSpace(row[1])
		dob := strings.TrimSpace(row[2])
		gender := strings.TrimSpace(row[3])
		team := strings.TrimSpace(row[4])

		playerMap[team] = append(playerMap[team], model.Player{
			Name:        name,
			DateOfBirth: dob,
			Gender:      gender,
		})
	}

	// Read entries sheet
	entryRows, err := file.GetRows(entrySheetName, excelize.Options{
		RawCellValue: true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get entry rows: %w", err)
	}

	entries := make([]model.Entry, 0, len(entryRows)-1)
	for _, row := range entryRows[1:] { // Skip header row
		if len(row) < 3 { // club and seeding are optional
			continue
		}
		teamName := strings.TrimSpace(row[1])
		var club string
		var seeding int
		if len(row) > 2 {
			club = strings.TrimSpace(row[2])
		}
		if len(row) > 3 {
			seedingStr := strings.TrimSpace(row[3])
			if seedingStr != "" {
				seeding, err = strconv.Atoi(seedingStr)
				if err != nil {
					return nil, fmt.Errorf("failed to parse seeding: %w", err)
				}
			}
		}

		// Get team players
		players, ok := playerMap[teamName]
		if !ok {
			return nil, fmt.Errorf("team %s not found in players sheet", teamName)
		}

		// if number of players for any team is not between minPlayers and maxPlayers, return error
		if len(players) < minPlayers || len(players) > maxPlayers {
			return nil, fmt.Errorf("team %s has %d players, which is not between %d and %d", teamName, len(players), minPlayers, maxPlayers)
		}

		// Create team entry
		entry := model.Entry{
			EntryType: model.Team,
			Club:      pointer.OrNil(club),
			Seeding:   pointer.OrNil(seeding),
			TeamEntry: &model.TeamEntry{
				TeamName:   teamName,
				Players:    players,
				MaxPlayers: maxPlayers,
				MinPlayers: minPlayers,
			},
		}
		entries = append(entries, entry)
	}

	return entries, nil
}
