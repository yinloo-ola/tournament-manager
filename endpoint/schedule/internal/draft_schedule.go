package internal

import (
	"fmt"
	"time"

	"github.com/xuri/excelize/v2"
	"github.com/yinloo-ola/tournament-manager/model"
	"github.com/yinloo-ola/tournament-manager/utils/color"
	"github.com/yinloo-ola/tournament-manager/utils/pointer"
)

const matchesSheetPassword = "12345654321"

func CreateDraftSchedule(tournament model.Tournament) (*excelize.File, error) {
	schedule := scheduleMatches(tournament)
	colorMap := generateCategoryGroupColorMap(tournament)

	book := excelize.NewFile()
	populateSchedule(book, schedule, colorMap)

	return book, nil
}

func currentCell(row int, col rune) string {
	return fmt.Sprintf("%s%d", string(col), row)
}

func generateCategoryGroupColorMap(tournament model.Tournament) map[string]string {
	totalNumOfColors := 0
	for _, category := range tournament.Categories {
		totalNumOfColors += len(category.Groups)
	}
	colours := color.GenerateColors(totalNumOfColors, color.Light)
	colorMap := make(map[string]string)
	c := 0
	for _, category := range tournament.Categories {
		for grpIdx := range category.Groups {
			colorMap[fmt.Sprintf("%s-%d", category.ShortName, grpIdx)] = colours[c]
			c++
		}
	}
	return colorMap
}

