package internal

import (
	"bytes"
	"flag"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/yinloo-ola/tournament-manager/model"
)

var chartOracleUpdate = flag.Bool("update-chart", false, "regenerate chart golden baseline from Go output")

func chartGoldenDir() string {
	cwd, _ := os.Getwd()
	return filepath.Join(cwd, "..", "..", "..", "web", "src", "features", "roundrobin", "excel", "__tests__", "golden")
}

// buildChartOracleTournament constructs a tournament with 2 categories (MS, MD),
// each with 2 groups of entries (Singles for MS, Doubles for MD). Entries have
// clubs to exercise the "(club)" suffix in player names.
func buildChartOracleTournament() model.Tournament {
	club1 := "NYC"
	club2 := "LA"
	return model.Tournament{
		Name: "Test Tournament",
		Categories: []model.Category{
			{
				Name:      "Men's Singles",
				ShortName: "MS",
				EntryType: model.Singles,
				Entries: []model.Entry{
					singlesEntry("Alice", &club1),
					singlesEntry("Bob", nil),
					singlesEntry("Charlie", &club2),
					singlesEntry("Diana", nil),
				},
				Groups: []model.Group{
					{EntriesIdx: []int{0, 1, 2, 3}},
					{EntriesIdx: []int{0, 1}},
				},
			},
			{
				Name:      "Mixed Doubles",
				ShortName: "MD",
				EntryType: model.Doubles,
				Entries: []model.Entry{
					doublesEntry("Alice", "Bob"),
					doublesEntry("Charlie", "Diana"),
					doublesEntry("Eve", "Frank"),
					doublesEntry("Grace", "Henry"),
				},
				Groups: []model.Group{
					{EntriesIdx: []int{0, 1}},
					{EntriesIdx: []int{2, 3}},
				},
			},
		},
	}
}

func singlesEntry(name string, club *string) model.Entry {
	return model.Entry{
		EntryType: model.Singles,
		Club:      club,
		SinglesEntry: &model.SinglesEntry{
			Player: model.Player{Name: name, DateOfBirth: "2000-01-01", Gender: "M"},
		},
	}
}

func doublesEntry(p1, p2 string) model.Entry {
	return model.Entry{
		EntryType: model.Doubles,
		DoublesEntry: &model.DoublesEntry{
			Players: [2]model.Player{
				{Name: p1, DateOfBirth: "2000-01-01", Gender: "M"},
				{Name: p2, DateOfBirth: "2000-01-01", Gender: "F"},
			},
		},
	}
}

func TestOracleCreateRobinCharts(t *testing.T) {
	tournament := buildChartOracleTournament()

	ioWriter, err := CreateRobinCharts(tournament)
	require.NoError(t, err)

	var buf bytes.Buffer
	err = ioWriter.Write(&buf)
	require.NoError(t, err)

	path := filepath.Join(chartGoldenDir(), "chart.golden.xlsx")
	if *chartOracleUpdate {
		require.NoError(t, os.MkdirAll(filepath.Dir(path), 0755))
		require.NoError(t, os.WriteFile(path, buf.Bytes(), 0644))
		t.Logf("updated %s (%d bytes)", path, buf.Len())
		return
	}

	// Verify the golden file exists and matches
	data, err := os.ReadFile(path)
	require.NoError(t, err, "golden file %s must exist; run with -update-chart to create", path)
	require.Equal(t, len(data), buf.Len(), "golden chart .xlsx size mismatch")
	// Exact byte comparison — tealeg/xlsx is deterministic (no random colors)
	require.True(t, bytes.Equal(data, buf.Bytes()), "golden chart .xlsx bytes must match Go output")
}