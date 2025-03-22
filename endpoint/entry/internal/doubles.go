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

var doublesHeader = []string{"SN", "Player1", "Player2", "Seeding", "Club"}
var playersHeader = []string{"SN", "Name", "Date Of Birth", "Gender"}

func ImportDoublesEntries(ctx context.Context, xlsxReader io.Reader) ([]model.Entry, error) {
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
	playerMap := make(map[string]model.Player)
	for _, row := range playerRows[1:] { // Skip header row
		if len(row) < len(playersHeader) {
			continue
		}
		// sn := strings.TrimSpace(row[0])
		name := strings.TrimSpace(row[1])
		dob := strings.TrimSpace(row[2])
		gender := strings.TrimSpace(row[3])

		playerMap[name] = model.Player{
			Name:   name,
			DOB:    dob,
			Gender: gender,
		}
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
		if len(row) < len(doublesHeader) {
			continue
		}

		player1Name := strings.TrimSpace(row[1])
		player2Name := strings.TrimSpace(row[2])
		seedingStr := strings.TrimSpace(row[3])
		club := strings.TrimSpace(row[4])

		// Get player details from the map
		player1, ok1 := playerMap[player1Name]
		if !ok1 {
			return nil, fmt.Errorf("player with SN %s not found in players sheet", player1Name)
		}

		player2, ok2 := playerMap[player2Name]
		if !ok2 {
			return nil, fmt.Errorf("player with SN %s not found in players sheet", player2Name)
		}

		// Parse seeding if provided
		seeding := 0
		if seedingStr != "" {
			seeding, err = strconv.Atoi(seedingStr)
			if err != nil {
				return nil, fmt.Errorf("failed to parse seeding: %w", err)
			}
		}

		// Create doubles entry
		entry := model.Entry{
			EntryType: model.EntryTypeDoubles,
			DoublesEntry: &model.DoublesEntry{
				Players: [2]model.Player{player1, player2},
				BaseEntry: model.BaseEntry{
					Club:    pointer.OrNil(club),
					Seeding: pointer.OrNil(seeding),
				},
			},
		}
		entries = append(entries, entry)
	}

	return entries, nil
}