func populateSchedule(book *excelize.File, schedule model.Schedule, colorMap map[string]string) error {
	scheduleSheet := "schedule"
	_, err := book.NewSheet(scheduleSheet)
	if err != nil {
		return fmt.Errorf("fail to add sheet %s: %w", "schedule", err)
	}

	matchesSheet := "matches"
	_, err = book.NewSheet(matchesSheet)
	if err != nil {
		return fmt.Errorf("fail to add sheet %s: %w", "schedule", err)
	}

	dtStyleID, err := getDateTimeStyle(book)
	if err != nil {
		return fmt.Errorf("fail to get date time style: %w", err)
	}
	headerStyleID, err := getHeaderStyle(book)
	if err != nil {
		return fmt.Errorf("fail to get header style: %w", err)
	}

	tableCount := schedule.MaxTableCount()
	row := 1
	cell := 'A'
	book.SetCellStr(scheduleSheet, currentCell(row, cell), "Date/Time")
	for i := 0; i < tableCount; i++ {
		cell++
		book.SetCellStr(scheduleSheet, currentCell(row, cell), fmt.Sprintf("T%d", i+1))
	}

	row = 1
	cell = 'A'
	book.SetCellStr(matchesSheet, currentCell(row, cell), "SN")
	cell++
	book.SetCellStr(matchesSheet, currentCell(row, cell), "Category")
	cell++
	book.SetCellStr(matchesSheet, currentCell(row, cell), "Round")
	cell++
	book.SetCellStr(matchesSheet, currentCell(row, cell), "Group")
	cell++
	book.SetCellStr(matchesSheet, currentCell(row, cell), "Date Time")
	cell++
	book.SetCellStr(matchesSheet, currentCell(row, cell), "Table")
	cell++
	book.SetCellStr(matchesSheet, currentCell(row, cell), "Player1")
	cell++
	book.SetCellStr(matchesSheet, currentCell(row, cell), "Player2")

	err = book.SetCellStyle(matchesSheet, currentCell(1, 'A'), currentCell(1, cell), headerStyleID)
	if err != nil {
		return fmt.Errorf("fail to set style: %w", err)
	}

	sn := 1
	matchesRow := 2
	for slotIdx, slot := range schedule.TimeSlots {
		startTime, _ := slot.StartTimeAndDuration()
		book.SetCellValue(scheduleSheet, currentCell(slotIdx+2, 'A'), startTime)
		book.SetCellStyle(scheduleSheet, "A1", currentCell(1, 'A'+rune(len(slot.Tables))), headerStyleID)
		for tableIdx, match := range slot.Tables {
			if match == nil {
				continue
			}
			book.SetCellInt(matchesSheet, currentCell(matchesRow, 'A'), sn)
			sn++
			book.SetCellStr(matchesSheet, currentCell(matchesRow, 'B'), match.CategoryShortName)
			book.SetCellInt(matchesSheet, currentCell(matchesRow, 'C'), match.RoundIdx+1)
			book.SetCellInt(matchesSheet, currentCell(matchesRow, 'D'), match.GroupIdx+1)
			book.SetCellValue(matchesSheet, currentCell(matchesRow, 'E'), match.StartTime)
			book.SetCellStr(matchesSheet, currentCell(matchesRow, 'F'), match.Table)
			book.SetCellStr(matchesSheet, currentCell(matchesRow, 'G'), match.Player1.Name)
			book.SetCellStr(matchesSheet, currentCell(matchesRow, 'H'), match.Player2.Name)
			matchesRow++

			displayText := fmt.Sprintf("%s Grp%d", match.CategoryShortName, match.GroupIdx+1)
			toolTip := fmt.Sprintf("%s vs %s", match.Player1.Name, match.Player2.Name)
			matchLink := fmt.Sprintf("matches!A%d", sn)
			matchStyle, err := getMatchStyle(book, match, colorMap)
			if err != nil {
				return fmt.Errorf("fail to get match style: %w", err)
			}
			matchCell := currentCell(slotIdx+2, 'A'+rune(tableIdx+1))
			book.SetCellStyle(scheduleSheet, matchCell, matchCell, matchStyle)
			book.SetCellStr(scheduleSheet, matchCell, displayText)
			book.SetCellHyperLink(scheduleSheet, matchCell, matchLink, "Location", excelize.HyperlinkOpts{
				Display: pointer.Of(displayText),
				Tooltip: pointer.Of(toolTip),
			})
		}
	}

	book.SetActiveSheet(1)
	err = book.DeleteSheet("Sheet1")
	if err != nil {
		return fmt.Errorf("fail to delete sheet %s: %w", "Sheet1", err)
	}

	err = book.SetCellStyle(scheduleSheet, "A2", currentCell(len(schedule.TimeSlots)+1, 'A'), dtStyleID)
	if err != nil {
		return fmt.Errorf("fail to set style: %w", err)
	}

	err = book.SetColWidth(scheduleSheet, "A", "A", 16.0)
	if err != nil {
		return fmt.Errorf("fail to set col width: %w", err)
	}

	err = book.SetColWidth(matchesSheet, "E", "E", 16.0)
	if err != nil {
		return fmt.Errorf("fail to set col width: %w", err)
	}
	err = book.SetColWidth(matchesSheet, "G", "H", 25.0)
	if err != nil {
		return fmt.Errorf("fail to set col width: %w", err)
	}

	book.ProtectSheet(matchesSheet, &excelize.SheetProtectionOptions{
		Password:            matchesSheetPassword,
		SelectLockedCells:   true,
		SelectUnlockedCells: true,
	})
	return nil
}

func getHeaderStyle(book *excelize.File) (int, error) {
	headerStyleID, err := book.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Bold: true,
		},
		Fill: excelize.Fill{
			Type:    "pattern",
			Pattern: 1, // Solid fill
			Color:   []string{"#F2F2F2"},
		},
		Border: []excelize.Border{
			{
				Style: 1,
				Type:  "left",
				Color: "#000000",
			},
			{
				Style: 1,
				Type:  "right",
				Color: "#000000",
			},
			{
				Style: 1,
				Type:  "top",
				Color: "#000000",
			},
			{
				Style: 1,
				Type:  "bottom",
				Color: "#000000",
			},
		},
	})

	if err != nil {
		return 0, fmt.Errorf("fail to create style: %w", err)
	}
	return headerStyleID, nil
}

