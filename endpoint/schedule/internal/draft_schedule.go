package internal

import (
	"fmt"
	"log/slog"
	"time"

	"github.com/xuri/excelize/v2"
	"github.com/yinloo-ola/tournament-manager/model"
	"github.com/yinloo-ola/tournament-manager/utils/color"
	"github.com/yinloo-ola/tournament-manager/utils/pointer"
)

const matchesSheetPassword = "12345654321"
const scheduleSheetName = "schedule"
const matchesSheetName = "matches"
const tournamentInfoSheetName = "Tournament Info"

// Sheet name format for category entries
func categoryEntriesSheetName(shortName string) string {
	return fmt.Sprintf("entries_%s", shortName)
}

func CreateDraftSchedule(tournament model.Tournament) (*excelize.File, error) {
	schedule, err := scheduleMatches(tournament)
	if err != nil {
		return nil, fmt.Errorf("fail to schedule matches: %w", err)
	}
	colorMap := generateCategoryGroupColorMap(tournament)

	book := excelize.NewFile()
	defer book.Close() // Ensure the book is closed

	// Populate the individual category entry sheets
	err = populateCategoryEntrySheets(book, tournament)
	if err != nil {
		return nil, fmt.Errorf("fail to populate category entries: %w", err)
	}

	// Populate the main schedule and matches sheets
	if err := populateSchedule(book, schedule, colorMap); err != nil {
		return nil, fmt.Errorf("fail to populate schedule/matches: %w", err)
	}

	// Populate the tournament info sheet
	if err := populateTournamentInfoSheet(book, tournament); err != nil {
		return nil, fmt.Errorf("fail to populate tournament info: %w", err)
	}

	// Set active sheet and delete default
	book.SetActiveSheet(1) // Assuming schedule is the first sheet we want active
	if err := book.DeleteSheet("Sheet1"); err != nil {
		// slog.Warn("Failed to delete default Sheet1", "error", err) // Log warning instead of erroring out
	}

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

// populateSchedule populates the main schedule and matches tabs
func populateSchedule(book *excelize.File, schedule model.Schedule, colorMap map[string]string) error {
	// Create sheets for schedule and matches
	if _, err := book.NewSheet(scheduleSheetName); err != nil {
		return fmt.Errorf("fail to add sheet %s: %w", scheduleSheetName, err)
	}
	if _, err := book.NewSheet(matchesSheetName); err != nil {
		return fmt.Errorf("fail to add sheet %s: %w", "schedule", err)
	}

	// Retrieve necessary styles
	dtStyleID, err := getDateTimeStyle(book)
	if err != nil {
		return fmt.Errorf("fail to get date time style: %w", err)
	}
	headerStyleID, err := getHeaderStyle(book)
	if err != nil {
		return fmt.Errorf("fail to get header style: %w", err)
	}

	// Prepare header for the schedule sheet
	tableCount := schedule.MaxTableCount()
	row := 1
	cell := 'A'
	book.SetCellStr(scheduleSheetName, currentCell(row, cell), "Date/Time")
	for i := 0; i < tableCount; i++ {
		cell++
		book.SetCellStr(scheduleSheetName, currentCell(row, cell), fmt.Sprintf("T%d", i+1))
	}

	// Prepare header for the matches sheet
	row = 1
	cell = 'A'
	headers := []string{"SN", "Category", "Round", "Group", "KO Round", "Match", "Date Time", "Table", "EntryID1", "EntryID2"}
	for _, h := range headers {
		book.SetCellStr(matchesSheetName, currentCell(row, cell), h)
		cell++
	}
	if err = book.SetCellStyle(matchesSheetName, currentCell(1, 'A'), currentCell(1, cell-1), headerStyleID); err != nil {
		return fmt.Errorf("fail to set style: %w", err)
	}

	// Populate data for schedule and matches
	sn := 1
	matchesRow := 2
	for slotIdx, slot := range schedule.TimeSlots {
		startTime, _ := slot.StartTimeAndDuration()
		book.SetCellValue(scheduleSheetName, currentCell(slotIdx+2, 'A'), startTime)
		// Apply header style to schedule sheet based on current table count
		book.SetCellStyle(scheduleSheetName, "A1", currentCell(1, 'A'+rune(len(slot.Tables))), headerStyleID)

		for tableIdx, match := range slot.Tables {
			if match == nil {
				continue
			}
			// Populate matches sheet row
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

			book.SetCellInt(matchesSheetName, currentCell(matchesRow, 'I'), match.Entry1ID) // Populate EntryID1
			book.SetCellInt(matchesSheetName, currentCell(matchesRow, 'J'), match.Entry2ID) // Populate EntryID2

			matchesRow++

			// Populate schedule sheet cell with match hyperlink and style
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

	// Finalize workbook configuration
	if err = book.SetCellStyle(scheduleSheetName, "A2", currentCell(len(schedule.TimeSlots)+1, 'A'), dtStyleID); err != nil {
		return fmt.Errorf("fail to set style: %w", err)
	}
	if err = book.SetColWidth(scheduleSheetName, "A", "A", 16.0); err != nil {
		return fmt.Errorf("fail to set col width: %w", err)
	}
	if err = book.SetColWidth(matchesSheetName, "G", "G", 16.0); err != nil {
		return fmt.Errorf("fail to set col width: %w", err)
	}
	if err = book.SetColWidth(matchesSheetName, "I", "J", 15.0); err != nil {
		return fmt.Errorf("fail to set col width: %w", err)
	}
	if err = book.SetColWidth(matchesSheetName, "B", "B", 15.0); err != nil {
		return fmt.Errorf("fail to set col width: %w", err)
	}
	book.ProtectSheet(matchesSheetName, &excelize.SheetProtectionOptions{
		Password:            matchesSheetPassword,
		SelectLockedCells:   true,
		SelectUnlockedCells: true,
		EditScenarios:       false, // Other protection options as needed
	})
	return nil
}

// populateTournamentInfoSheet creates and populates the Tournament Info sheet
func populateTournamentInfoSheet(book *excelize.File, tournament model.Tournament) error {
	if _, err := book.NewSheet(tournamentInfoSheetName); err != nil {
		return fmt.Errorf("fail to add sheet %s: %w", tournamentInfoSheetName, err)
	}

	headerStyleID, err := getHeaderStyle(book)
	if err != nil {
		return fmt.Errorf("fail to get header style for info sheet: %w", err)
	}

	row := 1
	// Tournament Details
	book.SetCellStr(tournamentInfoSheetName, currentCell(row, 'A'), "Tournament Name")
	book.SetCellStr(tournamentInfoSheetName, currentCell(row, 'B'), tournament.Name)
	row++
	book.SetCellStr(tournamentInfoSheetName, currentCell(row, 'A'), "Number of Tables")
	book.SetCellInt(tournamentInfoSheetName, currentCell(row, 'B'), tournament.NumTables)
	row++
	book.SetCellStr(tournamentInfoSheetName, currentCell(row, 'A'), "Start Time")
	book.SetCellValue(tournamentInfoSheetName, currentCell(row, 'B'), time.Time(tournament.StartTime))
	dtStyleID, err := getDateTimeStyle(book) // Reuse date/time style
	if err != nil {
		return fmt.Errorf("fail to get date time style for info sheet: %w", err)
	}
	book.SetCellStyle(tournamentInfoSheetName, currentCell(row, 'B'), currentCell(row, 'B'), dtStyleID)
	row += 2 // Add a blank row

	// Category Details Header
	categoryHeaderRow := row
	cell := 'A'
	categoryHeaders := []string{
		"Category Name", "Short Name", "Entry Type", "Duration (Mins)",
		"Entries/Grp Main", "Entries/Grp Remainder", "Qualified/Group",
		"Min Players/Entry", "Max Players/Entry",
	}
	for _, h := range categoryHeaders {
		book.SetCellStr(tournamentInfoSheetName, currentCell(row, cell), h)
		cell++
	}
	if err = book.SetCellStyle(tournamentInfoSheetName, currentCell(categoryHeaderRow, 'A'), currentCell(categoryHeaderRow, cell-1), headerStyleID); err != nil {
		return fmt.Errorf("fail to set category header style: %w", err)
	}
	row++

	// Category Details Data
	for _, category := range tournament.Categories {
		cell = 'A'
		book.SetCellStr(tournamentInfoSheetName, currentCell(row, cell), category.Name)
		cell++
		book.SetCellStr(tournamentInfoSheetName, currentCell(row, cell), category.ShortName)
		cell++
		book.SetCellStr(tournamentInfoSheetName, currentCell(row, cell), string(category.EntryType))
		cell++
		book.SetCellInt(tournamentInfoSheetName, currentCell(row, cell), category.DurationMinutes)
		cell++
		book.SetCellInt(tournamentInfoSheetName, currentCell(row, cell), category.EntriesPerGrpMain)
		cell++
		book.SetCellInt(tournamentInfoSheetName, currentCell(row, cell), category.EntriesPerGrpRemainder)
		cell++
		book.SetCellInt(tournamentInfoSheetName, currentCell(row, cell), category.NumQualifiedPerGroup)
		cell++
		if category.MinPlayers != nil {
			book.SetCellInt(tournamentInfoSheetName, currentCell(row, cell), *category.MinPlayers)
		}
		cell++
		if category.MaxPlayers != nil {
			book.SetCellInt(tournamentInfoSheetName, currentCell(row, cell), *category.MaxPlayers)
		}
		row++
	}

	// Set column widths
	book.SetColWidth(tournamentInfoSheetName, "A", "C", 20)
	book.SetColWidth(tournamentInfoSheetName, "D", "I", 18)

	return nil
}

// populateCategoryEntrySheets creates and populates sheets for each category's entries
func populateCategoryEntrySheets(book *excelize.File, tournament model.Tournament) error {
	headerStyleID, err := getHeaderStyle(book)
	if err != nil {
		return fmt.Errorf("fail to get header style for entry sheets: %w", err)
	}

	for catIdx := range tournament.Categories {
		// Use pointer to category to ensure stable entry pointers later
		category := &tournament.Categories[catIdx]
		sheetName := categoryEntriesSheetName(category.ShortName)
		if _, err := book.NewSheet(sheetName); err != nil {
			return fmt.Errorf("fail to add sheet %s: %w", sheetName, err)
		}

		// Headers
		row := 1
		cell := 'A'
		entryHeaders := []string{
			"Entry ID", "Team Name", "Seeding", "Club",
			"Player SN", "Player Name", "Player DOB", "Player Gender",
		}
		for _, h := range entryHeaders {
			book.SetCellStr(sheetName, currentCell(row, cell), h)
			cell++
		}
		if err = book.SetCellStyle(sheetName, currentCell(1, 'A'), currentCell(1, cell-1), headerStyleID); err != nil {
			return fmt.Errorf("fail to set entry header style for %s: %w", sheetName, err)
		}
		row++

		// Data
		entryID := 1
		playerSN := 1
		// Use index to get pointer to entry within the original slice
		for entryIdx := range category.Entries {
			entry := &category.Entries[entryIdx] // Get pointer to the actual entry
			var players []model.Player
			teamName := ""

			switch entry.EntryType {
			case model.Singles:
				if entry.SinglesEntry != nil {
					players = []model.Player{entry.SinglesEntry.Player}
				}
			case model.Doubles:
				if entry.DoublesEntry != nil {
					players = entry.DoublesEntry.Players[:]
				}
			case model.Team:
				if entry.TeamEntry != nil {
					players = entry.TeamEntry.Players
					teamName = entry.TeamEntry.TeamName
				}
			}

			for _, player := range players {
				cell = 'A'
				book.SetCellInt(sheetName, currentCell(row, cell), entryID)
				cell++
				book.SetCellStr(sheetName, currentCell(row, cell), teamName) // Blank for Singles/Doubles
				cell++
				if entry.Seeding != nil {
					book.SetCellInt(sheetName, currentCell(row, cell), *entry.Seeding)
				}
				cell++
				if entry.Club != nil {
					book.SetCellStr(sheetName, currentCell(row, cell), *entry.Club)
				}
				cell++
				book.SetCellInt(sheetName, currentCell(row, cell), playerSN)
				cell++
				book.SetCellStr(sheetName, currentCell(row, cell), player.Name)
				cell++
				book.SetCellStr(sheetName, currentCell(row, cell), player.DateOfBirth)
				cell++
				book.SetCellStr(sheetName, currentCell(row, cell), player.Gender)
				cell++

				playerSN++
				row++
			}
			entryID++
		}

		// Set column widths
		book.SetColWidth(sheetName, "A", "A", 8)
		book.SetColWidth(sheetName, "B", "B", 20)
		book.SetColWidth(sheetName, "C", "D", 10)
		book.SetColWidth(sheetName, "E", "E", 10)
		book.SetColWidth(sheetName, "F", "F", 25)
		book.SetColWidth(sheetName, "G", "H", 15)
	}

	// Return nil error on success
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

func scheduleMatches(tournament model.Tournament) (model.Schedule, error) {
	schedule := model.Schedule{
		StartTime: time.Time(tournament.StartTime),
	}
	nextStartTime := time.Time(tournament.StartTime)

	// Schedule Group Stage
	for catIdx := range tournament.Categories {
		category := &tournament.Categories[catIdx] // Use pointer
		slots := getSlotsForCategoryGroup(*category, tournament.NumTables, nextStartTime)
		if len(slots) == 0 {
			slog.Info("No group slots generated for category", "category", category.Name)
			continue // Skip if no group matches
		}
		schedule.TimeSlots = append(schedule.TimeSlots, slots...)
		lastStartTime, _ := slots[len(slots)-1].StartTimeAndDuration()
		nextStartTime = lastStartTime.Add(time.Duration(category.DurationMinutes) * time.Minute)
	}

	// Schedule Knockout Stage
	for catIdx := range tournament.Categories {
		category := &tournament.Categories[catIdx] // Use pointer
		if len(category.KnockoutRounds) == 0 {
			continue // Skip if no knockout rounds
		}
		slots := getSlotsForCategoryKnockout(*category, tournament.NumTables, nextStartTime)
		if len(slots) == 0 {
			slog.Info("No knockout slots generated for category", "category", category.Name)
			continue // Should not happen if KnockoutRounds exist, but safety check
		}
		schedule.TimeSlots = append(schedule.TimeSlots, slots...)
		// Update nextStartTime based on the last scheduled knockout match for this category
		lastStartTime, _ := slots[len(slots)-1].StartTimeAndDuration()
		nextStartTime = lastStartTime.Add(time.Duration(category.DurationMinutes) * time.Minute)
	}

	return schedule, nil
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
