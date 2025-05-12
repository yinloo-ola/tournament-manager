package model

import (
	"fmt"
	"log/slog"
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

type Category struct {
	ID                     uint            `gorm:"primaryKey" json:"id"`
	TournamentID           uint            `json:"-"` // Foreign key to Tournament
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

type KnockoutRound struct {
	ID         uint    `gorm:"primaryKey" json:"id"`
	CategoryID uint    `json:"-"`                                // Foreign key to Category
	Round      int     `json:"round" gorm:"column:round_number"` // Match DDL
	Matches    []Match `json:"matches" gorm:"foreignKey:KnockoutRoundID"`
}

type Group struct {
	ID         uint           `gorm:"primaryKey" json:"id"`
	CategoryID uint           `json:"-"`                                    // Foreign key to Category
	GroupIndex int            `json:"groupIndex" gorm:"column:group_index"` // Match DDL
	EntriesIdx []int          `json:"entriesIdx" gorm:"-"`                  // Application logic, not for DB persistence directly
	Entries    []*Entry       `json:"-" gorm:"many2many:group_entries;"`    // GORM many2many
	RoundsRaw  datatypes.JSON `json:"rounds" gorm:"column:rounds_json"`     // Storing [][]Match as JSON
	Rounds     [][]Match      `json:"-" gorm:"-"`                           // For application logic, populated from RoundsRaw
}

// EntryType represents the type of tournament entry
type EntryType string

const (
	Singles EntryType = "Singles"
	Doubles EntryType = "Doubles"
	Team    EntryType = "Team"
)

type Player struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	EntryID     uint   `json:"-"` // Foreign key to Entry
	CategoryID  uint   `json:"-"` // Foreign key to Category (denormalized from Entry's category for easier queries if needed, matches DDL)
	Name        string `json:"name"`
	DateOfBirth string `json:"dateOfBirth"`                            // yyyy-mm-dd. Consider time.Time for DB.
	Gender      string `json:"gender"`                                 // M or F
	PlayerOrder int    `json:"playerOrder" gorm:"column:player_order"` // Added to match DDL
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
	MinPlayers int      `json:"minPlayers"` // These might be derived from Category
	MaxPlayers int      `json:"maxPlayers"` // These might be derived from Category
}

// Entry represents a polymorphic tournament entry
type Entry struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	CategoryID uint      `json:"-"` // Foreign key to Category
	EntryType  EntryType `json:"entryType"`
	Seeding    *int      `json:"seeding,omitempty"`
	Club       *string   `json:"club,omitempty"`
	TeamName   *string   `json:"teamName,omitempty" gorm:"column:team_name"`  // For Team type, matches DDL
	Players    []Player  `json:"players,omitempty" gorm:"foreignKey:EntryID"` // Associated players

	// These are for JSON unmarshalling and application logic, not direct GORM persistence for these structs.
	SinglesEntry *SinglesEntry `json:"singlesEntry,omitempty" gorm:"-"`
	DoublesEntry *DoublesEntry `json:"doublesEntry,omitempty" gorm:"-"`
	TeamEntry    *TeamEntry    `json:"teamEntry,omitempty" gorm:"-"`
}

func (e Entry) Name() string {
	switch e.EntryType {
	case Singles:
		if len(e.Players) > 0 {
			return e.Players[0].Name
		}
		if e.SinglesEntry != nil { // Fallback for data not yet migrated to Players field
			return e.SinglesEntry.Player.Name
		}
		slog.Warn("singles entry has no player name")
		return ""
	case Doubles:
		if len(e.Players) >= 2 {
			return fmt.Sprintf("%s / %s", e.Players[0].Name, e.Players[1].Name)
		}
		if e.DoublesEntry != nil && e.DoublesEntry.Players[0].Name != "" && e.DoublesEntry.Players[1].Name != "" { // Fallback
			return fmt.Sprintf("%s / %s", e.DoublesEntry.Players[0].Name, e.DoublesEntry.Players[1].Name)
		}
		slog.Warn("doubles entry lacks two player names")
		return ""
	case Team:
		if e.TeamName != nil && *e.TeamName != "" {
			return *e.TeamName
		}
		if e.TeamEntry != nil { // Fallback
			return e.TeamEntry.TeamName
		}
		slog.Warn("team entry has no team name")
		return ""
	default:
		slog.Error("invalid entry type", "type", e.EntryType)
		return ""
	}
}

type Match struct {
	ID                    uint               `gorm:"primaryKey" json:"id"`
	CategoryID            uint               `json:"-"`              // Foreign key to Category
	GroupID               *uint              `json:"-" gorm:"index"` // Belongs to Group (nullable)
	KnockoutRoundID       *uint              `json:"-" gorm:"index"` // Belongs to KnockoutRound (nullable)
	Entry1ID              *uint              `json:"-" gorm:"column:entry1_id"`
	Entry2ID              *uint              `json:"-" gorm:"column:entry2_id"`
	WinnerEntryID         *uint              `json:"-" gorm:"column:winner_entry_id"` // From DDL
	Entry1Idx             int                `json:"entry1Idx" gorm:"-"`              // Application logic
	Entry2Idx             int                `json:"entry2Idx" gorm:"-"`              // Application logic
	DateTime              time.Time          `json:"datetime"`
	DurationMinutes       int                `json:"durationMinutes"`
	Table                 string             `json:"table" gorm:"column:table_number"` // Match DDL
	CategoryShortName     string             `json:"categoryShortName"`
	GroupIdx              int                `json:"groupIdx" gorm:"column:group_idx"` // Match DDL, for context
	RoundIdx              int                `json:"roundIdx" gorm:"column:round_idx"` // Match DDL, for context in group
	Round                 int                `json:"round" gorm:"column:round"`        // Match DDL, for knockout round number
	MatchIdx              int                `json:"matchIdx" gorm:"column:match_idx"` // Match DDL
	GamesRaw              datatypes.JSON     `json:"games" gorm:"column:games"`
	MatchesInTeamMatchRaw datatypes.JSON     `json:"matchesInTeamMatch,omitempty" gorm:"column:matches_in_team_match"`
	Games                 []Game             `json:"-" gorm:"-"`             // Application logic
	MatchesInTeamMatch    []MatchInTeamMatch `json:"-" gorm:"-"`             // Application logic
	Score1                *int               `json:"-" gorm:"column:score1"` // From DDL
	Score2                *int               `json:"-" gorm:"column:score2"` // From DDL
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

func (match Match) IsKnockout() bool {
	// A match is knockout if GroupID is nil (or GroupIdx < 0 as per original logic)
	// and KnockoutRoundID is not nil.
	// The GroupIdx field is still populated from the DB for context.
	return match.GroupID == nil || (match.GroupID != nil && *match.GroupID == 0) || match.GroupIdx < 0
}
