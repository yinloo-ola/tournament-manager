package repo

import (
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/yinloo-ola/tournament-manager/model"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// MatchRepo provides database operations for match data
type MatchRepo struct {
	db *gorm.DB
}

// NewMatchRepo creates a new MatchRepo
func NewMatchRepo(db *gorm.DB) *MatchRepo {
	return &MatchRepo{
		db: db,
	}
}

// SaveMatch saves a match to the database using GORM
func (r *MatchRepo) SaveMatch(
	categoryID uint,
	matchInput model.Match, // Input match data, potentially with non-persistent fields like Entry1Idx
	groupID *uint,
	knockoutRoundID *uint,
	tx *gorm.DB,
) (uint, error) {
	dbHandle := r.db
	if tx != nil {
		dbHandle = tx
	}

	// 1. Get CategoryShortName
	var category model.Category
	if err := dbHandle.Select("short_name").First(&category, categoryID).Error; err != nil {
		slog.Error("Failed to get category short name", "categoryID", categoryID, "error", err)
		return 0, fmt.Errorf("failed to get category short name for ID %d: %w", categoryID, err)
	}

	// 2. Prepare GORM model.Match instance (dbMatch)
	dbMatch := model.Match{
		CategoryID:        categoryID,
		GroupID:           groupID,
		KnockoutRoundID:   knockoutRoundID,
		DateTime:          matchInput.DateTime,
		DurationMinutes:   matchInput.DurationMinutes,
		Table:             matchInput.Table,
		CategoryShortName: category.ShortName,
		GroupIdx:          matchInput.GroupIdx, // Persisted for context
		RoundIdx:          matchInput.RoundIdx, // Persisted for context
		Round:             matchInput.Round,    // Persisted for context (e.g. knockout round number)
		MatchIdx:          matchInput.MatchIdx, // Persisted for context
	}

	// 3. Get Entry IDs from Entry1Idx and Entry2Idx
	var entry1ID, entry2ID *uint
	if matchInput.Entry1Idx >= 0 {
		var e1 model.Entry
		err := dbHandle.Model(&model.Entry{}).
			Select("id").
			Where("category_id = ?", categoryID).
			Order("id asc").
			Offset(matchInput.Entry1Idx).
			Limit(1).
			First(&e1).Error
		if err != nil {
			slog.Error("Failed to get entry1 ID from index", "categoryID", categoryID, "entryIndex", matchInput.Entry1Idx, "error", err)
			return 0, fmt.Errorf("failed to get entry1 ID for index %d: %w", matchInput.Entry1Idx, err)
		}
		entry1ID = &e1.ID
		dbMatch.Entry1ID = entry1ID
	}

	if matchInput.Entry2Idx >= 0 {
		var e2 model.Entry
		err := dbHandle.Model(&model.Entry{}).
			Select("id").
			Where("category_id = ?", categoryID).
			Order("id asc").
			Offset(matchInput.Entry2Idx).
			Limit(1).
			First(&e2).Error
		if err != nil {
			slog.Error("Failed to get entry2 ID from index", "categoryID", categoryID, "entryIndex", matchInput.Entry2Idx, "error", err)
			return 0, fmt.Errorf("failed to get entry2 ID for index %d: %w", matchInput.Entry2Idx, err)
		}
		entry2ID = &e2.ID
		dbMatch.Entry2ID = entry2ID
	}

	// 4. Marshal Games and MatchesInTeamMatch to JSON
	if matchInput.Games != nil {
		gamesJSON, err := json.Marshal(matchInput.Games)
		if err != nil {
			slog.Error("Failed to marshal games", "error", err)
			return 0, fmt.Errorf("failed to marshal games: %w", err)
		}
		dbMatch.GamesRaw = datatypes.JSON(gamesJSON)
	} else {
		dbMatch.GamesRaw = datatypes.JSON("[]") // Store as empty JSON array if nil
	}

	if matchInput.MatchesInTeamMatch != nil && len(matchInput.MatchesInTeamMatch) > 0 {
		matchesInTeamMatchJSON, err := json.Marshal(matchInput.MatchesInTeamMatch)
		if err != nil {
			slog.Error("Failed to marshal matches in team match", "error", err)
			return 0, fmt.Errorf("failed to marshal matches in team match: %w", err)
		}
		dbMatch.MatchesInTeamMatchRaw = datatypes.JSON(matchesInTeamMatchJSON)
	} else {
		dbMatch.MatchesInTeamMatchRaw = datatypes.JSON("[]")
	}

	// 5. Determine WinnerEntryID and Scores
	// Scores (Score1, Score2) are now part of model.Match and DDL
	var score1, score2 int
	if matchInput.Games != nil && len(matchInput.Games) > 0 {
		for _, game := range matchInput.Games {
			if len(game) == 2 { // Ensure game has two scores
				if game[0] > game[1] {
					score1++
				} else if game[1] > game[0] {
					score2++
				}
			}
		}
		dbMatch.Score1 = &score1
		dbMatch.Score2 = &score2

		if score1 > score2 && entry1ID != nil {
			dbMatch.WinnerEntryID = entry1ID
		} else if score2 > score1 && entry2ID != nil {
			dbMatch.WinnerEntryID = entry2ID
		}
	}

	// 6. Upsert logic: Find by unique criteria, then create or update.
	// Unique criteria for a match: CategoryID, MatchIdx, and either (GroupID and RoundIdx) or (KnockoutRoundID)
	var findCondition model.Match
	findCondition.CategoryID = categoryID
	findCondition.MatchIdx = matchInput.MatchIdx

	if groupID != nil {
		findCondition.GroupID = groupID
		findCondition.RoundIdx = matchInput.RoundIdx // RoundIdx is relevant for group matches
	} else if knockoutRoundID != nil {
		findCondition.KnockoutRoundID = knockoutRoundID
		// Round (overall round number) is part of dbMatch, not typically a unique find criteria here if KnockoutRoundID is present
	} else {
		slog.Error("SaveMatch called without GroupID or KnockoutRoundID", "categoryID", categoryID, "matchIdx", matchInput.MatchIdx)
		return 0, fmt.Errorf("match must have either GroupID or KnockoutRoundID")
	}

	// Using Clauses.Assign to ensure all fields are updated on conflict or new fields are set for creation.
	// The .Where condition for FirstOrCreate/Save should be specific enough to find the unique match.
	// GORM's Save method handles upsert if primary key is set and exists, or creates if not.
	// For more complex unique constraints not on PK, FirstOrCreate with Attrs/Assign is better.

	// Let's try to find it first
	var existingMatch model.Match
	query := dbHandle.Where(&findCondition)

	err := query.First(&existingMatch).Error
	if err == nil { // Found, so update
		dbMatch.ID = existingMatch.ID // Set ID for update
		if updErr := dbHandle.Model(&existingMatch).Updates(dbMatch).Error; updErr != nil {
			slog.Error("Failed to update existing match", "matchID", existingMatch.ID, "error", updErr)
			return 0, fmt.Errorf("failed to update match %d: %w", existingMatch.ID, updErr)
		}
		return existingMatch.ID, nil
	} else if err == gorm.ErrRecordNotFound { // Not found, create
		if createErr := dbHandle.Create(&dbMatch).Error; createErr != nil {
			slog.Error("Failed to create new match", "error", createErr)
			return 0, fmt.Errorf("failed to create match: %w", createErr)
		}
		return dbMatch.ID, nil
	} else { // Other error
		slog.Error("Error finding match for save", "condition", findCondition, "error", err)
		return 0, fmt.Errorf("error finding match: %w", err)
	}
}

// SaveGroupMatches saves all matches for a group
func (r *MatchRepo) SaveGroupMatches(categoryID, groupID uint, groupIdx int, rounds [][]model.Match, tx *gorm.DB) error {
	dbHandle := r.db
	if tx != nil {
		dbHandle = tx
	}
	for _, roundMatches := range rounds {
		for _, match := range roundMatches {
			// Ensure GroupIdx is set from the loop context if not already on match
			// match.GroupIdx = groupIdx // match already has GroupIdx from generation
			_, err := r.SaveMatch(categoryID, match, &groupID, nil, dbHandle)
			if err != nil {
				slog.Error("Failed to save group match", "categoryID", categoryID, "groupID", groupID, "matchIdx", match.MatchIdx, "error", err)
				return fmt.Errorf("failed to save match for group %d, matchIdx %d: %w", groupID, match.MatchIdx, err)
			}
		}
	}
	return nil
}

// SaveKnockoutMatches saves all matches for a knockout round
func (r *MatchRepo) SaveKnockoutMatches(categoryID, knockoutRoundID uint, roundVal int, matches []model.Match, tx *gorm.DB) error {
	dbHandle := r.db
	if tx != nil {
		dbHandle = tx
	}
	for _, match := range matches {
		// match.Round = roundVal // match.Round should already be set correctly from generation
		_, err := r.SaveMatch(categoryID, match, nil, &knockoutRoundID, dbHandle)
		if err != nil {
			slog.Error("Failed to save knockout match", "categoryID", categoryID, "knockoutRoundID", knockoutRoundID, "matchIdx", match.MatchIdx, "error", err)
			return fmt.Errorf("failed to save match for knockout round %d, matchIdx %d: %w", knockoutRoundID, match.MatchIdx, err)
		}
	}
	return nil
}

// GetMatchesByGroupID retrieves all matches for a group
func (r *MatchRepo) GetMatchesByGroupID(groupID uint) ([][]model.Match, error) {
	var groupInfo struct {
		CategoryID uint
		GroupIndex int
	}
	// Assuming model.Group has gorm tags for ID, CategoryID, GroupIndex
	err := r.db.Model(&model.Group{}).Select("category_id, group_index").Where("id = ?", groupID).First(&groupInfo).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			slog.Warn("Group not found for GetMatchesByGroupID", "groupID", groupID)
			return nil, nil
		}
		slog.Error("Failed to get group info for GetMatchesByGroupID", "groupID", groupID, "error", err)
		return nil, fmt.Errorf("failed to get group info for ID %d: %w", groupID, err)
	}
	categoryID := groupInfo.CategoryID
	fetchedGroupIdx := groupInfo.GroupIndex

	var entries []model.Entry
	err = r.db.Model(&model.Entry{}).Select("id").Where("category_id = ?", categoryID).Order("id asc").Find(&entries).Error
	if err != nil {
		slog.Error("Failed to get entries for category in GetMatchesByGroupID", "categoryID", categoryID, "error", err)
		return nil, fmt.Errorf("failed to get entries for category %d: %w", categoryID, err)
	}

	entryIDToIdx := make(map[uint]int)
	for i, entry := range entries {
		entryIDToIdx[entry.ID] = i
	}

	var dbMatches []model.Match
	err = r.db.Where("group_id = ?", groupID).Order("round_idx asc, match_idx asc").Find(&dbMatches).Error
	if err != nil {
		slog.Error("Failed to get matches for group in GetMatchesByGroupID", "groupID", groupID, "error", err)
		return nil, fmt.Errorf("failed to get matches for group %d: %w", groupID, err)
	}

	var resultRounds [][]model.Match
	currentRoundIdx := -1

	for _, dbMatch := range dbMatches {
		matchPopulated := dbMatch                 // Start with a copy
		matchPopulated.GroupIdx = fetchedGroupIdx // Set from fetched groupInfo

		if dbMatch.Entry1ID != nil {
			if idx, ok := entryIDToIdx[*dbMatch.Entry1ID]; ok {
				matchPopulated.Entry1Idx = idx
			} else {
				slog.Warn("GetMatchesByGroupID: Entry1ID not found in map", "entryID", *dbMatch.Entry1ID, "matchID", dbMatch.ID)
				matchPopulated.Entry1Idx = model.EntryEmptyIdx
			}
		} else {
			matchPopulated.Entry1Idx = model.EntryEmptyIdx
		}

		if dbMatch.Entry2ID != nil {
			if idx, ok := entryIDToIdx[*dbMatch.Entry2ID]; ok {
				matchPopulated.Entry2Idx = idx
			} else {
				slog.Warn("GetMatchesByGroupID: Entry2ID not found in map", "entryID", *dbMatch.Entry2ID, "matchID", dbMatch.ID)
				matchPopulated.Entry2Idx = model.EntryEmptyIdx
			}
		} else {
			matchPopulated.Entry2Idx = model.EntryEmptyIdx
		}

		if len(dbMatch.GamesRaw) > 0 {
			if err := json.Unmarshal(dbMatch.GamesRaw, &matchPopulated.Games); err != nil {
				slog.Error("Failed to unmarshal GamesRaw", "matchID", dbMatch.ID, "error", err)
				// Potentially return error or set Games to nil/empty
			}
		} else {
			matchPopulated.Games = []model.Game{}
		}

		if len(dbMatch.MatchesInTeamMatchRaw) > 0 {
			if err := json.Unmarshal(dbMatch.MatchesInTeamMatchRaw, &matchPopulated.MatchesInTeamMatch); err != nil {
				slog.Error("Failed to unmarshal MatchesInTeamMatchRaw", "matchID", dbMatch.ID, "error", err)
				// Potentially return error or set MatchesInTeamMatch to nil/empty
			}
		} else {
			matchPopulated.MatchesInTeamMatch = []model.MatchInTeamMatch{}
		}

		if matchPopulated.RoundIdx != currentRoundIdx {
			resultRounds = append(resultRounds, []model.Match{})
			currentRoundIdx = matchPopulated.RoundIdx
		}
		if len(resultRounds) == 0 {
			resultRounds = append(resultRounds, []model.Match{})
		}
		resultRounds[len(resultRounds)-1] = append(resultRounds[len(resultRounds)-1], matchPopulated)
	}
	return resultRounds, nil
}

