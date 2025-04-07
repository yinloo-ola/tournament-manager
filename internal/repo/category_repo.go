package repo

import (
	"database/sql"
	"fmt"
	"log/slog"

	"github.com/yinloo-ola/tournament-manager/model"
)

// CategoryRepo provides database operations for category data
type CategoryRepo struct {
	db *sql.DB
}

// NewCategoryRepo creates a new CategoryRepo
func NewCategoryRepo(db *sql.DB) *CategoryRepo {
	return &CategoryRepo{
		db: db,
	}
}

// SaveCategory saves a category to the database and returns the ID
func (r *CategoryRepo) SaveCategory(tournamentID int64, category model.Category) (int64, error) {
	// Check if we have lineup items
	var err error
	if len(category.Lineup) > 0 {
		// Validate lineup items
		for _, item := range category.Lineup {
			if item.Name == "" || item.GenderRequirement == "" {
				return 0, fmt.Errorf("invalid lineup item: missing required fields")
			}
		}
	}

	// Check if category with the same name and tournament_id already exists
	var existingID int64
	err = r.db.QueryRow("SELECT id FROM categories WHERE tournament_id = ? AND name = ?", 
		tournamentID, category.Name).Scan(&existingID)
	
	var result sql.Result
	if err == nil {
		// Category exists, update it
		_, err = r.db.Exec(
			`UPDATE categories SET 
				short_name = ?, 
				entry_type = ?, 
				entries_per_grp_main = ?, 
				entries_per_grp_remainder = ?, 
				duration_minutes = ?, 
				num_qualified_per_group = ?, 
				min_players = ?, 
				max_players = ? 
			WHERE id = ?`,
			category.ShortName,
			category.EntryType,
			category.EntriesPerGrpMain,
			category.EntriesPerGrpRemainder,
			category.DurationMinutes,
			category.NumQualifiedPerGroup,
			category.MinPlayers,
			category.MaxPlayers,
			existingID,
		)
		if err != nil {
			slog.Error("Failed to update category", "error", err)
			return 0, fmt.Errorf("failed to update category: %w", err)
		}
		
		// Delete existing lineup items
		_, err = r.db.Exec("DELETE FROM lineup_items WHERE category_id = ?", existingID)
		if err != nil {
			slog.Error("Failed to delete existing lineup items", "error", err)
			return 0, fmt.Errorf("failed to delete existing lineup items: %w", err)
		}
		
		return existingID, nil
	} else if err == sql.ErrNoRows {
		// Category doesn't exist, insert new one
		result, err = r.db.Exec(
			`INSERT INTO categories (
				tournament_id, 
				name, 
				short_name, 
				entry_type, 
				entries_per_grp_main, 
				entries_per_grp_remainder, 
				duration_minutes, 
				num_qualified_per_group, 
				min_players, 
				max_players
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			tournamentID,
			category.Name,
			category.ShortName,
			category.EntryType,
			category.EntriesPerGrpMain,
			category.EntriesPerGrpRemainder,
			category.DurationMinutes,
			category.NumQualifiedPerGroup,
			category.MinPlayers,
			category.MaxPlayers,
		)
		if err != nil {
			slog.Error("Failed to insert category", "error", err)
			return 0, fmt.Errorf("failed to save category: %w", err)
		}
		
		existingID, err = result.LastInsertId()
		if err != nil {
			slog.Error("Failed to get inserted category ID", "error", err)
			return 0, fmt.Errorf("failed to get category ID: %w", err)
		}
	} else {
		// Some other error occurred
		slog.Error("Database error when checking for existing category", "error", err)
		return 0, fmt.Errorf("database error: %w", err)
	}

	// Save lineup items if they exist
	if len(category.Lineup) > 0 {
		for _, item := range category.Lineup {
			var ageReqType sql.NullString
			var ageReqValue sql.NullInt64
			
			if item.AgeRequirement != nil {
				ageReqType.String = item.AgeRequirement.Type
				ageReqType.Valid = true
				ageReqValue.Int64 = int64(item.AgeRequirement.Value)
				ageReqValue.Valid = true
			}
			
			_, err = r.db.Exec(
				`INSERT INTO lineup_items (
					category_id, 
					name, 
					match_type, 
					gender_requirement, 
					age_req_type, 
					age_req_value
				) VALUES (?, ?, ?, ?, ?, ?)`,
				existingID,
				item.Name,
				item.MatchType,
				item.GenderRequirement,
				ageReqType,
				ageReqValue,
			)
			if err != nil {
				slog.Error("Failed to insert lineup item", "error", err)
				return existingID, fmt.Errorf("failed to save lineup item: %w", err)
			}
		}
	}

	return existingID, nil
}

// GetCategoryByID retrieves a category by its ID
func (r *CategoryRepo) GetCategoryByID(categoryID int64) (*model.Category, error) {
	var category model.Category
	var minPlayers, maxPlayers sql.NullInt64
	
	err := r.db.QueryRow(
		`SELECT 
			name, 
			short_name, 
			entry_type, 
			entries_per_grp_main, 
			entries_per_grp_remainder, 
			duration_minutes, 
			num_qualified_per_group, 
			min_players, 
			max_players 
		FROM categories WHERE id = ?`, 
		categoryID).Scan(
			&category.Name,
			&category.ShortName,
			&category.EntryType,
			&category.EntriesPerGrpMain,
			&category.EntriesPerGrpRemainder,
			&category.DurationMinutes,
			&category.NumQualifiedPerGroup,
			&minPlayers,
			&maxPlayers,
		)
	
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // Category not found
		}
		return nil, fmt.Errorf("failed to get category: %w", err)
	}
	
	if minPlayers.Valid {
		min := int(minPlayers.Int64)
		category.MinPlayers = &min
	}
	
	if maxPlayers.Valid {
		max := int(maxPlayers.Int64)
		category.MaxPlayers = &max
	}
	
	// Get lineup items
	rows, err := r.db.Query(
		`SELECT 
			name, 
			match_type, 
			gender_requirement, 
			age_req_type, 
			age_req_value 
		FROM lineup_items 
		WHERE category_id = ?`, 
		categoryID)
	
	if err != nil {
		return nil, fmt.Errorf("failed to get lineup items: %w", err)
	}
	defer rows.Close()
	
	for rows.Next() {
		var item model.LineupItem
		var ageReqType, genderReq sql.NullString
		var ageReqValue sql.NullInt64
		
		err := rows.Scan(
			&item.Name,
			&item.MatchType,
			&genderReq,
			&ageReqType,
			&ageReqValue,
		)
		
		if err != nil {
			return nil, fmt.Errorf("failed to scan lineup item: %w", err)
		}
		
		if genderReq.Valid {
			item.GenderRequirement = genderReq.String
		}
		
		if ageReqType.Valid && ageReqValue.Valid {
			item.AgeRequirement = &model.AgeRequirement{
				Type:  ageReqType.String,
				Value: int(ageReqValue.Int64),
			}
		}
		
		category.Lineup = append(category.Lineup, item)
	}
	
	return &category, nil
}

// GetCategoriesByTournamentID retrieves all categories for a tournament
func (r *CategoryRepo) GetCategoriesByTournamentID(tournamentID int64) ([]model.Category, error) {
	rows, err := r.db.Query(
		`SELECT 
			id, 
			name, 
			short_name, 
			entry_type, 
			entries_per_grp_main, 
			entries_per_grp_remainder, 
			duration_minutes, 
			num_qualified_per_group, 
			min_players, 
			max_players 
		FROM categories 
		WHERE tournament_id = ?`, 
		tournamentID)
	
	if err != nil {
		return nil, fmt.Errorf("failed to get categories: %w", err)
	}
	defer rows.Close()
	
	var categories []model.Category
	
	for rows.Next() {
		var category model.Category
		var categoryID int64
		var minPlayers, maxPlayers sql.NullInt64
		
		err := rows.Scan(
			&categoryID,
			&category.Name,
			&category.ShortName,
			&category.EntryType,
			&category.EntriesPerGrpMain,
			&category.EntriesPerGrpRemainder,
			&category.DurationMinutes,
			&category.NumQualifiedPerGroup,
			&minPlayers,
			&maxPlayers,
		)
		
		if err != nil {
			return nil, fmt.Errorf("failed to scan category: %w", err)
		}
		
		if minPlayers.Valid {
			min := int(minPlayers.Int64)
			category.MinPlayers = &min
		}
		
		if maxPlayers.Valid {
			max := int(maxPlayers.Int64)
			category.MaxPlayers = &max
		}
		
		// Get lineup items
		lineupRows, err := r.db.Query(
			`SELECT 
				name, 
				match_type, 
				gender_requirement, 
				age_req_type, 
				age_req_value 
			FROM lineup_items 
			WHERE category_id = ?`, 
			categoryID)
		
		if err != nil {
			return nil, fmt.Errorf("failed to get lineup items: %w", err)
		}
		
		for lineupRows.Next() {
			var item model.LineupItem
			var ageReqType, genderReq sql.NullString
			var ageReqValue sql.NullInt64
			
			err := lineupRows.Scan(
				&item.Name,
				&item.MatchType,
				&genderReq,
				&ageReqType,
				&ageReqValue,
			)
			
			if err != nil {
				lineupRows.Close()
				return nil, fmt.Errorf("failed to scan lineup item: %w", err)
			}
			
			if genderReq.Valid {
				item.GenderRequirement = genderReq.String
			}
			
			if ageReqType.Valid && ageReqValue.Valid {
				item.AgeRequirement = &model.AgeRequirement{
					Type:  ageReqType.String,
					Value: int(ageReqValue.Int64),
				}
			}
			
			category.Lineup = append(category.Lineup, item)
		}
		lineupRows.Close()
		
		categories = append(categories, category)
	}
	
	return categories, nil
}

// DeleteCategory deletes a category and all related data
func (r *CategoryRepo) DeleteCategory(categoryID int64) error {
	// Start a transaction
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	
	// Delete lineup items
	_, err = tx.Exec("DELETE FROM lineup_items WHERE category_id = ?", categoryID)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete lineup items: %w", err)
	}
	
	// Delete matches
	_, err = tx.Exec("DELETE FROM matches WHERE category_id = ?", categoryID)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete matches: %w", err)
	}
	
	// Delete knockout rounds
	_, err = tx.Exec("DELETE FROM knockout_rounds WHERE category_id = ?", categoryID)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete knockout rounds: %w", err)
	}
	
	// Delete group entries
	_, err = tx.Exec("DELETE FROM group_entries WHERE group_id IN (SELECT id FROM groups WHERE category_id = ?)", categoryID)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete group entries: %w", err)
	}
	
	// Delete groups
	_, err = tx.Exec("DELETE FROM groups WHERE category_id = ?", categoryID)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete groups: %w", err)
	}
	
	// Delete players
	_, err = tx.Exec("DELETE FROM players WHERE category_id = ?", categoryID)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete players: %w", err)
	}
	
	// Delete entries
	_, err = tx.Exec("DELETE FROM entries WHERE category_id = ?", categoryID)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete entries: %w", err)
	}
	
	// Delete category
	_, err = tx.Exec("DELETE FROM categories WHERE id = ?", categoryID)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete category: %w", err)
	}
	
	// Commit transaction
	err = tx.Commit()
	if err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}
	
	return nil
}