func getMatchStyle(book *excelize.File, match *model.Match, colorMap map[string]string) (int, error) {
	color := colorMap[fmt.Sprintf("%s-%d", match.CategoryShortName, match.GroupIdx)]
	id, err := book.NewStyle(&excelize.Style{
		Fill: excelize.Fill{
			Type:    "pattern",
			Pattern: 1, // Solid fill
			Color:   []string{color},
		},
		Border: []excelize.Border{
			{
				Style: 1,
				Type:  "left",
				Color: "#000000",
			},
			{
				Style: 1,
				Type:  "right",
				Color: "#000000",
			},
			{
				Style: 1,
				Type:  "top",
				Color: "#000000",
			},
			{
				Style: 1,
				Type:  "bottom",
				Color: "#000000",
			},
		},
	})

	return id, err
}

func getDateTimeStyle(book *excelize.File) (int, error) {
	dateTimeStyleID, err := book.NewStyle(&excelize.Style{
		NumFmt: 22,
		Font: &excelize.Font{
			Bold: true,
		},
		Fill: excelize.Fill{
			Type:    "pattern",
			Pattern: 1, // Solid fill
			Color:   []string{"#F2F2F2"},
		},
		Border: []excelize.Border{
			{
				Style: 1,
				Type:  "left",
				Color: "#000000",
			},
			{
				Style: 1,
				Type:  "right",
				Color: "#000000",
			},
			{
				Style: 1,
				Type:  "top",
				Color: "#000000",
			},
			{
				Style: 1,
				Type:  "bottom",
				Color: "#000000",
			},
		},
	})
	if err != nil {
		return 0, fmt.Errorf("fail to create style: %w", err)
	}
	return dateTimeStyleID, nil
}

func scheduleMatches(tournament model.Tournament) model.Schedule {
	schedule := model.Schedule{
		StartTime: time.Time(tournament.StartTime),
	}
	nextStartTime := time.Time(tournament.StartTime)
	for _, category := range tournament.Categories {
		slots := getSlotsForCategory(category, tournament.NumTables, nextStartTime)
		schedule.TimeSlots = append(schedule.TimeSlots, slots...)
		lastStartTime, _ := slots[len(slots)-1].StartTimeAndDuration()
		nextStartTime = lastStartTime.Add(time.Duration(category.DurationMinutes) * time.Minute)
	}
	return schedule
}

func getSlotsForCategory(category model.Category, numOfTable int, startTime time.Time) []model.TimeSlot {
	slots := make([]model.TimeSlot, 0, 6)

	grpMatchTable := map[int]map[int]int{}
	tableIdx := 0
	for g, grp := range category.Groups {
		numOfMatches := len(grp.Rounds[0])
		grpMatchTable[g] = map[int]int{}
		for m := 0; m < numOfMatches; m++ {
			grpMatchTable[g][m] = tableIdx
			tableIdx++
			if tableIdx == numOfTable {
				tableIdx = 0
			}
		}
	}

	for g, grp := range category.Groups {
		for r, round := range grp.Rounds {
			for m, match := range round {
				tableIdx := grpMatchTable[g][m]
				slotIdx := 0
				slots, slotIdx = getOrCreateSlot(slots, tableIdx, numOfTable)
				matchStartTime := startTime.Add(time.Duration(category.DurationMinutes*slotIdx) * time.Minute)
				slots[slotIdx].Tables[tableIdx] = &model.Match{
					Player1:           match.Player1,
					Player2:           match.Player2,
					DurationMinutes:   category.DurationMinutes,
					StartTime:         matchStartTime,
					Table:             fmt.Sprintf("T%d", tableIdx+1),
					CategoryShortName: category.ShortName,
					GroupIdx:          g,
					RoundIdx:          r,
				}
			}
		}
	}

	return slots
}

func getOrCreateSlot(slots []model.TimeSlot, table int, numOfTables int) (slotsUpdated []model.TimeSlot, slotIdx int) {
	if len(slots) == 0 {
		slots = append(slots, model.TimeSlot{
			Tables: make([]*model.Match, numOfTables),
		})
		return slots, 0
	}
	for s, slot := range slots {
		if slot.Tables[table] == nil {
			return slots, s
		}
	}
	slots = append(slots, model.TimeSlot{
		Tables: make([]*model.Match, numOfTables),
	})
	return slots, len(slots) - 1
}
