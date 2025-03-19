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
							Entry1: model.Entry{
								Name: "A",
							},
							Entry2: model.Entry{
								Name: "B",
							},
						},
						{
							Entry1: model.Entry{
								Name: "C",
							},
							Entry2: model.Entry{
								Name: "D",
							},
						},
					},
					{
						{
							Entry1: model.Entry{
								Name: "A",
							},
							Entry2: model.Entry{
								Name: "C",
							},
						},
						{
							Entry1: model.Entry{
								Name: "B",
							},
							Entry2: model.Entry{
								Name: "D",
							},
						},
					},
					{
						{
							Entry1: model.Entry{
								Name: "B",
							},
							Entry2: model.Entry{
								Name: "C",
							},
						},
						{
							Entry1: model.Entry{
								Name: "A",
							},
							Entry2: model.Entry{
								Name: "D",
							},
						},
					},
				},
			},
			{
				Rounds: [][]model.Match{
					{
						{
							Entry1: model.Entry{
								Name: "A2",
							},
							Entry2: model.Entry{
								Name: "B2",
							},
						},
						{
							Entry1: model.Entry{
								Name: "C2",
							},
							Entry2: model.Entry{
								Name: "D2",
							},
						},
					},
					{
						{
							Entry1: model.Entry{
								Name: "A2",
							},
							Entry2: model.Entry{
								Name: "C2",
							},
						},
						{
							Entry1: model.Entry{
								Name: "B2",
							},
							Entry2: model.Entry{
								Name: "D2",
							},
						},
					},
					{
						{
							Entry1: model.Entry{
								Name: "B2",
							},
							Entry2: model.Entry{
								Name: "C2",
							},
						},
						{
							Entry1: model.Entry{
								Name: "A2",
							},
							Entry2: model.Entry{
								Name: "D2",
							},
						},
					},
				},
			},
			{
				Rounds: [][]model.Match{
					{
						{
							Entry1: model.Entry{
								Name: "A3",
							},
							Entry2: model.Entry{
								Name: "B3",
							},
						},
						{
							Entry1: model.Entry{
								Name: "C3",
							},
							Entry2: model.Entry{
								Name: "D3",
							},
						},
					},
					{
						{
							Entry1: model.Entry{
								Name: "A3",
							},
							Entry2: model.Entry{
								Name: "C3",
							},
						},
						{
							Entry1: model.Entry{
								Name: "B3",
							},
							Entry2: model.Entry{
								Name: "D3",
							},
						},
					},
					{
						{
							Entry1: model.Entry{
								Name: "B3",
							},
							Entry2: model.Entry{
								Name: "C3",
							},
						},
						{
							Entry1: model.Entry{
								Name: "A3",
							},
							Entry2: model.Entry{
								Name: "D3",
							},
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
