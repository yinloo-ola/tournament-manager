package tests

import (
	"context"
	"encoding/json"
	"flag"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/xuri/excelize/v2"
	"github.com/yinloo-ola/tournament-manager/endpoint/entry/internal"
)

var update = flag.Bool("update", false, "regenerate golden baselines from Go output")

// fixturePath resolves a testdata file relative to the repo root.
func fixturePath(name string) string {
	cwd, _ := os.Getwd()
	return filepath.Join(cwd, "..", "..", "..", "..", "testdata", name)
}

// goldenDir is the web-side __tests__/golden directory where baselines are committed.
func goldenDir() string {
	cwd, _ := os.Getwd()
	return filepath.Join(cwd, "..", "..", "..", "..", "web", "src", "features", "entry", "__tests__", "golden")
}

// captureRawRows reads every sheet from a workbook with RawCellValue: true,
// returning sheetName → rows ([][]string) exactly as excelize GetRows produces.
func captureRawRows(t *testing.T, fixtureName string) map[string][][]string {
	t.Helper()
	f, err := excelize.OpenFile(fixturePath(fixtureName))
	require.NoError(t, err)
	defer f.Close()

	sheets := f.GetSheetList()
	result := make(map[string][][]string, len(sheets))
	for _, sheet := range sheets {
		rows, err := f.GetRows(sheet, excelize.Options{RawCellValue: true})
		require.NoError(t, err)
		result[sheet] = rows
	}
	return result
}

func writeJSON(t *testing.T, path string, v any) {
	t.Helper()
	data, err := json.MarshalIndent(v, "", "  ")
	require.NoError(t, err)
	data = append(data, '\n')
	require.NoError(t, os.WriteFile(path, data, 0644))
}

func readGolden(t *testing.T, path string) []byte {
	t.Helper()
	data, err := os.ReadFile(path)
	require.NoError(t, err, "golden file %s must exist; run with -update to create", path)
	return data
}

// ---------------------------------------------------------------------------
// Raw-rows baselines (R1): pin readWorkbook to Go's GetRows output.
// ---------------------------------------------------------------------------

func TestGoldenSinglesRawRows(t *testing.T) {
	rows := captureRawRows(t, "Men Singles.xlsx")
	path := filepath.Join(goldenDir(), "singles.rows.json")
	if *update {
		writeJSON(t, path, rows)
		t.Logf("updated %s", path)
		return
	}
	var expected map[string][][]string
	require.NoError(t, json.Unmarshal(readGolden(t, path), &expected))
	assert.Equal(t, expected, rows)
}

func TestGoldenDoublesRawRows(t *testing.T) {
	rows := captureRawRows(t, "Mens Doubles.xlsx")
	path := filepath.Join(goldenDir(), "doubles.rows.json")
	if *update {
		writeJSON(t, path, rows)
		t.Logf("updated %s", path)
		return
	}
	var expected map[string][][]string
	require.NoError(t, json.Unmarshal(readGolden(t, path), &expected))
	assert.Equal(t, expected, rows)
}

func TestGoldenTeamRawRows(t *testing.T) {
	rows := captureRawRows(t, "Mens Team.xlsx")
	path := filepath.Join(goldenDir(), "team.rows.json")
	if *update {
		writeJSON(t, path, rows)
		t.Logf("updated %s", path)
		return
	}
	var expected map[string][][]string
	require.NoError(t, json.Unmarshal(readGolden(t, path), &expected))
	assert.Equal(t, expected, rows)
}

// ---------------------------------------------------------------------------
// Importer golden baselines (R2–R4): pin TS importers to Go's Entry[] output.
// ---------------------------------------------------------------------------

func TestGoldenSinglesImport(t *testing.T) {
	f, err := os.Open(fixturePath("Men Singles.xlsx"))
	require.NoError(t, err)
	defer f.Close()
	entries, err := internal.ImportSinglesEntries(context.Background(), f)
	require.NoError(t, err)
	path := filepath.Join(goldenDir(), "singles.golden.json")
	if *update {
		writeJSON(t, path, entries)
		t.Logf("updated %s", path)
		return
	}
	var expected []map[string]any
	require.NoError(t, json.Unmarshal(readGolden(t, path), &expected))
	actualJSON, _ := json.MarshalIndent(entries, "", "  ")
	expectedJSON, _ := json.MarshalIndent(expected, "", "  ")
	assert.JSONEq(t, string(expectedJSON), string(actualJSON))
}

func TestGoldenDoublesImport(t *testing.T) {
	f, err := os.Open(fixturePath("Mens Doubles.xlsx"))
	require.NoError(t, err)
	defer f.Close()
	entries, err := internal.ImportDoublesEntries(context.Background(), f)
	require.NoError(t, err)
	path := filepath.Join(goldenDir(), "doubles.golden.json")
	if *update {
		writeJSON(t, path, entries)
		t.Logf("updated %s", path)
		return
	}
	var expected []map[string]any
	require.NoError(t, json.Unmarshal(readGolden(t, path), &expected))
	actualJSON, _ := json.MarshalIndent(entries, "", "  ")
	expectedJSON, _ := json.MarshalIndent(expected, "", "  ")
	assert.JSONEq(t, string(expectedJSON), string(actualJSON))
}

func TestGoldenTeamImport(t *testing.T) {
	f, err := os.Open(fixturePath("Mens Team.xlsx"))
	require.NoError(t, err)
	defer f.Close()
	entries, err := internal.ImportTeamEntries(context.Background(), f, 3, 3)
	require.NoError(t, err)
	path := filepath.Join(goldenDir(), "team.golden.json")
	if *update {
		writeJSON(t, path, entries)
		t.Logf("updated %s", path)
		return
	}
	var expected []map[string]any
	require.NoError(t, json.Unmarshal(readGolden(t, path), &expected))
	actualJSON, _ := json.MarshalIndent(entries, "", "  ")
	expectedJSON, _ := json.MarshalIndent(expected, "", "  ")
	assert.JSONEq(t, string(expectedJSON), string(actualJSON))
}