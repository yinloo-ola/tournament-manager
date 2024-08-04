package internal

import (
	"fmt"
	"log/slog"
	"time"

	"github.com/tealeg/xlsx/v3"
	"github.com/yinloo-ola/tournament-manager/endpoint"
	"github.com/yinloo-ola/tournament-manager/model"
)

func CreateDraftSchedule(tournament model.Tournament) (endpoint.IoWriter, error) {
	scheduleMatches(tournament)
	schedule := scheduleMatches(tournament)
	slog.Debug("CreateDraftSchedule", "schedule", schedule)

	book := xlsx.NewFile()
	_, err := book.AddSheet("schedule")
	if err != nil {
		return nil, fmt.Errorf("fail to add sheet %s: %w", "schedule", err)
	}

	return book, nil
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
		for _, round := range grp.Rounds {
			for m, match := range round {
				tableIdx := grpMatchTable[g][m]
				slotIdx := 0
				slots, slotIdx = getOrCreateSlot(slots, tableIdx, numOfTable)
				matchStartTime := startTime.Add(time.Duration(category.DurationMinutes*slotIdx) * time.Minute)
				slots[slotIdx].Tables[tableIdx] = &model.Match{
					Player1:         match.Player1,
					Player2:         match.Player2,
					DurationMinutes: category.DurationMinutes,
					StartTime:       matchStartTime,
					Table:           fmt.Sprintf("T%d", tableIdx+1),
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
