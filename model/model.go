package model

import (
	"fmt"
	"strings"
	"time"

	"gorm.io/datatypes"
)

const EntryByeIdx = -2
const EntryEmptyIdx = -1

// Date custom type for JSON marshalling, GORM will use time.Time for Tournament.StartTime
type Date time.Time

func (d *Date) UnmarshalJSON(b []byte) error {
	value := strings.Trim(string(b), `"`) // get rid of "
	if value == "" || value == "null" {
		return nil
	}
	t, err := time.Parse("2006-01-02T15:04", value) // parse time
	if err != nil {
		return err
	}
	*d = Date(t) // set result using the pointer
	return nil
}

func (d Date) MarshalJSON() ([]byte, error) {
	return []byte(`"` + time.Time(d).Format("2006-01-02T15:04") + `"`), nil
}

type Tournament struct {
	ID         uint       `gorm:"primaryKey" json:"id"`
	Name       string     `gorm:"not null" json:"name"`
	Categories []Category `json:"categories" gorm:"foreignKey:TournamentID"`
	NumTables  int        `json:"numTables"`
	StartTime  time.Time  `json:"startTime"` // Changed from Date to time.Time for GORM
}

type Category struct {
	ID                     uint            `gorm:"primaryKey" json:"id"`
	TournamentID           uint            `json:"tournamentID"` // Foreign key to Tournament
	Name                   string          `json:"name"`
	EntryType              EntryType       `json:"entryType"`
	ShortName              string          `json:"shortName"`
	EntriesPerGrpMain      int             `json:"entriesPerGrpMain"`
	EntriesPerGrpRemainder int             `json:"entriesPerGrpRemainder"`
	Entries                []Entry         `json:"entries" gorm:"foreignKey:CategoryID"`
	Groups                 []Group         `json:"groups" gorm:"foreignKey:CategoryID"`
	KnockoutRounds         []KnockoutRound `json:"knockoutRounds" gorm:"foreignKey:CategoryID"`
	DurationMinutes        int             `json:"durationMinutes"`
	NumQualifiedPerGroup   int             `json:"numQualifiedPerGroup"`
	MinPlayers             *int            `json:"minPlayers,omitempty"`
	MaxPlayers             *int            `json:"maxPlayers,omitempty"`
	Lineup                 []LineupItem    `json:"lineup,omitempty" gorm:"foreignKey:CategoryID"`
}

// EntryType represents the type of tournament entry
type EntryType string

const (
	EntryTypeUnknown EntryType = "Unknown"
	EntryTypeSingles EntryType = "Singles"
	EntryTypeDoubles EntryType = "Doubles"
	EntryTypeTeam    EntryType = "Team"
)

// Entry represents a polymorphic tournament entry
type Entry struct {
	ID                uint      `gorm:"primaryKey" json:"id"`
	CategoryID        uint      `json:"categoryID"`   // Foreign key to Category
	TournamentID      uint      `json:"tournamentID"` // Foreign key to Tournament
	GroupID           *uint     `json:"groupID"`      // Belongs to Group (nullable)
	EntryType         EntryType `json:"entryType"`
	Name              string    `json:"name"`         // Player name for singles, "P1/P2" or conventional name for doubles, Team Name for teams
	Seeding           *int      `json:"seeding,omitempty"`
	Club              *string   `json:"club,omitempty"`
	Players           []*Player `gorm:"many2many:entry_players;" json:"players,omitempty"` // Holds 1 for singles, 2 for doubles, N for teams
	MinPlayersPerTeam *int      `json:"minPlayersPerTeam,omitempty"` // Relevant for EntryTypeTeam
	MaxPlayersPerTeam *int      `json:"maxPlayersPerTeam,omitempty"` // Relevant for EntryTypeTeam
}

type Player struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	// EntryID removed
	// TeamMembershipID removed
	CategoryID   uint   `json:"categoryID"`   // Retained: may be used for player's general category affiliation if needed outside of specific entry/team context. Evaluate if truly needed.
	TournamentID uint   `json:"tournamentID"` // Retained: may be used for player's general tournament affiliation. Evaluate if truly needed.
	Name         string `json:"name"`
	DateOfBirth  string `json:"dateOfBirth"`                            // yyyy-mm-dd. Consider time.Time for DB.
	Gender       string `json:"gender"`                                 // M or F
	PlayerOrder  int    `json:"playerOrder" gorm:"column:player_order"` // May represent jersey number or preferred order if applicable.
}



