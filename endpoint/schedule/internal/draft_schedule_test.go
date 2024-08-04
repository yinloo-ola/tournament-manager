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
							Player1: model.Player{
								Name: "A",
							},
							Player2: model.Player{
								Name: "B",
							},
						},
						{
							Player1: model.Player{
								Name: "C",
							},
							Player2: model.Player{
								Name: "D",
							},
						},
					},
					{
						{
							Player1: model.Player{
								Name: "A",
							},
							Player2: model.Player{
								Name: "C",
							},
						},
						{
							Player1: model.Player{
								Name: "B",
							},
							Player2: model.Player{
								Name: "D",
							},
						},
					},
					{
						{
							Player1: model.Player{
								Name: "B",
							},
							Player2: model.Player{
								Name: "C",
							},
						},
						{
							Player1: model.Player{
								Name: "A",
							},
							Player2: model.Player{
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
							Player1: model.Player{
								Name: "A2",
							},
							Player2: model.Player{
								Name: "B2",
							},
						},
						{
							Player1: model.Player{
								Name: "C2",
							},
							Player2: model.Player{
								Name: "D2",
							},
						},
					},
					{
						{
							Player1: model.Player{
								Name: "A2",
							},
							Player2: model.Player{
								Name: "C2",
							},
						},
						{
							Player1: model.Player{
								Name: "B2",
							},
							Player2: model.Player{
								Name: "D2",
							},
						},
					},
					{
						{
							Player1: model.Player{
								Name: "B2",
							},
							Player2: model.Player{
								Name: "C2",
							},
						},
						{
							Player1: model.Player{
								Name: "A2",
							},
							Player2: model.Player{
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
							Player1: model.Player{
								Name: "A3",
							},
							Player2: model.Player{
								Name: "B3",
							},
						},
						{
							Player1: model.Player{
								Name: "C3",
							},
							Player2: model.Player{
								Name: "D3",
							},
						},
					},
					{
						{
							Player1: model.Player{
								Name: "A3",
							},
							Player2: model.Player{
								Name: "C3",
							},
						},
						{
							Player1: model.Player{
								Name: "B3",
							},
							Player2: model.Player{
								Name: "D3",
							},
						},
					},
					{
						{
							Player1: model.Player{
								Name: "B3",
							},
							Player2: model.Player{
								Name: "C3",
							},
						},
						{
							Player1: model.Player{
								Name: "A3",
							},
							Player2: model.Player{
								Name: "D3",
							},
						},
					},
				},
			},
		},
	}
	slots := getSlotsForCategory(category, 3, time.Date(2024, 8, 10, 9, 0, 0, 0, time.Local))
	b, _ := json.Marshal(slots)
	t.Log(string(b))
}
