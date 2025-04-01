package internal

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/yinloo-ola/tournament-manager/model"
)

func Test_getSlotsForCategory(t *testing.T) {
	category := model.Category{
		Name:            "MS",
		DurationMinutes: 30,
		Groups: []model.Group{
			{
				Rounds: [][]model.Match{
					{
						{
							Entry1Idx: 0,
							Entry2Idx: 1,
						},
						{
							Entry1Idx: 2,
							Entry2Idx: 3,
						},
					},
					{
						{
							Entry1Idx: 0,
							Entry2Idx: 2,
						},
						{
							Entry1Idx: 1,
							Entry2Idx: 3,
						},
					},
					{
						{
							Entry1Idx: 1,
							Entry2Idx: 2,
						},
						{
							Entry1Idx: 0,
							Entry2Idx: 3,
						},
					},
				},
			},
			{
				Rounds: [][]model.Match{
					{
						{
							Entry1Idx: 4,
							Entry2Idx: 5,
						},
						{
							Entry1Idx: 6,
							Entry2Idx: 7,
						},
					},
					{
						{
							Entry1Idx: 4,
							Entry2Idx: 6,
						},
						{
							Entry1Idx: 5,
							Entry2Idx: 7,
						},
					},
					{
						{
							Entry1Idx: 5,
							Entry2Idx: 6,
						},
						{
							Entry1Idx: 4,
							Entry2Idx: 7,
						},
					},
				},
			},
			{
				Rounds: [][]model.Match{
					{
						{
							Entry1Idx: 8,
							Entry2Idx: 9,
						},
						{
							Entry1Idx: 10,
							Entry2Idx: 11,
						},
					},
					{
						{
							Entry1Idx: 8,
							Entry2Idx: 10,
						},
						{
							Entry1Idx: 9,
							Entry2Idx: 11,
						},
					},
					{
						{
							Entry1Idx: 9,
							Entry2Idx: 10,
						},
						{
							Entry1Idx: 8,
							Entry2Idx: 11,
						},
					},
				},
			},
		},
	}
	slots := getSlotsForCategoryGroup(category, 3, time.Date(2024, 8, 10, 9, 0, 0, 0, time.Local))
	b, _ := json.Marshal(slots)
	t.Log(string(b))
}
