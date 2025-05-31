package repo

import (
	"testing"
	"time"

	"github.com/glebarez/sqlite" // CGO-Free SQLite driver
	"github.com/stretchr/testify/assert"
	"gorm.io/gorm"

	"github.com/yinloo-ola/tournament-manager/model"
)

func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect to in-memory database: %v", err)
	}

	// Auto-migrate the schema
	err = db.AutoMigrate(
		&model.Tournament{},
		&model.Category{},
		&model.Entry{},
		&model.Player{},
		&model.Group{},
		&model.Match{},
		&model.KnockoutRound{},
		&model.LineupItem{},
	)
	if err != nil {
		t.Fatalf("Failed to auto-migrate database schema: %v", err)
	}

	return db
}

func TestSaveAndGetTournament(t *testing.T) {
	db := setupTestDB(t)
	repo := &TournamentRepo{db: db}

	// --- Test Data Construction ---
	// Players (remain the same)
	playerMS1 := model.Player{Name: "MS Player 1", Gender: "M"}
	playerMS2 := model.Player{Name: "MS Player 2", Gender: "M"}
	playerMS3 := model.Player{Name: "MS Player 3", Gender: "M"}

	playerWD1A := model.Player{Name: "WD Player 1A", Gender: "F"}
	playerWD1B := model.Player{Name: "WD Player 1B", Gender: "F"}
	playerWD2A := model.Player{Name: "WD Player 2A", Gender: "F"}
	playerWD2B := model.Player{Name: "WD Player 2B", Gender: "F"}

	teamAlphaPlayer1 := model.Player{Name: "Team Alpha Player 1", Gender: "M"}
	teamAlphaPlayer2 := model.Player{Name: "Team Alpha Player 2", Gender: "F"}
	teamBetaPlayer1 := model.Player{Name: "Team Beta Player 1", Gender: "M"}
	teamBetaPlayer2 := model.Player{Name: "Team Beta Player 2", Gender: "F"}

	// Entries (updated structure)
	entryMS1 := model.Entry{Name: playerMS1.Name, EntryType: model.EntryTypeSingles, Players: []*model.Player{&playerMS1}}
	entryMS2 := model.Entry{Name: playerMS2.Name, EntryType: model.EntryTypeSingles, Players: []*model.Player{&playerMS2}}
	entryMS3 := model.Entry{Name: playerMS3.Name, EntryType: model.EntryTypeSingles, Players: []*model.Player{&playerMS3}}

	entryWD1 := model.Entry{Name: "WD Team 1 (P1A/P1B)", EntryType: model.EntryTypeDoubles, Players: []*model.Player{&playerWD1A, &playerWD1B}}
	entryWD2 := model.Entry{Name: "WD Team 2 (P2A/P2B)", EntryType: model.EntryTypeDoubles, Players: []*model.Player{&playerWD2A, &playerWD2B}}

	// Team entries: Team struct removed, players directly in Entry
	entryTeamAlpha := model.Entry{Name: "Team Alpha", EntryType: model.EntryTypeTeam, Players: []*model.Player{&teamAlphaPlayer1, &teamAlphaPlayer2}}
	entryTeamBeta := model.Entry{Name: "Team Beta", EntryType: model.EntryTypeTeam, Players: []*model.Player{&teamBetaPlayer1, &teamBetaPlayer2}}

	group1Match1Time := model.Date{Time: time.Now().Add(time.Hour * 24)}
	group1Match2Time := model.Date{Time: time.Now().Add(time.Hour * 25)}
	group1Match3Time := model.Date{Time: time.Now().Add(time.Hour * 26)}
	koMatchTime := model.Date{Time: time.Now().Add(time.Hour * 48)}

	msCategory := model.Category{
		Name:      "Men's Singles Detailed",
		EntryType: model.EntryTypeSingles,
		ShortName: "MSDet",
		Entries:   []model.Entry{entryMS1, entryMS2, entryMS3},
		Groups: []model.Group{
			{
				EntriesIdx: []int{0, 1}, // Group containing subset of category entries
				Rounds: [][]model.Match{{
					{
						Table:             "1",
						DateTime:          group1Match1Time,
						DurationMinutes:   60,
						Entry1Idx:         0,         // First entry in group (entryMS1)
						Entry2Idx:         1,         // Second entry in group (entryMS2)
						Players1Idx:       []uint{0}, // First player in entryMS1 (playerMS1)
						Players2Idx:       []uint{0}, // First player in entryMS2 (playerMS2)
						CategoryShortName: "MSDet",
					},
					{
						Table:             "2",
						DateTime:          group1Match2Time,
						DurationMinutes:   60,
						Entry1Idx:         0,         // First entry in group (entryMS1)
						Entry2Idx:         1,         // Second entry in group (entryMS2)
						Players1Idx:       []uint{0}, // First player in entryMS1 (playerMS1)
						Players2Idx:       []uint{1}, // Second player in entryMS2 (playerMS2)
						CategoryShortName: "MSDet",
					},
					{
						Table:             "3",
						DateTime:          group1Match3Time,
						DurationMinutes:   60,
						Entry1Idx:         0,         // First entry in group (entryMS1)
						Entry2Idx:         1,         // Second entry in group (entryMS2)
						Players1Idx:       []uint{1}, // Second player in entryMS1 (playerMS1)
						Players2Idx:       []uint{0}, // First player in entryMS2 (playerMS2)
						CategoryShortName: "MSDet",
					},
				}},
			},
		},
		KnockoutRounds: []model.KnockoutRound{
			{
				Round: 1,
				Matches: []model.Match{
					{
						Table:             "Center Court",
						DateTime:          koMatchTime,
						DurationMinutes:   90,
						CategoryShortName: "MSDet",
					},
				},
			},
		},
	}

	wdCategory := model.Category{
		Name:      "Women's Doubles Detailed",
		EntryType: model.EntryTypeDoubles,
		ShortName: "WDDet",
		Entries:   []model.Entry{entryWD1, entryWD2},
	}

	teamCategory := model.Category{
		Name:      "Mixed Team Event Detailed",
		EntryType: model.EntryTypeTeam,
		ShortName: "MTDet",
		Entries:   []model.Entry{entryTeamAlpha, entryTeamBeta},
	}

	emptyCategory := model.Category{
		Name:      "Empty Test Category",
		EntryType: model.EntryTypeSingles,
		ShortName: "ETC",
		Entries:   []model.Entry{},
	}

	tournamentToSave := model.Tournament{
		Name:       "Fully Recursive Test Tournament",
		NumTables:  15,
		StartTime:  model.Date{Time: time.Now()},
		Categories: []model.Category{msCategory, wdCategory, teamCategory, emptyCategory},
	}

	savedID, err := repo.SaveTournament(tournamentToSave)
	assert.NoError(t, err, "SaveTournament should not return an error")
	assert.NotZero(t, savedID, "SaveTournament should return a non-zero ID")

	t.Run("Get fully populated tournament", func(t *testing.T) {
		retrievedTournament, errGet := repo.GetTournament(savedID)
		assert.NoError(t, errGet, "GetTournament should not error for existing ID")
		assert.NotNil(t, retrievedTournament, "GetTournament should return a tournament")

		assert.Equal(t, savedID, retrievedTournament.ID)
		assert.Equal(t, tournamentToSave.Name, retrievedTournament.Name)
		assert.Equal(t, tournamentToSave.NumTables, retrievedTournament.NumTables)
		assert.WithinDuration(t, tournamentToSave.StartTime.Time, retrievedTournament.StartTime.Time, time.Second)
		assert.Len(t, retrievedTournament.Categories, 4, "Should have 4 categories")

		// Helper function to find a player by name in a slice of players
		hasPlayer := func(players []*model.Player, name string) bool {
			for _, p := range players {
				if p.Name == name {
					return true
				}
			}
			return false
		}

		// --- Assertions for Men's Singles Category (msCategory) ---
		retrievedMSCategory := retrievedTournament.Categories[0]
		assert.Equal(t, msCategory.Name, retrievedMSCategory.Name)
		assert.Len(t, retrievedMSCategory.Entries, 3, "MS category should have 3 entries")
		msEntry1Retrieved := retrievedMSCategory.Entries[0]
		assert.Equal(t, entryMS1.Name, msEntry1Retrieved.Name)
		assert.Len(t, msEntry1Retrieved.Players, 1, "MS Entry 1 should have 1 player")
		assert.Equal(t, playerMS1.Name, msEntry1Retrieved.Players[0].Name, "MS Entry 1 Player name mismatch")

		// Groups in MS Category
		assert.Len(t, retrievedMSCategory.Groups, 1, "MS category should have 1 group")
		msGroup1 := retrievedMSCategory.Groups[0]
		assert.Len(t, msGroup1.EntriesIdx, 2, "MS Group 1 should have 2 entries")
		// Check players for entries in groups
		assert.True(t, hasPlayer(retrievedMSCategory.Entries[msGroup1.EntriesIdx[0]].Players, playerMS1.Name), "Group entry 1 missing playerMS1")
		assert.True(t, hasPlayer(retrievedMSCategory.Entries[msGroup1.EntriesIdx[1]].Players, playerMS2.Name), "Group entry 2 missing playerMS2")

		// Check matches in group
		assert.Len(t, msGroup1.Matches, 3, "MS Group 1 should have 3 matches")

		// First match
		assert.Equal(t, "1", msGroup1.Matches[0].Table)
		assert.WithinDuration(t, group1Match1Time.Time, msGroup1.Matches[0].DateTime.Time, time.Second)
		assert.Equal(t, []uint{0}, msGroup1.Matches[0].Players1Idx, "First match should have playerMS1 as player 1")
		assert.Equal(t, []uint{0}, msGroup1.Matches[0].Players2Idx, "First match should have playerMS2 as player 2")

		// Second match
		assert.Equal(t, "2", msGroup1.Matches[1].Table)
		assert.WithinDuration(t, group1Match2Time.Time, msGroup1.Matches[1].DateTime.Time, time.Second)
		assert.Equal(t, []uint{0}, msGroup1.Matches[1].Players1Idx, "Second match should have playerMS1 as player 1")
		assert.Equal(t, []uint{1}, msGroup1.Matches[1].Players2Idx, "Second match should have playerMS2 as player 2")

		// Third match
		assert.Equal(t, "3", msGroup1.Matches[2].Table)
		assert.WithinDuration(t, group1Match3Time.Time, msGroup1.Matches[2].DateTime.Time, time.Second)
		assert.Equal(t, []uint{1}, msGroup1.Matches[2].Players1Idx, "Third match should have playerMS1 as player 1")
		assert.Equal(t, []uint{0}, msGroup1.Matches[2].Players2Idx, "Third match should have playerMS2 as player 2")

		// Knockout Rounds in MS Category
		assert.Len(t, retrievedMSCategory.KnockoutRounds, 1, "MS category should have 1 knockout round")
		msKORound1 := retrievedMSCategory.KnockoutRounds[0]
		assert.Equal(t, 1, msKORound1.Round)
		assert.Len(t, msKORound1.Matches, 1, "MS KO Round 1 should have 1 match")
		assert.Equal(t, "Center Court", msKORound1.Matches[0].Table)
		assert.WithinDuration(t, koMatchTime.Time, msKORound1.Matches[0].DateTime.Time, time.Second)

		// --- Assertions for Women's Doubles Category (wdCategory) ---
		retrievedWDCategory := retrievedTournament.Categories[1]
		assert.Equal(t, wdCategory.Name, retrievedWDCategory.Name)
		assert.Len(t, retrievedWDCategory.Entries, 2, "WD category should have 2 entries")
		wdEntry1Retrieved := retrievedWDCategory.Entries[0]
		assert.Equal(t, entryWD1.Name, wdEntry1Retrieved.Name)
		assert.Len(t, wdEntry1Retrieved.Players, 2, "WD Entry 1 should have 2 players")
		assert.True(t, hasPlayer(wdEntry1Retrieved.Players, playerWD1A.Name), "WD Entry 1 missing playerWD1A")
		assert.True(t, hasPlayer(wdEntry1Retrieved.Players, playerWD1B.Name), "WD Entry 1 missing playerWD1B")

		// --- Assertions for Mixed Team Category (teamCategory) ---
		retrievedTeamCategory := retrievedTournament.Categories[2]
		assert.Equal(t, teamCategory.Name, retrievedTeamCategory.Name)
		assert.Len(t, retrievedTeamCategory.Entries, 2, "Team category should have 2 entries")
		teamEntryAlphaRetrieved := retrievedTeamCategory.Entries[0]
		assert.Equal(t, entryTeamAlpha.Name, teamEntryAlphaRetrieved.Name) // team name is in Entry.Name
		assert.Len(t, teamEntryAlphaRetrieved.Players, 2, "Team Alpha entry should have 2 players")
		assert.True(t, hasPlayer(teamEntryAlphaRetrieved.Players, teamAlphaPlayer1.Name), "Team Alpha missing player1")
		assert.True(t, hasPlayer(teamEntryAlphaRetrieved.Players, teamAlphaPlayer2.Name), "Team Alpha missing player2")

		// --- Assertions for Empty Category ---
		retrievedEmptyCategory := retrievedTournament.Categories[3]
		assert.Equal(t, emptyCategory.Name, retrievedEmptyCategory.Name)
		assert.Len(t, retrievedEmptyCategory.Entries, 0, "Empty category should have 0 entries")
		assert.Len(t, retrievedEmptyCategory.Groups, 0, "Empty category should have 0 groups")
		assert.Len(t, retrievedEmptyCategory.KnockoutRounds, 0, "Empty category should have 0 knockout rounds")
	})

	t.Run("Get tournament that does not exist", func(t *testing.T) {
		nonExistentID := uint(99999)
		retrievedTournament, errGet := repo.GetTournament(nonExistentID)
		assert.NoError(t, errGet, "GetTournament for non-existent ID should not error")
		assert.Nil(t, retrievedTournament, "GetTournament for non-existent ID should return nil")
	})
}

