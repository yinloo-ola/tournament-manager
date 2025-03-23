package internal

import (
	"fmt"
	"strconv"
	"strings"

	xlsx "github.com/tealeg/xlsx/v3"
	"github.com/yinloo-ola/tournament-manager/endpoint"
	"github.com/yinloo-ola/tournament-manager/model"
)

func CreateRobinCharts(tournament model.Tournament) (endpoint.IoWriter, error) {
	book := xlsx.NewFile()
	for _, category := range tournament.Categories {
		sheet, err := book.AddSheet(category.ShortName)
		if err != nil {
			return nil, fmt.Errorf("fail to add sheet %s: %w", category.ShortName, err)
		}
		err = createCategorySheet(tournament.Name, category, sheet)
		if err != nil {
			return nil, fmt.Errorf("createCategorySheet %s failed: %w", tournament.Name, err)
		}
	}
	return book, nil
}

func createCategorySheet(tournamentName string, category model.Category, sheet *xlsx.Sheet) error {
	maxPlayer := 0
	for _, grp := range category.Groups {
		if len(grp.Entries) > maxPlayer {
			maxPlayer = len(grp.Entries)
		}
	}

	createCategoryHeader(maxPlayer, tournamentName, category, sheet)

	for g, grp := range category.Groups {
		c := sheet.AddRow().AddCell()
		c.SetString(fmt.Sprintf("Group %d", g+1))
		c.Merge(1, 0)
		createTableForGroup(grp.Entries, sheet)
	}

	sheet.SetColWidth(1, 1, 4.0)
	sheet.SetColAutoWidth(2, func(s string) float64 {
		return (float64(strings.Count(s, "")))
	})

	for i := 3; i < 3+maxPlayer; i++ {
		sheet.SetColWidth(3, 3+maxPlayer, 12.0)
	}
	sheet.SetColWidth(3+maxPlayer+1, 3+maxPlayer+2, 10)
	return nil
}

func createTableForGroup(grp []model.Entry, sheet *xlsx.Sheet) {
	allBorderStyle := xlsx.NewStyle()
	allBorderStyle.Alignment.Vertical = "center"
	allBorderStyle.ApplyFill = true
	allBorderStyle.Border = *xlsx.NewBorder("thin", "thin", "thin", "thin")

	headerStyle := xlsx.NewStyle()
	headerStyle.Alignment.Vertical = "center"
	headerStyle.Fill.PatternType = "solid"
	headerStyle.Fill.FgColor = "FFA0A0A0"
	headerStyle.Font.Bold = true
	headerStyle.ApplyFill = true
	headerStyle.Border = *xlsx.NewBorder("thin", "thin", "thin", "thin")

	headerStyle2 := xlsx.NewStyle()
	headerStyle2.Alignment.Vertical = "center"
	headerStyle2.Alignment.Horizontal = "center"
	headerStyle2.Fill.PatternType = "solid"
	headerStyle2.Fill.FgColor = "FFA0A0A0"
	headerStyle2.Font.Bold = true
	headerStyle2.ApplyFill = true
	headerStyle2.Border = *xlsx.NewBorder("thin", "thin", "thin", "thin")

	rowHeaderRow := sheet.AddRow()
	rowHeaderRow.AddCell().SetStyle(headerStyle)
	playerCell := rowHeaderRow.AddCell()
	playerCell.SetString("Player")
	playerCell.SetStyle(headerStyle)
	for p := range grp {
		c := rowHeaderRow.AddCell()
		c.SetString(strconv.Itoa(p + 1))
		c.SetStyle(headerStyle2)
	}
	pointCell := rowHeaderRow.AddCell()
	pointCell.SetString("Points")
	pointCell.SetStyle(headerStyle2)

	posCell := rowHeaderRow.AddCell()
	posCell.SetString("Position")
	posCell.SetStyle(headerStyle2)

	for p, player := range grp {
		playerRow := sheet.AddRow()
		cell := playerRow.AddCell()
		cell.SetString(strconv.Itoa(p + 1))
		cell.SetStyle(allBorderStyle)
		playerStr := player.Name()
		if len(*player.Club) > 0 {
			playerStr += fmt.Sprintf(" (%s)", *player.Club)
		}
		playerCell := playerRow.AddCell()
		playerCell.SetString(playerStr)
		playerCell.SetStyle(allBorderStyle)

		for p2 := range grp {
			resultCell := playerRow.AddCell()
			resultCell.SetStyle(allBorderStyle)
			if p2 == p {
				style := xlsx.NewStyle()
				style.Fill.PatternType = "solid"
				style.ApplyFill = true
				style.Border = *xlsx.NewBorder("thin", "thin", "thin", "thin")
				style.Fill.FgColor = "FF000000"
				style.ApplyFill = true
				resultCell.SetStyle(style)
			}
		}
		for i := 0; i < 2; i++ {
			playerRow.AddCell().SetStyle(allBorderStyle)
		}
		playerRow.SetHeight(25)
	}
	sheet.AddRow()
}

func createCategoryHeader(maxPlayer int, tournamentName string, category model.Category, sheet *xlsx.Sheet) {
	cell1 := sheet.AddRow().AddCell()
	cell1.SetString(tournamentName)
	cell1.Merge(maxPlayer+3, 0)
	tournamentNameStyle := xlsx.NewStyle()
	tournamentNameStyle.Font.Bold = true
	tournamentNameStyle.Font.Size = 20
	tournamentNameStyle.Alignment.Horizontal = "center"
	cell1.SetStyle(tournamentNameStyle)
	cell1.Row.SetHeight(30)

	cell2 := sheet.AddRow().AddCell()
	cell2.SetString(category.Name)
	cell2.Merge(maxPlayer+3, 0)
	categoryStyle := xlsx.NewStyle()
	categoryStyle.Font.Bold = true
	categoryStyle.Font.Size = 12
	categoryStyle.Alignment.Horizontal = "center"
	cell2.SetStyle(categoryStyle)
	cell2.Row.SetHeight(20)

	sheet.AddRow().SetHeight(20)
}
