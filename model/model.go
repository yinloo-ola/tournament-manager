package model

type Tournament struct {
	Name       string     `json:"name"`
	Categories []Category `json:"categories"`
}

type Category struct {
	Name                   string     `json:"name"`
	ShortName              string     `json:"shortName"`
	PlayersPerGrpMain      int        `json:"playersPerGrpMain"`
	PlayersPerGrpRemainder int        `json:"playersPerGrpRemainder"`
	Players                []Player   `json:"players"`
	Groups                 [][]Player `json:"groups"`
}

type Player struct {
	Name    string  `json:"name"`
	Seeding *int    `json:"seeding,omitempty"`
	Club    *string `json:"club,omitempty"`
}

type Match struct {
	Player1  Player `json:"player1"`
	Player2  Player `json:"player2"`
	Datetime string `json:"datetime"`
	Table    string `json:"table"`
}
