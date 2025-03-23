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

var header = []string{"SN", "Player", "Seeding", "Club", "Date Of Birth", "Gender"}

const sheetName = "entries"

func ImportSinglesEntries(ctx context.Context, xlsxReader io.Reader) ([]model.Entry, error) {
	file, err := excelize.OpenReader(xlsxReader)
	if err != nil {
		return nil, fmt.Errorf("failed to open reader: %w", err)
	}

	rows, err := file.GetRows(sheetName, excelize.Options{
		RawCellValue: true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get rows: %w", err)
	}

	entries := make([]model.Entry, 0, len(rows))
	for _, row := range rows[1:] {
		if len(row) < len(header) {
			continue
		}
		name := strings.TrimSpace(row[1])
		seedingStr := row[2]
		club := row[3]
		dobStr := strings.TrimSpace(row[4])
		gender := strings.TrimSpace(row[5])
		seeding := 0
		if strings.TrimSpace(seedingStr) != "" {
			seeding, err = strconv.Atoi(seedingStr)
			if err != nil {
				return nil, fmt.Errorf("failed to parse seeding: %w", err)
			}
		}

		entry := model.Entry{
			EntryType: model.Singles,
			Club:      pointer.OrNil(club),
			Seeding:   pointer.OrNil(seeding),
			SinglesEntry: &model.SinglesEntry{
				Player: model.Player{
					Name:        name,
					DateOfBirth: dobStr,
					Gender:      gender,
				},
			},
		}
		entries = append(entries, entry)
	}

	return entries, nil
}
