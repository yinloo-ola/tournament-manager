package repo

import (
	"fmt"
	"log/slog"

	"github.com/yinloo-ola/tournament-manager/model"
	"gorm.io/gorm"
)

// KnockoutRepo provides database operations for knockout round data using GORM
type KnockoutRepo struct {
	db *gorm.DB
}

// NewKnockoutRepo creates a new KnockoutRepo with a GORM DB instance
func NewKnockoutRepo(db *gorm.DB) *KnockoutRepo {
	return &KnockoutRepo{
		db: db,
	}
}

// SaveKnockoutRound saves a knockout round to the database using GORM.
// It finds an existing round or creates a new one based on CategoryID and RoundNumber.
func (r *KnockoutRepo) SaveKnockoutRound(categoryID uint, inputRoundModel model.KnockoutRound) (uint, error) {
	krDB := model.KnockoutRound{
		CategoryID: categoryID,
		Round:      inputRoundModel.Round, // This 'Round' field is gorm:"column:round_number"
	}
	err := r.db.Where(model.KnockoutRound{CategoryID: categoryID, Round: inputRoundModel.Round}).
		FirstOrCreate(&krDB).Error

	if err != nil {
		slog.Error("Failed to find or create knockout round with GORM",
			"categoryID", categoryID,
			"round", inputRoundModel.Round,
			"error", err)
		return 0, fmt.Errorf("failed to save knockout round (category %d, round %d): %w", categoryID, inputRoundModel.Round, err)
	}
	return krDB.ID, nil
}

// SaveKnockoutRounds saves all knockout rounds for a category using GORM
func (r *KnockoutRepo) SaveKnockoutRounds(categoryID uint, knockoutRounds []model.KnockoutRound, txGorm *gorm.DB) error {
	var dbHandle *gorm.DB
	if txGorm != nil {
		dbHandle = txGorm
	} else {
		// Start a new transaction if one isn't provided
		tx := r.db.Begin()
		if tx.Error != nil {
			slog.Error("Failed to begin GORM transaction", "error", tx.Error)
			return fmt.Errorf("failed to begin transaction: %w", tx.Error)
		}
		defer func() {
			if r := recover(); r != nil {
				tx.Rollback()
				panic(r) // Re-panic after rollback
			} else if tx.Error != nil { // Check for error before commit
				slog.Error("Rolling back transaction due to error during SaveKnockoutRounds", "error", tx.Error)
				tx.Rollback()
			} else {
				if errCommit := tx.Commit().Error; errCommit != nil {
					slog.Error("Failed to commit GORM transaction", "error", errCommit)
					// The error from commit should be propagated, but the function signature needs to change or handle it
				}
			}
		}()
		dbHandle = tx // Use the new transaction
	}

	// Delete existing matches associated with knockout rounds of this category
	// Need to get IDs of knockout rounds for this category first
	var existingRoundIDs []uint
	if err := dbHandle.Model(&model.KnockoutRound{}).Where("category_id = ?", categoryID).Pluck("id", &existingRoundIDs).Error; err != nil {
		slog.Error("Failed to get existing knockout round IDs for deletion", "categoryID", categoryID, "error", err)
		if txGorm == nil { // If we started the transaction, dbHandle is *gorm.DB from r.db.Begin()
			dbHandle.Rollback()
		}
		return fmt.Errorf("failed to get existing knockout round IDs: %w", err)
	}

	if len(existingRoundIDs) > 0 {
		if err := dbHandle.Where("knockout_round_id IN ?", existingRoundIDs).Delete(&model.Match{}).Error; err != nil {
			slog.Error("Failed to delete existing knockout matches", "categoryID", categoryID, "error", err)
			if txGorm == nil {
				dbHandle.Rollback()
			}
			return fmt.Errorf("failed to delete existing knockout matches: %w", err)
		}
	}

	// Delete existing knockout rounds for this category
	if err := dbHandle.Where("category_id = ?", categoryID).Delete(&model.KnockoutRound{}).Error; err != nil {
		slog.Error("Failed to delete existing knockout rounds", "categoryID", categoryID, "error", err)
		if txGorm == nil {
			dbHandle.Rollback()
		}
		return fmt.Errorf("failed to delete existing knockout rounds: %w", err)
	}

	matchRepo := NewMatchRepo(dbHandle) // Use the transactional dbHandle

	for _, roundData := range knockoutRounds {
		// Create KnockoutRound entity
		krDB := model.KnockoutRound{
			CategoryID: categoryID,
			Round:      roundData.Round,
		}
		if err := dbHandle.Create(&krDB).Error; err != nil {
			slog.Error("Failed to insert knockout round", "categoryID", categoryID, "round", roundData.Round, "error", err)
			if txGorm == nil {
				dbHandle.Rollback()
			}
			return fmt.Errorf("failed to insert knockout round (cat %d, round %d): %w", categoryID, roundData.Round, err)
		}
		persistedKnockoutRoundID := krDB.ID // GORM populates ID after Create

		// Save matches for this knockout round
		for _, match := range roundData.Matches {
			// Pass the GORM transaction (dbHandle) to SaveMatch
			_, err := matchRepo.SaveMatch(categoryID, match, nil, &persistedKnockoutRoundID, dbHandle)
			if err != nil {
				slog.Error("Failed to save match for knockout round", "knockoutRoundID", persistedKnockoutRoundID, "matchIdx", match.MatchIdx, "error", err)
				if txGorm == nil {
					dbHandle.Rollback()
				}
				return fmt.Errorf("failed to save match (krID %d, matchIdx %d): %w", persistedKnockoutRoundID, match.MatchIdx, err)
			}
		}
	}

	return nil // Error handling for commit is done in defer if tx was started locally
}

