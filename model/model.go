package model

import (
	"fmt"
	"log/slog"
	"strings"
	"time"
)

const EntryByeIdx = -2
const EntryEmptyIdx = -1

type Date time.Time

func (c *Date) UnmarshalJSON(b []byte) error {
	value := strings.Trim(string(b), `"`) // get rid of "
	if value == "" || value == "null" {
		return nil
	}

	t, err := time.Parse("2006-01-02T15:04", value) // parse time
	if err != nil {
		return err
	}
	*c = Date(t) // set result using the pointer
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

// AgeRequirement defines age constraints for a lineup item
type AgeRequirement struct {
	Type  string `json:"type"`  // "minimum", "maximum"
	Value int    `json:"value"` // The age value for the requirement
}

// LineupItem defines a match in a team competition with specific requirements
type LineupItem struct {
	Name              string          `json:"name"`
	MatchType         EntryType       `json:"matchType"`         // Singles or Doubles
	GenderRequirement string          `json:"genderRequirement"` // "M", "F", "Mixed", or "Any"
	AgeRequirement    *AgeRequirement `json:"ageRequirement,omitempty"`
}

type Category struct {
	Name                   string          `json:"name"`
	EntryType              EntryType       `json:"entryType"`
	ShortName              string          `json:"shortName"`
	EntriesPerGrpMain      int             `json:"entriesPerGrpMain"`
	EntriesPerGrpRemainder int             `json:"entriesPerGrpRemainder"`
	Entries                []Entry         `json:"entries"`
	Groups                 []Group         `json:"groups"`
	KnockoutRounds         []KnockoutRound `json:"knockoutRounds"`
	DurationMinutes        int             `json:"durationMinutes"`
	NumQualifiedPerGroup   int             `json:"numQualifiedPerGroup"`
	MinPlayers             *int            `json:"minPlayers,omitempty"`
	MaxPlayers             *int            `json:"maxPlayers,omitempty"`
	Lineup                 []LineupItem    `json:"lineup,omitempty"`
}

type KnockoutRound struct {
	Round   int     `json:"round"`
	Matches []Match `json:"matches"`
}

type Group struct {
	EntriesIdx []int     `json:"entriesIdx"`
	Rounds     [][]Match `json:"rounds"`
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
	TeamName   string   `json:"teamName"`
	Players    []Player `json:"players"`
	MinPlayers int      `json:"minPlayers"`
	MaxPlayers int      `json:"maxPlayers"`
}

// Entry represents a polymorphic tournament entry
type Entry struct {
	EntryType    EntryType     `json:"entryType"`
	Seeding      *int          `json:"seeding,omitempty"`
	Club         *string       `json:"club,omitempty"`
	SinglesEntry *SinglesEntry `json:"singlesEntry"`
	DoublesEntry *DoublesEntry `json:"doublesEntry"`
	TeamEntry    *TeamEntry    `json:"teamEntry"`
}

func (e Entry) Name() string {
	switch e.EntryType {
	case Singles:
		if e.SinglesEntry == nil {
			slog.Warn("singles entry is nil")
			return ""
		}
		return e.SinglesEntry.Player.Name
	case Doubles:
		if e.DoublesEntry == nil {
			slog.Warn("doubles entry is nil")
			return ""
		}
		if e.DoublesEntry.Players[0].Name == "" || e.DoublesEntry.Players[1].Name == "" {
			slog.Warn("doubles entry is empty")
			return ""
		}
		return fmt.Sprintf("%s / %s", e.DoublesEntry.Players[0].Name, e.DoublesEntry.Players[1].Name)
	case Team:
		if e.TeamEntry == nil {
			slog.Warn("team entry is nil")
			return ""
		}
		return e.TeamEntry.TeamName
	default:
		slog.Error("invalid entry type", "type", e.EntryType)
		return ""
	}
}

type Match struct {
	Entry1Idx         int       `json:"entry1Idx"`
	Entry2Idx         int       `json:"entry2Idx"`
	DateTime          time.Time `json:"datetime"`
	DurationMinutes   int       `json:"durationMinutes"`
	Table             string    `json:"table"`
	CategoryShortName string    `json:"-"`
	GroupIdx          int       `json:"-"`
	RoundIdx          int       `json:"-"`
	Round             int       `json:"round"`
	MatchIdx          int       `json:"-"`
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
