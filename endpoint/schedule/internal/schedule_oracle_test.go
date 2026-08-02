package internal

import (
	"encoding/json"
	"flag"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/yinloo-ola/tournament-manager/model"
)

var oracleUpdate = flag.Bool("update", false, "regenerate golden baselines from Go output")

func oracleGoldenDir() string {
	cwd, _ := os.Getwd()
	return filepath.Join(cwd, "..", "..", "..", "web", "src", "features", "schedule", "__tests__", "golden")
}

// ---------------------------------------------------------------------------
// Custom JSON representation that includes ALL Match fields (model.Match has
// json:"-" on CategoryShortName, GroupIdx, RoundIdx, MatchIdx — but the
// scheduler populates them and the TS port must match).
// ---------------------------------------------------------------------------

type oracleMatchJSON struct {
	Entry1Idx         int    `json:"entry1Idx"`
	Entry2Idx         int    `json:"entry2Idx"`
	DateTime          string `json:"datetime"`
	DurationMinutes   int    `json:"durationMinutes"`
	Table             string `json:"table"`
	CategoryShortName string `json:"categoryShortName"`
	GroupIdx          int    `json:"groupIdx"`
	RoundIdx          int    `json:"roundIdx"`
	Round             int    `json:"round"`
	MatchIdx          int    `json:"matchIdx"`
}

type oracleTableJSON struct {
	Match *oracleMatchJSON `json:"match"` // nil → null (empty table)
}

type oracleTimeSlotJSON struct {
	Tables []oracleTableJSON `json:"tables"`
}

type oracleScheduleJSON struct {
	StartTime string             `json:"startTime"`
	TimeSlots []oracleTimeSlotJSON `json:"timeSlots"`
}

func scheduleToOracleJSON(s model.Schedule) oracleScheduleJSON {
	result := oracleScheduleJSON{
		StartTime: s.StartTime.UTC().Format("2006-01-02T15:04:05Z07:00"),
		TimeSlots: make([]oracleTimeSlotJSON, len(s.TimeSlots)),
	}
	for i, slot := range s.TimeSlots {
		tables := make([]oracleTableJSON, len(slot.Tables))
		for j, m := range slot.Tables {
			if m == nil {
				tables[j] = oracleTableJSON{Match: nil}
			} else {
				tables[j] = oracleTableJSON{Match: &oracleMatchJSON{
					Entry1Idx:         m.Entry1Idx,
					Entry2Idx:         m.Entry2Idx,
					DateTime:          m.DateTime.UTC().Format("2006-01-02T15:04:05Z07:00"),
					DurationMinutes:   m.DurationMinutes,
					Table:             m.Table,
					CategoryShortName: m.CategoryShortName,
					GroupIdx:          m.GroupIdx,
					RoundIdx:          m.RoundIdx,
					Round:             m.Round,
					MatchIdx:          m.MatchIdx,
				}}
			}
		}
		result.TimeSlots[i] = oracleTimeSlotJSON{Tables: tables}
	}
	return result
}

// buildOracleTournament constructs a tournament with 2 categories (MS, WS),
// each with 2 groups of 4 entries. Groups have entriesIdx pre-populated; rounds
// are empty (GenerateRoundsForTournament will fill them).
func buildOracleTournament() model.Tournament {
	return model.Tournament{
		Name:      "Schedule Test",
		NumTables: 4,
		StartTime: model.Date(time.Date(2025, 3, 22, 9, 0, 0, 0, time.UTC)),
		Categories: []model.Category{
			{
				Name:                   "Men's Singles",
				ShortName:              "MS",
				EntryType:              model.Singles,
				DurationMinutes:        30,
				EntriesPerGrpMain:      4,
				EntriesPerGrpRemainder: 0,
				NumQualifiedPerGroup:   2,
				Entries:                buildOracleSinglesEntries(8),
				Groups: []model.Group{
					{EntriesIdx: []int{0, 1, 2, 3}},
					{EntriesIdx: []int{4, 5, 6, 7}},
				},
			},
			{
				Name:                   "Women's Singles",
				ShortName:              "WS",
				EntryType:              model.Singles,
				DurationMinutes:        30,
				EntriesPerGrpMain:      4,
				EntriesPerGrpRemainder: 0,
				NumQualifiedPerGroup:   2,
				Entries:                buildOracleSinglesEntries(8),
				Groups: []model.Group{
					{EntriesIdx: []int{0, 1, 2, 3}},
					{EntriesIdx: []int{4, 5, 6, 7}},
				},
			},
		},
	}
}

func buildOracleSinglesEntries(n int) []model.Entry {
	entries := make([]model.Entry, n)
	names := []string{"Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Henry"}
	for i := 0; i < n; i++ {
		name := names[i%len(names)]
		entries[i] = model.Entry{
			EntryType: model.Singles,
			SinglesEntry: &model.SinglesEntry{
				Player: model.Player{
					Name:        name,
					DateOfBirth: "2000-01-01",
					Gender:      "M",
				},
			},
		}
	}
	return entries
}

func TestOracleScheduleMatches(t *testing.T) {
	tournament := buildOracleTournament()

	// Populate group rounds and knockout rounds
	tournament2, err := GenerateRoundsForTournament(tournament)
	require.NoError(t, err)

	// Run the scheduler
	schedule, err := scheduleMatches(tournament2)
	require.NoError(t, err)

	// Serialize to JSON-friendly format (includes all Match fields)
	sj := scheduleToOracleJSON(schedule)

	path := filepath.Join(oracleGoldenDir(), "schedule.golden.json")
	if *oracleUpdate {
		data, _ := json.MarshalIndent(sj, "", "  ")
		data = append(data, '\n')
		require.NoError(t, os.MkdirAll(filepath.Dir(path), 0755))
		require.NoError(t, os.WriteFile(path, data, 0644))
		t.Logf("updated %s", path)
		return
	}

	// Read and compare
	data, err := os.ReadFile(path)
	require.NoError(t, err, "golden file %s must exist; run with -update to create", path)

	var expected oracleScheduleJSON
	require.NoError(t, json.Unmarshal(data, &expected))

	actualJSON, _ := json.MarshalIndent(sj, "", "  ")
	expectedJSON, _ := json.MarshalIndent(expected, "", "  ")
	require.JSONEq(t, string(expectedJSON), string(actualJSON))
}