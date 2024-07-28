package model

import "time"

type Tournament struct {
	Name       string     `json:"name"`
	Categories []Category `json:"categories"`
}

type Category struct {
	Name                   string   `json:"name"`
	ShortName              string   `json:"shortName"`
	PlayersPerGrpMain      int      `json:"playersPerGrpMain"`
	PlayersPerGrpRemainder int      `json:"playersPerGrpRemainder"`
	Players                []Player `json:"players"`
	Groups                 []Group  `json:"groups"`
	DurationMinutes        int      `json:"durationMinutes"`
}

type Group struct {
	Players []Player  `json:"players"`
	Rounds  [][]Match `json:"rounds"`
}

type Player struct {
	Name    string  `json:"name"`
	Seeding *int    `json:"seeding,omitempty"`
	Club    *string `json:"club,omitempty"`
}

type Match struct {
	Player1         Player    `json:"player1"`
	Player2         Player    `json:"player2"`
	StartTime       time.Time `json:"startTime"`
	DurationMinutes int       `json:"durationMinutes"`
	Table           string    `json:"table"`
}
