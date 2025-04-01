package utils

import (
	"bytes"

	"github.com/xuri/excelize/v2"
)

func GenerateMockSinglesExcel() (*bytes.Buffer, error) {
	f := excelize.NewFile()
	defer f.Close()

	// Create sheet and headers
	index, _ := f.NewSheet("entries")
	f.SetActiveSheet(index)
	f.SetSheetRow("entries", "A1", &[]interface{}{"SN", "Name", "Club", "Seeding", "Date Of Birth", "Gender"})

	// Add mock entries
	mockEntries := [][]interface{}{
		{1, "Player One", "Club A", 1, "2000-01-01", "M"},
		{2, "Player Two", "Club B", 2, "2001-02-02", "F"},
		{3, "Player Three", "Club C", 3, "2002-03-03", "M"},
	}

	for rowIdx, entry := range mockEntries {
		cell, _ := excelize.CoordinatesToCellName(1, rowIdx+2)
		f.SetSheetRow("entries", cell, &entry)
	}

	buf := new(bytes.Buffer)
	if _, err := f.WriteTo(buf); err != nil {
		return nil, err
	}
	return buf, nil
}
