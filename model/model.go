package model

import (
	"fmt"
	"strings"
	"time"
)

type Date time.Time

func (c *Date) UnmarshalJSON(b []byte) error {
	value := strings.Trim(string(b), `"`) //get rid of "
	if value == "" || value == "null" {
		return nil
	}

	t, err := time.Parse("2006-01-02T15:04", value) //parse time
	if err != nil {
		return err
	}
	*c = Date(t) //set result using the pointer
	return nil
}

func (c Date) MarshalJSON() ([]byte, error) {
	return []byte(`"` + time.Time(c).Format("2006-01-02T15:04") + `"`), nil
}

type Tournament struct {
	Name       string     `json:"name"`
	Categories []Category `json:"categories"`
	NumTables  int        `json:"numTables"`
	StartTime  Date       `json:"startTime"`
}

type Category struct {
	Name                   string          `json:"name"`
	ShortName              string          `json:"shortName"`
	PlayersPerGrpMain      int             `json:"playersPerGrpMain"`
	PlayersPerGrpRemainder int             `json:"playersPerGrpRemainder"`
	Players                []Player        `json:"players"`
	Groups                 []Group         `json:"groups"`
	KnockoutRounds         []KnockoutRound `json:"knockoutRounds"`
	DurationMinutes        int             `json:"durationMinutes"`
	NumQualifiedPerGroup   int             `json:"numQualifiedPerGroup"`
}

type KnockoutRound struct {
	Round   int     `json:"round"`
	Matches []Match `json:"matches"`
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
	Player1           Player    `json:"player1"`
	Player2           Player    `json:"player2"`
	DateTime          time.Time `json:"datetime"`
	DurationMinutes   int       `json:"durationMinutes"`
	Table             string    `json:"table"`
	CategoryShortName string
	GroupIdx          int
	RoundIdx          int
	Round             int
	MatchIdx          int
}

func (match Match) Name() string {
	if match.IsKnockout() {
		switch match.Round {
		case 2:
			return fmt.Sprintf("%s F", match.CategoryShortName)
		case 4:
			return fmt.Sprintf("%s SF", match.CategoryShortName)
		case 8:
			return fmt.Sprintf("%s QF", match.CategoryShortName)
		}
		return fmt.Sprintf("%s R%d", match.CategoryShortName, match.Round)
	}
	return fmt.Sprintf("%s Grp%d", match.CategoryShortName, match.GroupIdx+1)
}

func (match Match) IsKnockout() bool {
	return match.GroupIdx < 0
}
