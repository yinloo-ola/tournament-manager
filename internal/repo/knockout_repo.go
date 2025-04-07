package repo

import (
	"database/sql"
	"fmt"

	"github.com/yinloo-ola/tournament-manager/model"
)

// KnockoutRepo provides database operations for knockout round data
type KnockoutRepo struct {
	db *sql.DB
}

// NewKnockoutRepo creates a new KnockoutRepo
func NewKnockoutRepo(db *sql.DB) *KnockoutRepo {
	return &KnockoutRepo{
		db: db,
	}
}

// SaveKnockoutRound saves a knockout round to the database
func (r *KnockoutRepo) SaveKnockoutRound(categoryID int64, knockoutRound model.KnockoutRound) (int64, error) {
	// Check if knockout round with the same round number already exists
	var existingID int64
	err := r.db.QueryRow(
		"SELECT id FROM knockout_rounds WHERE category_id = ? AND round_number = ?",
		categoryID, knockoutRound.Round,
	).Scan(&existingID)

	if err == nil {
		// Knockout round exists, just return its ID
		return existingID, nil
	} else if err != sql.ErrNoRows {
		// Some other error occurred
		return 0, fmt.Errorf("database error when checking for existing knockout round: %w", err)
	}

	// Knockout round doesn't exist, insert new one
	result, err := r.db.Exec(
		"INSERT INTO knockout_rounds (category_id, round_number) VALUES (?, ?)",
		categoryID, knockoutRound.Round,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to insert knockout round: %w", err)
	}

	knockoutRoundID, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get inserted knockout round ID: %w", err)
	}

	return knockoutRoundID, nil
}

// SaveKnockoutRounds saves all knockout rounds for a category
func (r *KnockoutRepo) SaveKnockoutRounds(categoryID int64, knockoutRounds []model.KnockoutRound) error {
	// Start a transaction
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	// Delete existing knockout rounds and matches for this category
	_, err = tx.Exec("DELETE FROM matches WHERE knockout_round_id IN (SELECT id FROM knockout_rounds WHERE category_id = ?)", categoryID)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete existing knockout matches: %w", err)
	}

	_, err = tx.Exec("DELETE FROM knockout_rounds WHERE category_id = ?", categoryID)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete existing knockout rounds: %w", err)
	}

	// Insert new knockout rounds and matches
	matchRepo := NewMatchRepo(r.db)

	for _, round := range knockoutRounds {
		// Insert knockout round
		result, err := tx.Exec(
			"INSERT INTO knockout_rounds (category_id, round_number) VALUES (?, ?)",
			categoryID, round.Round,
		)
		if err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to insert knockout round: %w", err)
		}

		knockoutRoundID, err := result.LastInsertId()
		if err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to get inserted knockout round ID: %w", err)
		}

		// Save matches for this knockout round
		for _, match := range round.Matches {
			knockoutRoundIDSQL := sql.NullInt64{Int64: knockoutRoundID, Valid: true}
			_, err := matchRepo.SaveMatch(categoryID, match, sql.NullInt64{}, knockoutRoundIDSQL)
			if err != nil {
				tx.Rollback()
				return fmt.Errorf("failed to save match: %w", err)
			}
		}
	}

	// Commit transaction
	err = tx.Commit()
	if err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// GetKnockoutRoundsByCategoryID retrieves all knockout rounds for a category
func (r *KnockoutRepo) GetKnockoutRoundsByCategoryID(categoryID int64) ([]model.KnockoutRound, error) {
	// Get all knockout rounds for this category
	rows, err := r.db.Query(
		"SELECT id, round_number FROM knockout_rounds WHERE category_id = ? ORDER BY round_number",
		categoryID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get knockout rounds: %w", err)
	}
	defer rows.Close()

	var knockoutRounds []model.KnockoutRound
	matchRepo := NewMatchRepo(r.db)

	for rows.Next() {
		var knockoutRoundID int64
		var roundNumber int
		err := rows.Scan(&knockoutRoundID, &roundNumber)
		if err != nil {
			return nil, fmt.Errorf("failed to scan knockout round: %w", err)
		}

		// Get matches for this knockout round
		matches, err := matchRepo.GetMatchesByKnockoutRoundID(knockoutRoundID)
		if err != nil {
			return nil, fmt.Errorf("failed to get matches for knockout round: %w", err)
		}

		knockoutRound := model.KnockoutRound{
			Round:   roundNumber,
			Matches: matches,
		}

		knockoutRounds = append(knockoutRounds, knockoutRound)
	}

	return knockoutRounds, nil
}

// GetKnockoutRoundByID retrieves a knockout round by its ID
func (r *KnockoutRepo) GetKnockoutRoundByID(knockoutRoundID int64) (*model.KnockoutRound, error) {
	var roundNumber int
	err := r.db.QueryRow(
		"SELECT round_number FROM knockout_rounds WHERE id = ?",
		knockoutRoundID,
	).Scan(&roundNumber)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // Knockout round not found
		}
		return nil, fmt.Errorf("failed to get knockout round: %w", err)
	}

	// Get matches for this knockout round
	matchRepo := NewMatchRepo(r.db)
	matches, err := matchRepo.GetMatchesByKnockoutRoundID(knockoutRoundID)
	if err != nil {
		return nil, fmt.Errorf("failed to get matches for knockout round: %w", err)
	}

	knockoutRound := model.KnockoutRound{
		Round:   roundNumber,
		Matches: matches,
	}

	return &knockoutRound, nil
}

// DeleteKnockoutRound deletes a knockout round and all related data
func (r *KnockoutRepo) DeleteKnockoutRound(knockoutRoundID int64) error {
	// Start a transaction
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	// Delete matches
	_, err = tx.Exec("DELETE FROM matches WHERE knockout_round_id = ?", knockoutRoundID)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete matches: %w", err)
	}

	// Delete knockout round
	_, err = tx.Exec("DELETE FROM knockout_rounds WHERE id = ?", knockoutRoundID)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete knockout round: %w", err)
	}

	// Commit transaction
	err = tx.Commit()
	if err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}
