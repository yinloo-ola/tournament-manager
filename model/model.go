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
	EntriesPerGrpMain      int             `json:"entriesPerGrpMain"`
	EntriesPerGrpRemainder int             `json:"entriesPerGrpRemainder"`
	Entries                []Entry         `json:"entries"`
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
	Entries []Entry   `json:"entries"`
	Rounds  [][]Match `json:"rounds"`
}

// EntryType represents the type of tournament entry
type EntryType string

const (
	Singles EntryType = "Singles"
	Doubles EntryType = "Doubles"
	Team    EntryType = "Team"
)

type Player struct {
	Name        string `json:"name"`
	DateOfBirth string `json:"dateOfBirth"` // yyyy-mm-dd
	Gender      string `json:"gender"`      // M or F
}

type SinglesEntry struct {
	Player Player `json:"player"`
}

type DoublesEntry struct {
	Players [2]Player `json:"players"`
}

type TeamEntry struct {
	Players    []Player `json:"players"`
	MinPlayers int      `json:"minPlayers"`
	MaxPlayers int      `json:"maxPlayers"`
}

// Entry represents a polymorphic tournament entry
type Entry struct {
	EntryType   EntryType     `json:"entryType"`
	Seeding     *int          `json:"seeding,omitempty"`
	Club        *string       `json:"club,omitempty"`
	SingleEntry *SinglesEntry `json:"singleEntry"`
	DoubleEntry *DoublesEntry `json:"doubleEntry"`
	TeamEntry   *TeamEntry    `json:"teamEntry"`
}

type SinglesEntry struct {
	Player Player `json:"player"`
	BaseEntry
}

type DoublesEntry struct {
	Players [2]Player `json:"players"`
	BaseEntry
}

type TeamEntry struct {
	Players    []Player `json:"players"`
	MaxPlayers int      `json:"maxPlayers"`
	MinPlayers int      `json:"minPlayers"`
	BaseEntry
}

type EntryType string

const (
	EntryTypeSingles EntryType = "Singles"
	EntryTypeDoubles EntryType = "Doubles"
	EntryTypeTeam    EntryType = "Team"
)

type Entry struct {
	EntryType EntryType
	*SinglesEntry
	*DoublesEntry
	*TeamEntry
}

type Player struct {
	Name   string `json:"name"`
	DOB    string `json:"dob"`
	Gender string `json:"gender"`

	Seeding *int    `json:"seeding,omitempty"` // for backwards compatibility
	Club    *string `json:"club,omitempty"`    // for backwards compatibility
}

type Match struct {
	Entry1            Entry     `json:"entry1"`
	Entry2            Entry     `json:"entry2"`
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
