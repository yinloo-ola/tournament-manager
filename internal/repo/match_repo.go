package repo

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/yinloo-ola/tournament-manager/model"
)

// MatchRepo provides database operations for match data
type MatchRepo struct {
	db *sql.DB
}

// NewMatchRepo creates a new MatchRepo
func NewMatchRepo(db *sql.DB) *MatchRepo {
	return &MatchRepo{
		db: db,
	}
}

// SaveMatch saves a match to the database
func (r *MatchRepo) SaveMatch(categoryID int64, match model.Match, groupID, knockoutRoundID sql.NullInt64) (int64, error) {
	// Get category short name
	var categoryShortName string
	err := r.db.QueryRow("SELECT short_name FROM categories WHERE id = ?", categoryID).Scan(&categoryShortName)
	if err != nil {
		return 0, fmt.Errorf("failed to get category short name: %w", err)
	}

	// Get entry IDs for entry1Idx and entry2Idx
	// Skip if they are bye or empty
	var entry1ID, entry2ID sql.NullInt64

	if match.Entry1Idx >= 0 {
		err = r.db.QueryRow(
			"SELECT id FROM entries WHERE category_id = ? ORDER BY id LIMIT 1 OFFSET ?",
			categoryID, match.Entry1Idx,
		).Scan(&entry1ID.Int64)
		if err != nil {
			return 0, fmt.Errorf("failed to get entry1 ID: %w", err)
		}
		entry1ID.Valid = true
	}

	if match.Entry2Idx >= 0 {
		err = r.db.QueryRow(
			"SELECT id FROM entries WHERE category_id = ? ORDER BY id LIMIT 1 OFFSET ?",
			categoryID, match.Entry2Idx,
		).Scan(&entry2ID.Int64)
		if err != nil {
			return 0, fmt.Errorf("failed to get entry2 ID: %w", err)
		}
		entry2ID.Valid = true
	}

	// Convert games to JSON
	gamesJSON, err := json.Marshal(match.Games)
	if err != nil {
		return 0, fmt.Errorf("failed to marshal games: %w", err)
	}

	// Convert matches in team match to JSON
	var matchesInTeamMatchJSON []byte
	if len(match.MatchesInTeamMatch) > 0 {
		matchesInTeamMatchJSON, err = json.Marshal(match.MatchesInTeamMatch)
		if err != nil {
			return 0, fmt.Errorf("failed to marshal matches in team match: %w", err)
		}
	}

	// Determine winner entry ID
	var winnerEntryID sql.NullInt64
	if match.Games != nil && len(match.Games) > 0 {
		// Calculate scores
		score1 := 0
		score2 := 0
		for _, game := range match.Games {
			if game[0] > game[1] {
				score1++
			} else if game[1] > game[0] {
				score2++
			}
		}

		// Set winner
		if score1 > score2 && entry1ID.Valid {
			winnerEntryID = entry1ID
		} else if score2 > score1 && entry2ID.Valid {
			winnerEntryID = entry2ID
		}
	}

	// Check if match already exists
	var existingID int64
	var existingQuery string
	var existingArgs []interface{}

	if groupID.Valid {
		existingQuery = "SELECT id FROM matches WHERE category_id = ? AND group_id = ? AND round_idx = ? AND match_idx = ?"
		existingArgs = []interface{}{categoryID, groupID.Int64, match.RoundIdx, match.MatchIdx}
	} else if knockoutRoundID.Valid {
		existingQuery = "SELECT id FROM matches WHERE category_id = ? AND knockout_round_id = ? AND match_idx = ?"
		existingArgs = []interface{}{categoryID, knockoutRoundID.Int64, match.MatchIdx}
	}

	err = r.db.QueryRow(existingQuery, existingArgs...).Scan(&existingID)

	if err == nil {
		// Match exists, update it
		_, err = r.db.Exec(
			`UPDATE matches SET 
				entry1_id = ?, 
				entry2_id = ?, 
				datetime = ?, 
				duration_minutes = ?, 
				table_number = ?, 
				round = ?, 
				games = ?, 
				matches_in_team_match = ?, 
				winner_entry_id = ?, 
				score1 = ?, 
				score2 = ? 
			WHERE id = ?`,
			entry1ID,
			entry2ID,
			match.DateTime.Format(time.RFC3339),
			match.DurationMinutes,
			match.Table,
			match.Round,
			gamesJSON,
			matchesInTeamMatchJSON,
			winnerEntryID,
			nil, // score1 - calculated when retrieving
			nil, // score2 - calculated when retrieving
			existingID,
		)
		if err != nil {
			return 0, fmt.Errorf("failed to update match: %w", err)
		}
		return existingID, nil
	} else if err == sql.ErrNoRows {
		// Match doesn't exist, insert new one
		result, err := r.db.Exec(
			`INSERT INTO matches (
				category_id, 
				group_id, 
				knockout_round_id, 
				entry1_id, 
				entry2_id, 
				datetime, 
				duration_minutes, 
				table_number, 
				category_short_name, 
				group_idx, 
				round_idx, 
				round, 
				match_idx, 
				games, 
				matches_in_team_match, 
				winner_entry_id, 
				score1, 
				score2
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			categoryID,
			groupID,
			knockoutRoundID,
			entry1ID,
			entry2ID,
			match.DateTime.Format(time.RFC3339),
			match.DurationMinutes,
			match.Table,
			categoryShortName,
			match.GroupIdx,
			match.RoundIdx,
			match.Round,
			match.MatchIdx,
			gamesJSON,
			matchesInTeamMatchJSON,
			winnerEntryID,
			nil, // score1 - calculated when retrieving
			nil, // score2 - calculated when retrieving
		)
		if err != nil {
			return 0, fmt.Errorf("failed to insert match: %w", err)
		}

		matchID, err := result.LastInsertId()
		if err != nil {
			return 0, fmt.Errorf("failed to get inserted match ID: %w", err)
		}
		return matchID, nil
	} else {
		// Some other error occurred
		return 0, fmt.Errorf("database error when checking for existing match: %w", err)
	}
}

// SaveGroupMatches saves all matches for a group
func (r *MatchRepo) SaveGroupMatches(categoryID, groupID int64, groupIdx int, rounds [][]model.Match) error {
	for _, round := range rounds {
		for _, match := range round {
			groupIDSQL := sql.NullInt64{Int64: groupID, Valid: true}
			_, err := r.SaveMatch(categoryID, match, groupIDSQL, sql.NullInt64{})
			if err != nil {
				return fmt.Errorf("failed to save match: %w", err)
			}
		}
	}
	return nil
}

// SaveKnockoutMatches saves all matches for a knockout round
func (r *MatchRepo) SaveKnockoutMatches(categoryID, knockoutRoundID int64, round int, matches []model.Match) error {
	for _, match := range matches {
		knockoutRoundIDSQL := sql.NullInt64{Int64: knockoutRoundID, Valid: true}
		_, err := r.SaveMatch(categoryID, match, sql.NullInt64{}, knockoutRoundIDSQL)
		if err != nil {
			return fmt.Errorf("failed to save match: %w", err)
		}
	}
	return nil
}

// GetMatchesByGroupID retrieves all matches for a group
func (r *MatchRepo) GetMatchesByGroupID(groupID int64) ([][]model.Match, error) {
	// Get category ID and group index
	var categoryID int64
	var groupIdx int
	err := r.db.QueryRow(
		"SELECT category_id, group_index FROM groups WHERE id = ?",
		groupID,
	).Scan(&categoryID, &groupIdx)
	if err != nil {
		return nil, fmt.Errorf("failed to get group info: %w", err)
	}

	// Get all entries for this category to build the mapping from entry ID to index
	entryRows, err := r.db.Query("SELECT id FROM entries WHERE category_id = ? ORDER BY id", categoryID)
	if err != nil {
		return nil, fmt.Errorf("failed to get entries: %w", err)
	}
	defer entryRows.Close()

	// Build map of entry ID to index
	entryIDToIdx := make(map[int64]int)
	entryIdx := 0
	for entryRows.Next() {
		var entryID int64
		err := entryRows.Scan(&entryID)
		if err != nil {
			return nil, fmt.Errorf("failed to scan entry ID: %w", err)
		}
		entryIDToIdx[entryID] = entryIdx
		entryIdx++
	}

	// Get all matches for this group
	rows, err := r.db.Query(
		`SELECT 
			entry1_id, 
			entry2_id, 
			datetime, 
			duration_minutes, 
			table_number, 
			category_short_name, 
			round_idx, 
			round, 
			match_idx, 
			games, 
			matches_in_team_match 
		FROM matches 
		WHERE group_id = ? 
		ORDER BY round_idx, match_idx`,
		groupID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get matches: %w", err)
	}
	defer rows.Close()

	// Initialize rounds slice
	var rounds [][]model.Match
	var currentRoundIdx = -1

	for rows.Next() {
		var match model.Match
		var entry1ID, entry2ID sql.NullInt64
		var datetimeStr string
		var gamesJSON, matchesInTeamMatchJSON []byte

		err := rows.Scan(
			&entry1ID,
			&entry2ID,
			&datetimeStr,
			&match.DurationMinutes,
			&match.Table,
			&match.CategoryShortName,
			&match.RoundIdx,
			&match.Round,
			&match.MatchIdx,
			&gamesJSON,
			&matchesInTeamMatchJSON,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan match: %w", err)
		}

		// Parse datetime
		match.DateTime, err = time.Parse(time.RFC3339, datetimeStr)
		if err != nil {
			return nil, fmt.Errorf("failed to parse datetime: %w", err)
		}

		// Set group index
		match.GroupIdx = groupIdx

		// Set entry indices
		if entry1ID.Valid {
			match.Entry1Idx = entryIDToIdx[entry1ID.Int64]
		} else {
			match.Entry1Idx = model.EntryEmptyIdx
		}

		if entry2ID.Valid {
			match.Entry2Idx = entryIDToIdx[entry2ID.Int64]
		} else {
			match.Entry2Idx = model.EntryEmptyIdx
		}

		// Parse games
		if gamesJSON != nil {
			err = json.Unmarshal(gamesJSON, &match.Games)
			if err != nil {
				return nil, fmt.Errorf("failed to unmarshal games: %w", err)
			}
		}

		// Parse matches in team match
		if matchesInTeamMatchJSON != nil {
			err = json.Unmarshal(matchesInTeamMatchJSON, &match.MatchesInTeamMatch)
			if err != nil {
				return nil, fmt.Errorf("failed to unmarshal matches in team match: %w", err)
			}
		}

		// Add match to rounds
		if match.RoundIdx != currentRoundIdx {
			// Start a new round
			rounds = append(rounds, []model.Match{})
			currentRoundIdx = match.RoundIdx
		}
		rounds[len(rounds)-1] = append(rounds[len(rounds)-1], match)
	}

	return rounds, nil
}

// GetMatchesByKnockoutRoundID retrieves all matches for a knockout round
func (r *MatchRepo) GetMatchesByKnockoutRoundID(knockoutRoundID int64) ([]model.Match, error) {
	// Get category ID and round number
	var categoryID int64
	var roundNumber int
	err := r.db.QueryRow(
		"SELECT category_id, round_number FROM knockout_rounds WHERE id = ?",
		knockoutRoundID,
	).Scan(&categoryID, &roundNumber)
	if err != nil {
		return nil, fmt.Errorf("failed to get knockout round info: %w", err)
	}

	// Get all entries for this category to build the mapping from entry ID to index
	entryRows, err := r.db.Query("SELECT id FROM entries WHERE category_id = ? ORDER BY id", categoryID)
	if err != nil {
		return nil, fmt.Errorf("failed to get entries: %w", err)
	}
	defer entryRows.Close()

	// Build map of entry ID to index
	entryIDToIdx := make(map[int64]int)
	entryIdx := 0
	for entryRows.Next() {
		var entryID int64
		err := entryRows.Scan(&entryID)
		if err != nil {
			return nil, fmt.Errorf("failed to scan entry ID: %w", err)
		}
		entryIDToIdx[entryID] = entryIdx
		entryIdx++
	}

	// Get all matches for this knockout round
	rows, err := r.db.Query(
		`SELECT 
			entry1_id, 
			entry2_id, 
			datetime, 
			duration_minutes, 
			table_number, 
			category_short_name, 
			round_idx, 
			match_idx, 
			games, 
			matches_in_team_match 
		FROM matches 
		WHERE knockout_round_id = ? 
		ORDER BY match_idx`,
		knockoutRoundID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get matches: %w", err)
	}
	defer rows.Close()

	var matches []model.Match

	for rows.Next() {
		var match model.Match
		var entry1ID, entry2ID sql.NullInt64
		var datetimeStr string
		var gamesJSON, matchesInTeamMatchJSON []byte

		err := rows.Scan(
			&entry1ID,
			&entry2ID,
			&datetimeStr,
			&match.DurationMinutes,
			&match.Table,
			&match.CategoryShortName,
			&match.RoundIdx,
			&match.MatchIdx,
			&gamesJSON,
			&matchesInTeamMatchJSON,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan match: %w", err)
		}

		// Parse datetime
		match.DateTime, err = time.Parse(time.RFC3339, datetimeStr)
		if err != nil {
			return nil, fmt.Errorf("failed to parse datetime: %w", err)
		}

		// Set knockout round info
		match.GroupIdx = -1 // Indicates knockout match
		match.Round = roundNumber

		// Set entry indices
		if entry1ID.Valid {
			match.Entry1Idx = entryIDToIdx[entry1ID.Int64]
		} else {
			match.Entry1Idx = model.EntryEmptyIdx
		}

		if entry2ID.Valid {
			match.Entry2Idx = entryIDToIdx[entry2ID.Int64]
		} else {
			match.Entry2Idx = model.EntryEmptyIdx
		}

		// Parse games
		if gamesJSON != nil {
			err = json.Unmarshal(gamesJSON, &match.Games)
			if err != nil {
				return nil, fmt.Errorf("failed to unmarshal games: %w", err)
			}
		}

		// Parse matches in team match
		if matchesInTeamMatchJSON != nil {
			err = json.Unmarshal(matchesInTeamMatchJSON, &match.MatchesInTeamMatch)
			if err != nil {
				return nil, fmt.Errorf("failed to unmarshal matches in team match: %w", err)
			}
		}

		matches = append(matches, match)
	}

	return matches, nil
}

// DeleteMatch deletes a match
func (r *MatchRepo) DeleteMatch(matchID int64) error {
	_, err := r.db.Exec("DELETE FROM matches WHERE id = ?", matchID)
	if err != nil {
		return fmt.Errorf("failed to delete match: %w", err)
	}
	return nil
}
