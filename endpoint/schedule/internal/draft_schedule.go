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
const scheduleSheetName = "schedule"
const matchesSheetName = "matches"

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
	totalNumOfColors := len(tournament.Categories)
	colours := color.GenerateColors(totalNumOfColors, color.Light)
	colorMap := make(map[string]string)
	c := 0
	for _, category := range tournament.Categories {
		colorMap[category.ShortName] = colours[c]
		c++
	}
	return colorMap
}

func populateSchedule(book *excelize.File, schedule model.Schedule, colorMap map[string]string) error {
	_, err := book.NewSheet(scheduleSheetName)
	if err != nil {
		return fmt.Errorf("fail to add sheet %s: %w", "schedule", err)
	}

	_, err = book.NewSheet(matchesSheetName)
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
	book.SetCellStr(scheduleSheetName, currentCell(row, cell), "Date/Time")
	for i := 0; i < tableCount; i++ {
		cell++
		book.SetCellStr(scheduleSheetName, currentCell(row, cell), fmt.Sprintf("T%d", i+1))
	}

	// TODO: matches sheet need to take care of different event types (singles, doubles, team)
	row = 1
	cell = 'A'
	book.SetCellStr(matchesSheetName, currentCell(row, cell), "SN")
	cell++
	book.SetCellStr(matchesSheetName, currentCell(row, cell), "Category")
	cell++
	book.SetCellStr(matchesSheetName, currentCell(row, cell), "Round")
	cell++
	book.SetCellStr(matchesSheetName, currentCell(row, cell), "Group")
	cell++
	book.SetCellStr(matchesSheetName, currentCell(row, cell), "KO Round")
	cell++
	book.SetCellStr(matchesSheetName, currentCell(row, cell), "Match")
	cell++
	book.SetCellStr(matchesSheetName, currentCell(row, cell), "Date Time")
	cell++
	book.SetCellStr(matchesSheetName, currentCell(row, cell), "Table")
	cell++
	book.SetCellStr(matchesSheetName, currentCell(row, cell), "Player1")
	cell++
	book.SetCellStr(matchesSheetName, currentCell(row, cell), "Player1 Club")
	cell++
	book.SetCellStr(matchesSheetName, currentCell(row, cell), "Player1 Seeding")
	cell++
	book.SetCellStr(matchesSheetName, currentCell(row, cell), "Player2")
	cell++
	book.SetCellStr(matchesSheetName, currentCell(row, cell), "Player2 Club")
	cell++
	book.SetCellStr(matchesSheetName, currentCell(row, cell), "Player2 Seeding")

	err = book.SetCellStyle(matchesSheetName, currentCell(1, 'A'), currentCell(1, cell), headerStyleID)
	if err != nil {
		return fmt.Errorf("fail to set style: %w", err)
	}

	sn := 1
	matchesRow := 2
	for slotIdx, slot := range schedule.TimeSlots {
		startTime, _ := slot.StartTimeAndDuration()
		book.SetCellValue(scheduleSheetName, currentCell(slotIdx+2, 'A'), startTime)
		book.SetCellStyle(scheduleSheetName, "A1", currentCell(1, 'A'+rune(len(slot.Tables))), headerStyleID)
		for tableIdx, match := range slot.Tables {
			if match == nil {
				continue
			}
			book.SetCellInt(matchesSheetName, currentCell(matchesRow, 'A'), sn)
			sn++
			book.SetCellStr(matchesSheetName, currentCell(matchesRow, 'B'), match.CategoryShortName)
			if !match.IsKnockout() {
				book.SetCellInt(matchesSheetName, currentCell(matchesRow, 'C'), match.RoundIdx+1)
				book.SetCellInt(matchesSheetName, currentCell(matchesRow, 'D'), match.GroupIdx+1)
			} else {
				book.SetCellInt(matchesSheetName, currentCell(matchesRow, 'E'), match.Round)
				book.SetCellInt(matchesSheetName, currentCell(matchesRow, 'F'), match.MatchIdx+1)
			}
			book.SetCellValue(matchesSheetName, currentCell(matchesRow, 'G'), match.DateTime)
			book.SetCellStr(matchesSheetName, currentCell(matchesRow, 'H'), match.Table)

			book.SetCellStr(matchesSheetName, currentCell(matchesRow, 'I'), match.Entry1.Name())
			if match.Entry1.Club != nil && *match.Entry1.Club != "" {
				book.SetCellStr(matchesSheetName, currentCell(matchesRow, 'J'), *match.Entry1.Club)
			}
			if match.Entry1.Seeding != nil && *match.Entry1.Seeding != 0 {
				book.SetCellInt(matchesSheetName, currentCell(matchesRow, 'K'), *match.Entry1.Seeding)
			}

			book.SetCellStr(matchesSheetName, currentCell(matchesRow, 'L'), match.Entry2.Name())
			if match.Entry2.Club != nil && *match.Entry2.Club != "" {
				book.SetCellStr(matchesSheetName, currentCell(matchesRow, 'M'), *match.Entry2.Club)
			}
			if match.Entry2.Seeding != nil && *match.Entry2.Seeding != 0 {
				book.SetCellInt(matchesSheetName, currentCell(matchesRow, 'N'), *match.Entry2.Seeding)
			}

			matchesRow++

			displayText := match.Name()
			toolTip := fmt.Sprintf("%s vs %s", match.Entry1.Name(), match.Entry2.Name())
			matchLink := fmt.Sprintf("matches!A%d", sn)
			matchStyle, err := getMatchStyle(book, match, colorMap)
			if err != nil {
				return fmt.Errorf("fail to get match style: %w", err)
			}
			matchCell := currentCell(slotIdx+2, 'A'+rune(tableIdx+1))
			book.SetCellStyle(scheduleSheetName, matchCell, matchCell, matchStyle)
			book.SetCellStr(scheduleSheetName, matchCell, displayText)
			book.SetCellHyperLink(scheduleSheetName, matchCell, matchLink, "Location", excelize.HyperlinkOpts{
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

	err = book.SetCellStyle(scheduleSheetName, "A2", currentCell(len(schedule.TimeSlots)+1, 'A'), dtStyleID)
	if err != nil {
		return fmt.Errorf("fail to set style: %w", err)
	}

	err = book.SetColWidth(scheduleSheetName, "A", "A", 16.0)
	if err != nil {
		return fmt.Errorf("fail to set col width: %w", err)
	}

	err = book.SetColWidth(matchesSheetName, "G", "G", 16.0)
	if err != nil {
		return fmt.Errorf("fail to set col width: %w", err)
	}
	err = book.SetColWidth(matchesSheetName, "I", "I", 25.0)
	if err != nil {
		return fmt.Errorf("fail to set col width: %w", err)
	}
	err = book.SetColWidth(matchesSheetName, "L", "L", 25.0)
	if err != nil {
		return fmt.Errorf("fail to set col width: %w", err)
	}

	book.ProtectSheet(matchesSheetName, &excelize.SheetProtectionOptions{
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
	color := colorMap[match.CategoryShortName]
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
		slots := getSlotsForCategoryGroup(category, tournament.NumTables, nextStartTime)
		schedule.TimeSlots = append(schedule.TimeSlots, slots...)
		lastStartTime, _ := slots[len(slots)-1].StartTimeAndDuration()
		nextStartTime = lastStartTime.Add(time.Duration(category.DurationMinutes) * time.Minute)
	}
	for _, category := range tournament.Categories {
		slots := getSlotsForCategoryKnockout(category, tournament.NumTables, nextStartTime)
		schedule.TimeSlots = append(schedule.TimeSlots, slots...)
		lastStartTime, _ := slots[len(slots)-1].StartTimeAndDuration()
		nextStartTime = lastStartTime.Add(time.Duration(category.DurationMinutes) * time.Minute)
	}
	return schedule
}

// getSlotsForCategoryKnockout iterates through the knockout rounds of each category, schedule each match on a table.
// if the timeslot is full, continue scheduling on the next timeslot
func getSlotsForCategoryKnockout(category model.Category, numOfTable int, startTime time.Time) []model.TimeSlot {
	slots := make([]model.TimeSlot, 0)

	for _, round := range category.KnockoutRounds {
		tableIdx := 0 // Start with first table for each round
		for m, match := range round.Matches {
			// Find or create slot for match
			var slotIdx int
			slots, slotIdx = getOrCreateNextSlot(slots, tableIdx, numOfTable)
			matchStartTime := startTime.Add(time.Duration(category.DurationMinutes*slotIdx) * time.Minute)
			// Schedule match
			slots[slotIdx].Tables[tableIdx] = &model.Match{
				Entry1:            match.Entry1,
				Entry2:            match.Entry2,
				DateTime:          matchStartTime,
				DurationMinutes:   category.DurationMinutes,
				Table:             fmt.Sprintf("T%d", tableIdx+1),
				CategoryShortName: category.ShortName,
				GroupIdx:          -1, // No group in knockout
				RoundIdx:          -1,
				Round:             round.Round,
				MatchIdx:          m,
			}
			tableIdx++
			if tableIdx == numOfTable {
				tableIdx = 0
			}
		}
	}

	return slots
}

func getSlotsForCategoryGroup(category model.Category, numOfTable int, startTime time.Time) []model.TimeSlot {
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
					Entry1:            match.Entry1,
					Entry2:            match.Entry2,
					DurationMinutes:   category.DurationMinutes,
					DateTime:          matchStartTime,
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

func getOrCreateNextSlot(slots []model.TimeSlot, table int, numOfTables int) (slotsUpdated []model.TimeSlot, slotIdx int) {
	if len(slots) == 0 {
		slots = append(slots, model.TimeSlot{
			Tables: make([]*model.Match, numOfTables),
		})
		return slots, 0
	}

	if slots[len(slots)-1].Tables[table] == nil {
		return slots, len(slots) - 1
	}

	slots = append(slots, model.TimeSlot{
		Tables: make([]*model.Match, numOfTables),
	})
	return slots, len(slots) - 1
}