func TestGroupRoundsAndTeamRoundsPersistence(t *testing.T) {
	db := setupTestDB(t)
	// Test for Rounds (non-team)
	t.Run("Rounds (non-team)", func(t *testing.T) {
		group := model.Group{
			EntriesIdx: []int{0, 1},
			Rounds: [][]model.Match{{
				{
					Table:           "1",
					Entry1Idx:       0,
					Entry2Idx:       1,
					Players1Idx:     []uint{0},
					Players2Idx:     []uint{1},
					DurationMinutes: 30,
				},
				{
					Table:           "2",
					Entry1Idx:       1,
					Entry2Idx:       0,
					Players1Idx:     []uint{1},
					Players2Idx:     []uint{0},
					DurationMinutes: 35,
				},
			}},
		}
		err := db.Create(&group).Error
		assert.NoError(t, err)

		var got model.Group
		err = db.Preload("Matches").First(&got, group.ID).Error
		assert.NoError(t, err)
		assert.Len(t, got.Matches, 2)
		assert.NotNil(t, got.Rounds)
		assert.Len(t, got.Rounds, 1)
		assert.Len(t, got.Rounds[0], 2)
		assert.Equal(t, "1", got.Rounds[0][0].Table)
		assert.Equal(t, "2", got.Rounds[0][1].Table)
		// Ensure indices are set
		assert.NotNil(t, got.Rounds[0][0].RoundRobinRound)
		assert.NotNil(t, got.Rounds[0][1].RoundRobinMatchIdx)
	})

	// Test for TeamRounds (team)
	t.Run("TeamRounds (team)", func(t *testing.T) {
		teamMatch1 := model.TeamMatches{
			Entry1Idx: 0,
			Entry2Idx: 1,
			CategoryID: 5,
			CategoryShortName: "TEAM",
			Matches: []model.Match{
				{
					Table:           "T1",
					Entry1Idx:       0,
					Entry2Idx:       1,
					Players1Idx:     []uint{0},
					Players2Idx:     []uint{1},
					DurationMinutes: 40,
				},
				{
					Table:           "T2",
					Entry1Idx:       0,
					Entry2Idx:       1,
					Players1Idx:     []uint{0},
					Players2Idx:     []uint{1},
					DurationMinutes: 45,
				},
			},
		}
		teamMatch2 := model.TeamMatches{
			Entry1Idx: 1,
			Entry2Idx: 0,
			CategoryID: 5,
			CategoryShortName: "TEAM",
			Matches: []model.Match{
				{
					Table:           "T3",
					Entry1Idx:       1,
					Entry2Idx:       0,
					Players1Idx:     []uint{1},
					Players2Idx:     []uint{0},
					DurationMinutes: 50,
				},
			},
		}
		group := model.Group{
			EntriesIdx: []int{0, 1},
			TeamRounds: [][]model.TeamMatches{{teamMatch1, teamMatch2}},
		}
		err := db.Create(&group).Error
		assert.NoError(t, err)

		var got model.Group
		err = db.Preload("Matches").First(&got, group.ID).Error
		assert.NoError(t, err)
		assert.Len(t, got.Matches, 3)
		assert.NotNil(t, got.TeamRounds)
		assert.Len(t, got.TeamRounds, 1)
		assert.Len(t, got.TeamRounds[0], 2)
		assert.Equal(t, "T1", got.TeamRounds[0][0].Matches[0].Table)
		assert.Equal(t, "T2", got.TeamRounds[0][0].Matches[1].Table)
		assert.Equal(t, "T3", got.TeamRounds[0][1].Matches[0].Table)
		// Ensure indices and team info are set
		assert.NotNil(t, got.TeamRounds[0][0].Matches[0].LineupIdx)
		assert.Equal(t, 0, got.TeamRounds[0][0].Matches[0].Entry1Idx)
		assert.Equal(t, 1, got.TeamRounds[0][0].Matches[0].Entry2Idx)
		assert.Equal(t, "TEAM", got.TeamRounds[0][0].Matches[0].CategoryShortName)
	})
}

// Note: Testing DB failure scenarios without a more complex mocking framework for GORM
// can be challenging. For now, we focus on the happy path and repository logic.
