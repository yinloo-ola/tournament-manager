package internal

import (
	"fmt"
	"time"

	"github.com/tealeg/xlsx/v3"
	"github.com/yinloo-ola/tournament-manager/endpoint"
	"github.com/yinloo-ola/tournament-manager/model"
)

func CreateDraftSchedule(tournament model.Tournament) (endpoint.IoWriter, error) {
	scheduleMatches(tournament)
	schedule := scheduleMatches(tournament)

	book := xlsx.NewFile()
	scheduleSheet, err := book.AddSheet("schedule")
	if err != nil {
		return nil, fmt.Errorf("fail to add sheet %s: %w", "schedule", err)
	}

	matchSheet, err := book.AddSheet("matches")
	if err != nil {
		return nil, fmt.Errorf("fail to add sheet %s: %w", "schedule", err)
	}

	populateSchedule(scheduleSheet, matchSheet, schedule)
	return book, nil
}

func populateSchedule(scheduleSheet, matchSheet *xlsx.Sheet, schedule model.Schedule) error {
	tableCount := schedule.MaxTableCount()
	scheduleHeader := scheduleSheet.AddRow()
	scheduleHeader.AddCell().SetString("Date/Time")
	for i := 0; i < tableCount; i++ {
		scheduleHeader.AddCell().SetString(fmt.Sprintf("T%d", i+1))
	}

	matchHeader := matchSheet.AddRow()
	matchHeader.AddCell().SetString("SN")
	matchHeader.AddCell().SetString("Category")
	matchHeader.AddCell().SetString("Round")
	matchHeader.AddCell().SetString("Group")
	matchHeader.AddCell().SetString("Date Time")
	matchHeader.AddCell().SetString("Table")
	matchHeader.AddCell().SetString("Player1")
	matchHeader.AddCell().SetString("Player2")

	sn := 1
	for _, slot := range schedule.TimeSlots {
		row := scheduleSheet.AddRow()
		startTime, _ := slot.StartTimeAndDuration()
		row.AddCell().SetDateTime(startTime)
		for m, match := range slot.Tables {
			if match == nil {
				continue
			}
			matchRow := matchSheet.AddRow()
			snCell := matchRow.AddCell()
			snCell.SetInt(sn)
			sn++
			matchRow.AddCell().SetString(match.CategoryShortName)
			matchRow.AddCell().SetInt(match.RoundIdx + 1)
			matchRow.AddCell().SetInt(match.GroupIdx + 1)
			matchRow.AddCell().SetDateTime(match.StartTime)
			matchRow.AddCell().SetInt(m + 1)
			matchRow.AddCell().SetString(match.Player1.Name)
			matchRow.AddCell().SetString(match.Player2.Name)

			matchCell := row.AddCell()
			hyperlink := fmt.Sprintf("#matches!A%d", sn)
			displayText := fmt.Sprintf("%s Grp%d", match.CategoryShortName, match.GroupIdx+1)
			formula := fmt.Sprintf(`HYPERLINK("%s","%s")`, hyperlink, displayText)
			matchCell.SetFormula(formula)
		}
	}

	return nil
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