// GetKnockoutRoundsByCategoryID retrieves all knockout rounds for a category
func (r *KnockoutRepo) GetKnockoutRoundsByCategoryID(categoryID uint) ([]model.KnockoutRound, error) {
	var knockoutRounds []model.KnockoutRound
	// GORM: Find all knockout rounds for this category, ordered by round number
	// Assuming model.KnockoutRound has 'Round' field mapped to 'round_number'
	err := r.db.Where("category_id = ?", categoryID).Order("round_number asc").Find(&knockoutRounds).Error
	if err != nil {
		slog.Error("Failed to get knockout rounds by category ID with GORM", "categoryID", categoryID, "error", err)
		return nil, fmt.Errorf("failed to get knockout rounds for category %d: %w", categoryID, err)
	}

	matchRepo := NewMatchRepo(r.db) // This should be fine as GetMatches... are read operations

	for i := range knockoutRounds {
		// The ID of the knockoutRound is already in knockoutRounds[i].ID
		matches, err := matchRepo.GetMatchesByKnockoutRoundID(knockoutRounds[i].ID)
		if err != nil {
			slog.Error("Failed to get matches for knockout round during GetKnockoutRoundsByCategoryID",
				"knockoutRoundID", knockoutRounds[i].ID, "error", err)
			return nil, fmt.Errorf("failed to get matches for knockout round %d: %w", knockoutRounds[i].ID, err)
		}
		knockoutRounds[i].Matches = matches
	}

	return knockoutRounds, nil
}

// GetKnockoutRoundByID retrieves a knockout round by its ID
func (r *KnockoutRepo) GetKnockoutRoundByID(knockoutRoundID uint) (*model.KnockoutRound, error) {
	var knockoutRound model.KnockoutRound
	// GORM: Find knockout round by ID
	// The 'Round' field in model.KnockoutRound is assumed to be 'round_number'
	err := r.db.First(&knockoutRound, knockoutRoundID).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			slog.Warn("Knockout round not found by ID with GORM", "knockoutRoundID", knockoutRoundID)
			return nil, nil // Not found
		}
		slog.Error("Failed to get knockout round by ID with GORM", "knockoutRoundID", knockoutRoundID, "error", err)
		return nil, fmt.Errorf("failed to get knockout round %d: %w", knockoutRoundID, err)
	}

	matchRepo := NewMatchRepo(r.db)
	matches, err := matchRepo.GetMatchesByKnockoutRoundID(knockoutRound.ID)
	if err != nil {
		slog.Error("Failed to get matches for knockout round during GetKnockoutRoundByID",
			"knockoutRoundID", knockoutRound.ID, "error", err)
		return nil, fmt.Errorf("failed to get matches for knockout round %d: %w", knockoutRound.ID, err)
	}
	knockoutRound.Matches = matches

	return &knockoutRound, nil
}

// DeleteKnockoutRound deletes a knockout round and all related data using GORM
func (r *KnockoutRepo) DeleteKnockoutRound(knockoutRoundID uint) error {

	return r.db.Transaction(func(tx *gorm.DB) error {
		// Delete associated matches first
		if err := tx.Where("knockout_round_id = ?", knockoutRoundID).Delete(&model.Match{}).Error; err != nil {
			slog.Error("Failed to delete matches for knockout round", "knockoutRoundID", knockoutRoundID, "error", err)
			return fmt.Errorf("failed to delete matches for knockout round %d: %w", knockoutRoundID, err)
		}

		// Delete the knockout round itself
		if err := tx.Delete(&model.KnockoutRound{}, knockoutRoundID).Error; err != nil {
			slog.Error("Failed to delete knockout round", "knockoutRoundID", knockoutRoundID, "error", err)
			return fmt.Errorf("failed to delete knockout round %d: %w", knockoutRoundID, err)
		}
		return nil
	})
}