// GetMatchesByKnockoutRoundID retrieves all matches for a knockout round
func (r *MatchRepo) GetMatchesByKnockoutRoundID(knockoutRoundID uint) ([]model.Match, error) {
	var knockoutRoundInfo struct {
		CategoryID  uint
		RoundNumber int `gorm:"column:round_number"`
	}
	err := r.db.Model(&model.KnockoutRound{}).Select("category_id, round_number").Where("id = ?", knockoutRoundID).First(&knockoutRoundInfo).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			slog.Warn("Knockout round not found for GetMatchesByKnockoutRoundID", "knockoutRoundID", knockoutRoundID)
			return nil, nil
		}
		slog.Error("Failed to get knockout round info", "knockoutRoundID", knockoutRoundID, "error", err)
		return nil, fmt.Errorf("failed to get knockout round info for ID %d: %w", knockoutRoundID, err)
	}
	categoryID := knockoutRoundInfo.CategoryID
	roundNumber := knockoutRoundInfo.RoundNumber

	var entries []model.Entry
	err = r.db.Model(&model.Entry{}).Select("id").Where("category_id = ?", categoryID).Order("id asc").Find(&entries).Error
	if err != nil {
		slog.Error("Failed to get entries for category in GetMatchesByKnockoutRoundID", "categoryID", categoryID, "error", err)
		return nil, fmt.Errorf("failed to get entries for category %d: %w", categoryID, err)
	}

	entryIDToIdx := make(map[uint]int)
	for i, entry := range entries {
		entryIDToIdx[entry.ID] = i
	}

	var dbMatches []model.Match
	err = r.db.Where("knockout_round_id = ?", knockoutRoundID).Order("match_idx asc").Find(&dbMatches).Error
	if err != nil {
		slog.Error("Failed to get matches for knockout round", "knockoutRoundID", knockoutRoundID, "error", err)
		return nil, fmt.Errorf("failed to get matches for knockout round %d: %w", knockoutRoundID, err)
	}

	var resultMatches []model.Match
	for _, dbMatch := range dbMatches {
		matchPopulated := dbMatch
		matchPopulated.GroupIdx = -1 // Indicates knockout match
		matchPopulated.Round = roundNumber

		if dbMatch.Entry1ID != nil {
			if idx, ok := entryIDToIdx[*dbMatch.Entry1ID]; ok {
				matchPopulated.Entry1Idx = idx
			} else {
				slog.Warn("GetMatchesByKnockoutRoundID: Entry1ID not found in map", "entryID", *dbMatch.Entry1ID, "matchID", dbMatch.ID)
				matchPopulated.Entry1Idx = model.EntryEmptyIdx
			}
		} else {
			matchPopulated.Entry1Idx = model.EntryEmptyIdx
		}

		if dbMatch.Entry2ID != nil {
			if idx, ok := entryIDToIdx[*dbMatch.Entry2ID]; ok {
				matchPopulated.Entry2Idx = idx
			} else {
				slog.Warn("GetMatchesByKnockoutRoundID: Entry2ID not found in map", "entryID", *dbMatch.Entry2ID, "matchID", dbMatch.ID)
				matchPopulated.Entry2Idx = model.EntryEmptyIdx
			}
		} else {
			matchPopulated.Entry2Idx = model.EntryEmptyIdx
		}

		if len(dbMatch.GamesRaw) > 0 {
			if err := json.Unmarshal(dbMatch.GamesRaw, &matchPopulated.Games); err != nil {
				slog.Error("Failed to unmarshal GamesRaw for knockout match", "matchID", dbMatch.ID, "error", err)
			}
		} else {
			matchPopulated.Games = []model.Game{}
		}

		if len(dbMatch.MatchesInTeamMatchRaw) > 0 {
			if err := json.Unmarshal(dbMatch.MatchesInTeamMatchRaw, &matchPopulated.MatchesInTeamMatch); err != nil {
				slog.Error("Failed to unmarshal MatchesInTeamMatchRaw for knockout match", "matchID", dbMatch.ID, "error", err)
			}
		} else {
			matchPopulated.MatchesInTeamMatch = []model.MatchInTeamMatch{}
		}
		resultMatches = append(resultMatches, matchPopulated)
	}
	return resultMatches, nil
}

// DeleteMatch deletes a match
func (r *MatchRepo) DeleteMatch(matchID uint) error {
	err := r.db.Delete(&model.Match{}, matchID).Error
	if err != nil {
		slog.Error("Failed to delete match", "matchID", matchID, "error", err)
		return fmt.Errorf("failed to delete match %d: %w", matchID, err)
	}
	return nil
}

// Helper to convert *int64 to *uint, not strictly needed if types are consistent (uint for IDs)
// func NullInt64ToUintPtr(val *int64) *uint {
// 	if val == nil {
// 		return nil
// 	}
// 	uVal := uint(*val)
// 	return &uVal
// }
