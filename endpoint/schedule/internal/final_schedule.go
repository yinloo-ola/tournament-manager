package internal

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"strconv"
	"strings"

	"github.com/xuri/excelize/v2"
	"github.com/yinloo-ola/tournament-manager/model"
)

func ImportFinalSchedule(ctx context.Context, tournamentXlsxReader io.Reader) (model.Tournament, error) {
	file, err := excelize.OpenReader(tournamentXlsxReader)
	if err != nil {
		return model.Tournament{}, err
	}
	slog.DebugContext(ctx, "sheets", slog.Any("sheets", file.GetSheetList()))
	// TODO: read the excel file
	rows, err := file.GetRows(scheduleSheetName, excelize.Options{
		RawCellValue: true,
	})
	if err != nil {
		return model.Tournament{}, err
	}

	// read first row and store table header into a map for later use
	headerMap := make(map[int]string)
	for i, cell := range rows[0][1:] {
		headerMap[i] = cell
	}
	slog.InfoContext(ctx, "headerMap", slog.Any("headerMap", headerMap))

	// read the rest of the rows, if the first cell is empty or not datetime, skip this row
	rowIdx := 1
	for _, row := range rows[1:] {
		rowIdx++
		if len(strings.TrimSpace(row[0])) == 0 {
			continue
		}
		datetimeFloat, err := strconv.ParseFloat(row[0], 64)
		if err != nil {
			slog.WarnContext(ctx, "not a float", slog.Any("datetime", row[0]), slog.Any("err", err))
			continue
		}
		datetime, err := excelize.ExcelDateToTime(datetimeFloat, false)
		if err != nil {
			slog.WarnContext(ctx, "not a datetime", slog.Any("datetime", row[0]), slog.Any("err", err))
			continue
		}
		slog.DebugContext(ctx, "datetime", slog.Any("datetime", datetime))
		colIdx := 'A'
		for cellIdx, cell := range row[1:] {
			colIdx++
			cellAddr := fmt.Sprintf("%c%d", colIdx, rowIdx)
			hasLink, link, err := file.GetCellHyperLink(scheduleSheetName, cellAddr)
			if err != nil {
				slog.WarnContext(ctx, "GetCellHyperLink failed", slog.Any("cellAddr", cellAddr), slog.Any("err", err))
				continue
			}
			if !hasLink {
				continue
			}
			table := rows[0][cellIdx+1]
			slog.DebugContext(ctx, "cell link",
				slog.Any("cellAddr", cellAddr),
				slog.Any("hasLink", hasLink),
				slog.Any("link", link),
				slog.Any("cell", cell),
				slog.Any("table", table),
				slog.Any("Datetime", datetime),
			)
			// TODO: get match info from the link
		}
	}
	slog.InfoContext(ctx, "rows", slog.Any("rows", rows))
	return model.Tournament{}, nil
}
