package internal

import (
	"context"
	"fmt"
	"strings"

	"github.com/xuri/excelize/v2"
	"github.com/yinloo-ola/tournament-manager/model"
)

// ExportScoresheet exports the scoresheet with the given tournament and template file
func ExportScoresheet(ctx context.Context, tournament model.Tournament, templateFile *excelize.File) (*excelize.File, error) {
	for _, category := range tournament.Categories {
		for grpIdx, grp := range category.Groups {
			for rdIdx, round := range grp.Rounds {
				for _, match := range round {
					match.CategoryShortName = category.ShortName
					match.GroupIdx = grpIdx
					match.RoundIdx = rdIdx
					match.Round = -1
					match.MatchIdx = -1
					if err := AddMatchScoresheet(ctx, tournament.Name, match, templateFile); err != nil {
						return nil, err
					}
				}
			}
		}
		for _, koRound := range category.KnockoutRounds {
			for m, match := range koRound.Matches {
				match.CategoryShortName = category.ShortName
				match.GroupIdx = -1
				match.RoundIdx = -1
				match.Round = koRound.Round
				match.MatchIdx = m
				if err := AddMatchScoresheet(ctx, tournament.Name, match, templateFile); err != nil {
					return nil, err
				}
			}
		}
	}
	return templateFile, nil
}

func AddMatchScoresheet(ctx context.Context, tournamentName string, match model.Match, templateFile *excelize.File) error {
	// The template scoresheet is named by match.CategoryShortName
	templateName := match.CategoryShortName

	// Check if the template sheet exists
	sheets := templateFile.GetSheetList()
	sheetExists := false
	existingIdx := -1
	for i, sheet := range sheets {
		if sheet == templateName {
			sheetExists = true
			existingIdx = i
			break
		}
	}

	if !sheetExists {
		return fmt.Errorf("template sheet '%s' not found", templateName)
	}

	// Create a new sheet name based on the match details
	newSheetName := fmt.Sprintf("%s-Grp%d-Rd%d-%s",
		match.CategoryShortName,
		match.GroupIdx+1,
		match.RoundIdx+1,
		match.Table,
	)
	if match.IsKnockout() {
		newSheetName = fmt.Sprintf("%s-KO-Rd%d-%d",
			match.CategoryShortName,
			match.Round,
			match.MatchIdx+1,
		)
	}

	// Check if the sheet already exists (avoid duplicates)
	for _, sheet := range sheets {
		if sheet == newSheetName {
			// Sheet already exists, we can skip or return an error
			return nil // Skip if already exists
		}
	}

	// Duplicate the template sheet
	newIdx, err := templateFile.NewSheet(newSheetName)
	if err != nil {
		return fmt.Errorf("failed to create new sheet: %w", err)
	}
	err = templateFile.CopySheet(existingIdx, newIdx)
	if err != nil {
		return fmt.Errorf("failed to copy sheet: %w", err)
	}

	// Copy the template content to the new sheet
	rows, err := templateFile.GetRows(templateName)
	if err != nil {
		return fmt.Errorf("failed to get rows from template: %w", err)
	}

	// Copy all rows and cells from the template to the new sheet
	for rowIdx, row := range rows {
		for colIdx, cellValue := range row {
			cellName, err := excelize.CoordinatesToCellName(colIdx+1, rowIdx+1)
			if err != nil {
				return fmt.Errorf("failed to convert coordinates: %w", err)
			}
			if cellValue == "" {
				continue
			}
			isReplaced := false
			// Replace placeholders in the cell content
			if strings.Contains(cellValue, "{{category}}") {
				cellValue = strings.ReplaceAll(cellValue, "{{category}}", match.CategoryShortName)
				isReplaced = true
			}
			if strings.Contains(cellValue, "{{tournament}}") {
				cellValue = strings.ReplaceAll(cellValue, "{{tournament}}", tournamentName)
				isReplaced = true
			}
			if strings.Contains(cellValue, "{{date}}") {
				cellValue = strings.ReplaceAll(cellValue, "{{date}}", match.DateTime.Format("2006-01-02"))
				isReplaced = true
			}
			if strings.Contains(cellValue, "{{time}}") {
				cellValue = strings.ReplaceAll(cellValue, "{{time}}", match.DateTime.Format("15:04"))
				isReplaced = true
			}
			if strings.Contains(cellValue, "{{table}}") {
				cellValue = strings.ReplaceAll(cellValue, "{{table}}", match.Table)
				isReplaced = true
			}
			if strings.Contains(cellValue, "{{player1}}") {
				cellValue = strings.ReplaceAll(cellValue, "{{player1}}", match.Entry1.Name())
				isReplaced = true
			}
			if strings.Contains(cellValue, "{{player2}}") {
				cellValue = strings.ReplaceAll(cellValue, "{{player2}}", match.Entry2.Name())
				isReplaced = true
			}
			if !isReplaced {
				continue
			}

			// Set the cell value in the new sheet
			if err := templateFile.SetCellValue(newSheetName, cellName, cellValue); err != nil {
				return fmt.Errorf("failed to set cell value: %w", err)
			}
		}
	}
	return nil
}