type Group struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	TournamentID uint      `json:"tournamentID"` // Foreign key to Tournament
	CategoryID   uint      `json:"categoryID"`
	EntriesIdx   []int     `json:"entriesIdx" gorm:"-"` // Application logic
	Entries      []Entry   `json:"entries" gorm:"foreignKey:GroupID"`
	Matches      []Match   `json:"matches,omitempty" gorm:"foreignKey:GroupID"` // Matches belonging to this group
	Rounds       [][]Match `json:"rounds" gorm:"-"` // Now serialized to JSON for frontend
} // For application logic, populated from RoundsRaw

type Match struct {
	ID                    uint               `gorm:"primaryKey" json:"id"`
	CategoryID            uint               `json:"categoryID"`
	GroupID               *uint              `json:"groupID" gorm:"index"`
	KnockoutRoundID       *uint              `json:"knockoutRoundID,omitempty" gorm:"index"`
	Entry1ID              *uint              `json:"entry1ID,omitempty" gorm:"column:entry1_id"`
	Entry2ID              *uint              `json:"entry2ID,omitempty" gorm:"column:entry2_id"`
	WinnerEntryID         *uint              `json:"winnerEntryID,omitempty" gorm:"column:winner_entry_id"`
	Entry1Idx             int                `json:"entry1Idx" gorm:"-"` // Application logic
	Entry2Idx             int                `json:"entry2Idx" gorm:"-"` // Application logic
	DateTime              time.Time          `json:"datetime"`
	DurationMinutes       int                `json:"durationMinutes"`
	Table                 string             `json:"table" gorm:"column:table_number"` // Match DDL
	CategoryShortName     string             `json:"categoryShortName,omitempty"`
	GroupIdx              int                `json:"groupIdx,omitempty" gorm:"column:group_idx"`
	RoundIdx              int                `json:"roundIdx,omitempty" gorm:"column:round_idx"`
	Round                 int                `json:"round,omitempty" gorm:"column:round"`
	MatchIdx              int                `json:"matchIdx,omitempty" gorm:"column:match_idx"`
	GamesRaw              datatypes.JSON     `json:"games" gorm:"column:games"`
	MatchesInTeamMatchRaw datatypes.JSON     `json:"matchesInTeamMatch,omitempty" gorm:"column:matches_in_team_match"`
	Games                 []Game             `json:"gamesArray,omitempty" gorm:"-"`              // Application logic, if you want to expose
	MatchesInTeamMatch    []MatchInTeamMatch `json:"matchesInTeamMatchArray,omitempty" gorm:"-"` // Application logic, if you want to expose
	Score1                *int               `json:"score1,omitempty" gorm:"column:score1"`
	Score2                *int               `json:"score2,omitempty" gorm:"column:score2"`
}

type MatchInTeamMatch struct { // This will be part of JSON in Match.MatchesInTeamMatchRaw
	MatchNumber int    `json:"matchNumber"`
	Games       []Game `json:"games"`
}

type Game [2]int // This will be part of JSON in Match.GamesRaw

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

type KnockoutRound struct {
	ID         uint    `gorm:"primaryKey" json:"id"`
	CategoryID uint    `json:"categoryID"`                       // Foreign key to Category
	Round      int     `json:"round" gorm:"column:round_number"` // Match DDL
	Matches    []Match `json:"matches" gorm:"foreignKey:KnockoutRoundID"`
}

func (match Match) IsKnockout() bool {
	// A match is knockout if GroupID is nil (or GroupIdx < 0 as per original logic)
	// and KnockoutRoundID is not nil.
	// The GroupIdx field is still populated from the DB for context.
	return match.GroupID == nil || (match.GroupID != nil && *match.GroupID == 0) || match.GroupIdx < 0
}

// AgeRequirement defines age constraints for a lineup item
// This struct will be serialized as JSON within LineupItem for GORM.
type AgeRequirement struct {
	Type  string `json:"type"`  // "minimum", "maximum"
	Value int    `json:"value"` // The age value for the requirement
}

// LineupItem defines a match in a team competition with specific requirements
type LineupItem struct {
	ID                uint           `gorm:"primaryKey" json:"id"`
	CategoryID        uint           `json:"-"` // Foreign key to Category
	Name              string         `json:"name"`
	MatchType         EntryType      `json:"matchType"`                // Singles or Doubles
	GenderRequirement string         `json:"genderRequirement"`        // "M", "F", "Mixed", or "Any"
	AgeRequirement    datatypes.JSON `json:"ageRequirement,omitempty"` // Stored as JSON in DB
}
