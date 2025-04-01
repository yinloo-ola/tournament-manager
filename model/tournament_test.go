package model

import (
	"encoding/json"
	"os"
	"testing"
	"time"
)

func TestTournamentUnmarshal(t *testing.T) {
	tests := []struct {
		name     string
		file     string
		validate func(t *testing.T, tournament *Tournament)
	}{
		{
			name: "complete tournament structure",
			file: "../testdata/tournament.json",
			validate: func(t *testing.T, tournament *Tournament) {
				// Validate root structure
				if tournament.Name != "Singapore Open 2025" {
					t.Errorf("expected name 'Singapore Open 2025', got %q", tournament.Name)
				}
				if tournament.NumTables != 8 {
					t.Errorf("expected 8 tables, got %d", tournament.NumTables)
				}
				expectedTime, _ := time.Parse("2006-01-02T15:04", "2025-03-22T09:00")
				if time.Time(tournament.StartTime) != expectedTime {
					t.Errorf("expected start time %v, got %v", expectedTime, tournament.StartTime)
				}

				// Validate categories
				if len(tournament.Categories) != 3 {
					t.Fatalf("expected 3 categories, got %d", len(tournament.Categories))
				}

				// Validate Singles category
				singles := tournament.Categories[0]
				if len(singles.Entries) != 1 {
					t.Fatalf("expected 1 singles entry, got %d", len(singles.Entries))
				}
				entry := singles.Entries[0]
				if entry.EntryType != Singles {
					t.Errorf("expected Singles entry type, got %v", entry.EntryType)
				}
				if entry.SinglesEntry == nil {
					t.Fatal("expected SinglesEntry to be present")
				}
				if entry.SinglesEntry.Player.Name != "John Doe" {
					t.Errorf("expected player name 'John Doe', got %q", entry.SinglesEntry.Player.Name)
				}

				// Validate Doubles category
				doubles := tournament.Categories[1]
				if len(doubles.Entries) != 1 {
					t.Fatalf("expected 1 doubles entry, got %d", len(doubles.Entries))
				}
				entry = doubles.Entries[0]
				if entry.EntryType != Doubles {
					t.Errorf("expected Doubles entry type, got %v", entry.EntryType)
				}
				if entry.DoublesEntry == nil {
					t.Fatal("expected DoubleEntry to be present")
				}
				if len(entry.DoublesEntry.Players) != 2 {
					t.Errorf("expected 2 players, got %d", len(entry.DoublesEntry.Players))
				}

				// Validate Team category
				team := tournament.Categories[2]
				if len(team.Entries) != 1 {
					t.Fatalf("expected 1 team entry, got %d", len(team.Entries))
				}
				entry = team.Entries[0]
				if entry.EntryType != Team {
					t.Errorf("expected Team entry type, got %v", entry.EntryType)
				}
				if entry.TeamEntry == nil {
					t.Fatal("expected TeamEntry to be present")
				}
				if len(entry.TeamEntry.Players) != 3 {
					t.Errorf("expected 3 players, got %d", len(entry.TeamEntry.Players))
				}
				if entry.TeamEntry.MinPlayers != 2 {
					t.Errorf("expected min players 2, got %d", entry.TeamEntry.MinPlayers)
				}
				if entry.TeamEntry.MaxPlayers != 4 {
					t.Errorf("expected max players 4, got %d", entry.TeamEntry.MaxPlayers)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, err := os.ReadFile(tt.file)
			if err != nil {
				t.Fatalf("failed to read test file: %v", err)
			}

			var tournament Tournament
			if err := json.Unmarshal(data, &tournament); err != nil {
				t.Fatalf("failed to unmarshal tournament: %v", err)
			}

			tt.validate(t, &tournament)
		})
	}
}
