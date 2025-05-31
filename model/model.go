package model

import (
	"database/sql/driver"
	"fmt"
	"sort"
	"strings"
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

const EntryByeIdx = -2
const EntryEmptyIdx = -1

// Date custom type for JSON marshalling, GORM will use time.Time for Tournament.StartTime
type Date struct {
	time.Time
}

func (d Date) Value() (driver.Value, error) {
	if d.Time.IsZero() {
		return nil, nil
	}
	return d.Time, nil
}

func (d *Date) Scan(value interface{}) error {
	if value == nil {
		d.Time = time.Time{}
		return nil
	}
	t, ok := value.(time.Time)
	if !ok {
		return fmt.Errorf("type assertion failed: %T", value)
	}
	d.Time = t
	return nil
}

func (d *Date) UnmarshalJSON(b []byte) error {
	value := strings.Trim(string(b), `"`) // get rid of "
	if value == "" || value == "null" {
		return nil
	}
	t, err := time.Parse("2006-01-02T15:04", value) // parse time
	if err != nil {
		return err
	}
	*d = Date{Time: t}
	return nil
}

func (d Date) MarshalJSON() ([]byte, error) {
	return []byte(`"` + d.Time.Format("2006-01-02T15:04") + `"`), nil
}

type Tournament struct {
	ID         uint       `gorm:"primaryKey" json:"id,omitzero"`
	Name       string     `gorm:"not null" json:"name"`
	Categories []Category `json:"categories" gorm:"foreignKey:TournamentID"`
	NumTables  int        `json:"numTables"`
	StartTime  Date       `json:"startTime"`
}

type Category struct {
	ID                     uint            `gorm:"primaryKey" json:"id,omitzero"`
	TournamentID           uint            `json:"tournamentID,omitzero"` // Foreign key to Tournament
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

func (c *Category) BeforeSave(tx *gorm.DB) error {
	for i, group := range c.Groups {
		group.GroupIdx = uint(i)
		c.Groups[i] = group
	}
	return nil
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
	ID                uint      `gorm:"primaryKey" json:"id,omitzero"`
	CategoryID        uint      `json:"categoryID,omitzero"` // Foreign key to Category
	EntryType         EntryType `json:"entryType"`
	Name              string    `json:"name"` // Player name for singles, "P1/P2" or conventional name for doubles, Team Name for teams
	Seeding           *int      `json:"seeding,omitempty"`
	Club              *string   `json:"club,omitempty"`
	Players           []*Player `json:"players,omitempty"`           // Holds 1 for singles, 2 for doubles, N for teams
	MinPlayersPerTeam *int      `json:"minPlayersPerTeam,omitempty"` // Relevant for EntryTypeTeam
	MaxPlayersPerTeam *int      `json:"maxPlayersPerTeam,omitempty"` // Relevant for EntryTypeTeam
}

type Player struct {
	ID          uint   `gorm:"primaryKey" json:"id,omitzero"`
	EntryID     uint   `json:"entryID,omitzero"`
	Name        string `json:"name"`
	DateOfBirth string `json:"dateOfBirth"` // yyyy-mm-dd.
	Gender      string `json:"gender"`      // M or F
}

type Group struct {
	ID           uint            `gorm:"primaryKey" json:"id,omitzero"`
	GroupIdx     uint            `json:"groupIdx"`
	TournamentID uint            `json:"tournamentID,omitzero"` // Foreign key to Tournament
	CategoryID   uint            `json:"categoryID,omitzero"`
	EntriesIdx   []int           `json:"entriesIdx" gorm:"serializer:json"`
	Matches      []Match         `json:"matches,omitempty" gorm:"foreignKey:GroupID"` // Matches belonging to this group
	Rounds       [][]Match       `json:"rounds" gorm:"-"`                             // Rounds are populated from the Matches slice
	TeamRounds   [][]TeamMatches `json:"teamRounds" gorm:"-"`                         // Team rounds are populated from the Matches slice
}

// BeforeSave GORM hook for Group
// This hook populates the Matches slice from Rounds or TeamRounds before saving to DB.
func (g *Group) BeforeSave(tx *gorm.DB) error {
	g.Matches = nil
	if len(g.Rounds) > 0 {
		for roundIdx, round := range g.Rounds {
			for _, match := range round {
				m := match
				// Set round and match indices
				if m.GroupRoundIdx == nil {
					val := uint(roundIdx)
					m.GroupRoundIdx = &val
				}
				if m.GroupIdx == nil {
					val := uint(g.GroupIdx)
					m.GroupIdx = &val
				}
				if m.GroupID == nil {
					val := uint(g.ID)
					m.GroupID = &val
				}
				m.LineupIdx = nil // singles/doubles rounds do not use LineupIdx
				g.Matches = append(g.Matches, m)
			}
		}
	} else if len(g.TeamRounds) > 0 {
		for roundIdx, teamRound := range g.TeamRounds {
			for teamMatchIdx, teamMatch := range teamRound {
				if teamMatch.GroupRoundIdx == nil {
					val := uint(roundIdx)
					teamMatch.GroupRoundIdx = &val
				}
				if teamMatch.GroupIdx == nil {
					val := uint(teamMatchIdx)
					teamMatch.GroupIdx = &val
				}
				if teamMatch.GroupID == nil {
					val := uint(g.ID)
					teamMatch.GroupID = &val
				}
				for lineupIdx, match := range teamMatch.Matches {
					m := match
					// Set indices for team event
					if m.GroupRoundIdx == nil {
						val := uint(roundIdx)
						m.GroupRoundIdx = &val
					}
					if m.GroupIdx == nil {
						val := uint(teamMatchIdx)
						m.GroupIdx = &val
					}
					if m.GroupID == nil {
						val := uint(g.ID)
						m.GroupID = &val
					}
					val := uint(lineupIdx)
					m.LineupIdx = &val
					// Copy team info
					m.Entry1Idx = teamMatch.Entry1Idx
					m.Entry2Idx = teamMatch.Entry2Idx
					m.CategoryID = teamMatch.CategoryID
					m.CategoryShortName = teamMatch.CategoryShortName
					g.Matches = append(g.Matches, m)
				}
			}
		}
	}
	return nil
}

// AfterFind GORM hook for Group
// This hook reconstructs Rounds or TeamRounds from the Matches slice after fetching from DB.
func (g *Group) AfterFind(tx *gorm.DB) error {
	g.Rounds = nil
	g.TeamRounds = nil
	if len(g.Matches) == 0 {
		return nil
	}
	isTeam := false
	for _, m := range g.Matches {
		if m.LineupIdx != nil {
			isTeam = true
			break
		}
	}
	if isTeam {
		// Reconstruct TeamRounds
		teamRoundsMap := make(map[uint]map[uint][]Match) // roundIdx -> teamMatchIdx -> []Match
		teamMeta := make(map[string]TeamMatches)         // key: roundIdx|teamMatchIdx
		for _, m := range g.Matches {
			if m.GroupRoundIdx == nil || m.GroupIdx == nil || m.GroupID == nil || m.LineupIdx == nil {
				continue
			}
			roundIdx := *m.GroupRoundIdx
			teamMatchIdx := *m.GroupIdx
			if _, ok := teamRoundsMap[roundIdx]; !ok {
				teamRoundsMap[roundIdx] = make(map[uint][]Match)
			}
			teamRoundsMap[roundIdx][teamMatchIdx] = append(teamRoundsMap[roundIdx][teamMatchIdx], m)
			// Use a composite key for teamMeta
			key := fmt.Sprintf("%d|%d", roundIdx, teamMatchIdx)
			if _, ok := teamMeta[key]; !ok {
				teamMeta[key] = TeamMatches{
					CategoryID:         m.CategoryID,
					CategoryShortName:  m.CategoryShortName,
					Entry1Idx:          m.Entry1Idx,
					Entry2Idx:          m.Entry2Idx,
					GroupID:            m.GroupID,
					GroupIdx:           m.GroupIdx,
					DateTime:           m.DateTime,
					DurationMinutes:    m.DurationMinutes,
					Table:              m.Table,
					GroupRoundIdx:      m.GroupRoundIdx,
					GroupMatchIdx:      m.GroupMatchIdx,
				}
			}
		}
		// Build TeamRounds
		var teamRounds [][]TeamMatches
		// Get sorted roundIdxs
		var roundIdxs []uint
		for r := range teamRoundsMap {
			roundIdxs = append(roundIdxs, r)
		}
		sort.Slice(roundIdxs, func(i, j int) bool { return roundIdxs[i] < roundIdxs[j] })
		for _, roundIdx := range roundIdxs {
			teamMatchMap := teamRoundsMap[roundIdx]
			// Get sorted teamMatchIdxs
			var teamMatchIdxs []uint
			for t := range teamMatchMap {
				teamMatchIdxs = append(teamMatchIdxs, t)
			}
			sort.Slice(teamMatchIdxs, func(i, j int) bool { return teamMatchIdxs[i] < teamMatchIdxs[j] })
			var teamMatches []TeamMatches
			for _, teamMatchIdx := range teamMatchIdxs {
				matches := teamMatchMap[teamMatchIdx]
				// Sort by LineupIdx
				sort.Slice(matches, func(i, j int) bool {
					return *matches[i].LineupIdx < *matches[j].LineupIdx
				})
				key := fmt.Sprintf("%d|%d", roundIdx, teamMatchIdx)
				tm := teamMeta[key]
				tm.Matches = matches
				teamMatches = append(teamMatches, tm)
			}
			teamRounds = append(teamRounds, teamMatches)
		}
		g.TeamRounds = teamRounds
	} else {
		// Reconstruct Rounds
		roundsMap := make(map[uint][]Match) // roundIdx -> []Match
		for _, m := range g.Matches {
			if m.RoundRobinRound == nil || m.RoundRobinMatchIdx == nil {
				continue
			}
			roundIdx := *m.RoundRobinRound
			roundsMap[roundIdx] = append(roundsMap[roundIdx], m)
		}
		// Build Rounds
		var roundIdxs []uint
		for r := range roundsMap {
			roundIdxs = append(roundIdxs, r)
		}
		sort.Slice(roundIdxs, func(i, j int) bool { return roundIdxs[i] < roundIdxs[j] })
		var rounds [][]Match
		for _, roundIdx := range roundIdxs {
			matches := roundsMap[roundIdx]
			// Sort by RoundRobinMatchIdx
			sort.Slice(matches, func(i, j int) bool {
				return *matches[i].RoundRobinMatchIdx < *matches[j].RoundRobinMatchIdx
			})
			rounds = append(rounds, matches)
		}
		g.Rounds = rounds
	}
	return nil
}

type TeamMatches struct {
	CategoryID         uint    `json:"categoryID,omitzero"`
	CategoryShortName  string  `json:"categoryShortName,omitempty"`
	Winner             *uint   `json:"winner,omitempty,omitzero"`
	Matches            []Match `json:"matches"`
	Entry1Idx          int     `json:"entry1Idx"`
	Entry2Idx          int     `json:"entry2Idx"`
	DateTime           Date    `json:"datetime"`
	DurationMinutes    int     `json:"durationMinutes"`
	Table              string  `json:"table"`
	GroupID            *uint   `json:"groupID,omitempty,omitzero"`
	GroupIdx           *uint   `json:"groupIdx,omitempty,omitzero"`
	GroupRoundIdx      *uint   `json:"groupRoundIdx,omitempty,omitzero"`
	RoundRobinRound    *uint   `json:"roundRobinRound,omitempty,omitzero"`
	RoundRobinMatchIdx *uint   `json:"roundRobinMatchIdx,omitempty,omitzero"`
}

type Match struct {
	ID                 uint        `gorm:"primaryKey" json:"id,omitzero"`
	CategoryID         uint        `json:"categoryID,omitzero"`
	CategoryShortName  string      `json:"categoryShortName,omitempty"`
	KnockoutRoundID    *uint       `json:"knockoutRoundID,omitempty,omitzero"`
	Players1Idx        []uint      `json:"players1Idx" gorm:"serializer:json"` // first pair/player. 1 player for singles, 2 players for doubles
	Players2Idx        []uint      `json:"players2Idx" gorm:"serializer:json"` // second pair/player. 1 player for singles, 2 players for doubles
	Winner             *uint       `json:"winner,omitempty,omitzero"`          // 1: first player/pair, 2: second player/pair
	Entry1Idx          int         `json:"entry1Idx"`
	Entry2Idx          int         `json:"entry2Idx"`
	DateTime           Date        `json:"datetime"`
	DurationMinutes    int         `json:"durationMinutes"`
	Table              string      `json:"table"`
	Games              []GameScore `json:"games" gorm:"serializer:json"`
	GroupID            *uint       `json:"groupID,omitempty,omitzero"`
	GroupIdx           *uint       `json:"groupIdx,omitempty,omitzero"`
	GroupRoundIdx      *uint       `json:"groupRoundIdx,omitempty,omitzero"`
	RoundRobinRound    *uint       `json:"roundRobinRound,omitempty,omitzero"`
	RoundRobinMatchIdx *uint       `json:"roundRobinMatchIdx,omitempty,omitzero"`
	LineupIdx          *uint       `json:"lineupIdx,omitempty,omitzero"` // for team match. 0: first match of lineup, etc.
}

type GameScore struct {
	Players1Score int `json:"players1Score"`
	Players2Score int `json:"players2Score"`
}

type KnockoutRound struct {
	ID         uint    `gorm:"primaryKey" json:"id,omitzero"`
	CategoryID uint    `json:"categoryID,omitzero"`              // Foreign key to Category
	Round      int     `json:"round" gorm:"column:round_number"` // Match DDL
	Matches    []Match `json:"matches" gorm:"foreignKey:KnockoutRoundID"`
}

// AgeRequirement defines age constraints for a lineup item
// This struct will be serialized as JSON within LineupItem for GORM.
type AgeRequirement struct {
	Type  string `json:"type"`  // "minimum", "maximum"
	Value int    `json:"value"` // The age value for the requirement
}

// LineupItem defines a match in a team competition with specific requirements
type LineupItem struct {
	ID                uint           `gorm:"primaryKey" json:"id,omitzero"`
	CategoryID        uint           `json:"-"` // Foreign key to Category
	Name              string         `json:"name"`
	MatchType         EntryType      `json:"matchType"`                // Singles or Doubles
	GenderRequirement string         `json:"genderRequirement"`        // "M", "F", "Mixed", or "Any"
	AgeRequirement    datatypes.JSON `json:"ageRequirement,omitempty"` // Stored as JSON in DB
}
