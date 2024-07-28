package model

import "time"

type TimeSlot struct {
	Tables []*Match // nil means table not allocated to any match yet
}
type Schedule struct {
	StartTime time.Time
	TimeSlots []TimeSlot
}

func (slot *TimeSlot) IsEmpty() bool {
	return len(slot.FreeTables()) == len(slot.Tables)
}

func (slot *TimeSlot) IsFull() bool {
	return len(slot.FreeTables()) == 0
}

func (slot *TimeSlot) FreeTables() []int {
	freeTables := make([]int, 0, len(slot.Tables))
	for t, table := range slot.Tables {
		if table == nil {
			freeTables = append(freeTables, t)
		}
	}
	return freeTables
}

func (slot *TimeSlot) StartTimeAndDuration() (time.Time, int) {
	var t time.Time = time.Date(3000, time.January, 1, 0, 0, 0, 0, time.Local)
	var d int
	for _, match := range slot.Tables {
		if match == nil {
			continue
		}
		if match.StartTime.Before(t) {
			t = match.StartTime
		}
		if match.DurationMinutes > d {
			d = match.DurationMinutes
		}
	}
	return t, d
}

func (slot *TimeSlot) HasDifferentStartTime() bool {
	var t time.Time
	for _, match := range slot.Tables {
		if match == nil {
			continue
		}
		if t.IsZero() {
			t = match.StartTime
			continue
		}
		if !match.StartTime.Equal(t) {
			return true
		}
	}
	return false
}

func (slot *TimeSlot) HasDifferentDuration() bool {
	var d int
	for _, match := range slot.Tables {
		if match == nil {
			continue
		}
		if d == 0 {
			d = match.DurationMinutes
			continue
		}
		if match.DurationMinutes != d {
			return true
		}
	}
	return false
}
