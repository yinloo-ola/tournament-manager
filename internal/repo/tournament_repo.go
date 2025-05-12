package repo

import (
	"errors"
	"fmt"
	"log/slog"

	"github.com/glebarez/sqlite"
	"github.com/yinloo-ola/tournament-manager/model"
	"gorm.io/gorm"
)

// TournamentRepo provides database operations for tournament data
type TournamentRepo struct {
	db           *gorm.DB
	categoryRepo *CategoryRepo
	entryRepo    *EntryRepo
	groupRepo    *GroupRepo
	knockoutRepo *KnockoutRepo
	matchRepo    *MatchRepo
}

// Initialize opens a connection to the SQLite database and auto-migrates the schema
func (r *TournamentRepo) Initialize() error {
	var err error
	r.db, err = gorm.Open(sqlite.Open("./tournament.db"), &gorm.Config{})
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	// Auto-migrate all tables
	err = r.db.AutoMigrate(
		&model.Tournament{},
		&model.Category{},
		&model.LineupItem{},
		&model.Entry{},
		&model.Player{},
		&model.Group{},
		&model.KnockoutRound{},
		&model.Match{},
	)
	if err != nil {
		return fmt.Errorf("failed to auto-migrate database schema: %w", err)
	}

	// Initialize sub-repositories
	r.categoryRepo = NewCategoryRepo(r.db)
	r.entryRepo = NewEntryRepo(r.db)
	r.groupRepo = NewGroupRepo(r.db)
	r.knockoutRepo = NewKnockoutRepo(r.db)
	r.matchRepo = NewMatchRepo(r.db)

	return nil
}

// SetDB sets the database connection and initializes sub-repositories
func (r *TournamentRepo) SetDB(db *gorm.DB) {
	r.db = db

	r.categoryRepo = NewCategoryRepo(db)
	r.entryRepo = NewEntryRepo(db)
	r.groupRepo = NewGroupRepo(db)
	r.knockoutRepo = NewKnockoutRepo(db)
	r.matchRepo = NewMatchRepo(db)
}

// DB returns the underlying gorm.DB instance.
func (r *TournamentRepo) DB() *gorm.DB {
	return r.db
}

// SaveTournament saves a tournament to the database and returns the ID
func (r *TournamentRepo) SaveTournament(tournament model.Tournament) (uint, error) {
	if r.db == nil {
		if err := r.Initialize(); err != nil {
			slog.Error("Failed to initialize database during SaveTournament", "error", err)
			return 0, fmt.Errorf("failed to initialize database: %w", err)
		}
	}

	var savedTournamentID uint

	err := r.db.Transaction(func(tx *gorm.DB) error {
		// 1. Save/Update Tournament object itself
		dbTournament := model.Tournament{
			Name:      tournament.Name,
			NumTables: tournament.NumTables,
			StartTime: tournament.StartTime, // Directly use the time.Time value
		}

		var existingTournament model.Tournament
		err := tx.Where("name = ?", tournament.Name).First(&existingTournament).Error

		if err == nil { // Found, update
			dbTournament.ID = existingTournament.ID
			if err := tx.Model(&existingTournament).Updates(dbTournament).Error; err != nil {
				slog.Error("Failed to update tournament", "name", dbTournament.Name, "error", err)
				return fmt.Errorf("failed to update tournament: %w", err)
			}
			savedTournamentID = existingTournament.ID
		} else if errors.Is(err, gorm.ErrRecordNotFound) { // Not found, create
			if err := tx.Create(&dbTournament).Error; err != nil {
				slog.Error("Failed to create tournament", "name", dbTournament.Name, "error", err)
				return fmt.Errorf("failed to create tournament: %w", err)
			}
			savedTournamentID = dbTournament.ID
		} else { // Other DB error
			slog.Error("Database error when finding/creating tournament", "name", tournament.Name, "error", err)
			return fmt.Errorf("failed to find or create tournament: %w", err)
		}

		// At this point, savedTournamentID is set.
		// TODO: Consider logic for deleting categories that exist in DB but not in input `tournament.Categories` for an update.
		// This would involve fetching existing category IDs for the tournament, comparing with input, and deleting orphans.

		// 2. Save Categories and their nested entities
		for _, categoryModel := range tournament.Categories {
			categoryModel.TournamentID = savedTournamentID // Ensure TournamentID is set
			savedCategoryID, err := r.categoryRepo.SaveCategory(savedTournamentID, categoryModel, tx)
			if err != nil {
				slog.Error("Failed to save category", "categoryName", categoryModel.Name, "tournamentID", savedTournamentID, "error", err)
				return fmt.Errorf("failed to save category %s: %w", categoryModel.Name, err)
			}

			// Save Entries for this category
			for _, entryModel := range categoryModel.Entries {
				entryModel.CategoryID = savedCategoryID // Ensure CategoryID is set
				_, err := r.entryRepo.SaveEntry(savedCategoryID, entryModel, tx)
				if err != nil {
					slog.Error("Failed to save entry", "entryName", entryModel.Name(), "categoryID", savedCategoryID, "error", err)
					return fmt.Errorf("failed to save entry %s for category %s: %w", entryModel.Name(), categoryModel.Name, err)
				}
			}

			// Save Groups for this category
			if len(categoryModel.Groups) > 0 {
				err := r.groupRepo.SaveGroups(savedCategoryID, categoryModel.Groups, tx)
				if err != nil {
					slog.Error("Failed to save groups", "categoryID", savedCategoryID, "error", err)
					return fmt.Errorf("failed to save groups for category %s: %w", categoryModel.Name, err)
				}

				// Save Group Matches
				for groupIdx, groupModel := range categoryModel.Groups {
					var dbGroup model.Group
					// Find the newly created/updated group by its index to get its ID
					// groupRepo.SaveGroups clears and recreates, so GroupIndex should be reliable.
					if err := tx.Where("category_id = ? AND group_index = ?", savedCategoryID, groupIdx).First(&dbGroup).Error; err != nil {
						slog.Error("Failed to find saved group for match saving", "groupIdx", groupIdx, "categoryID", savedCategoryID, "error", err)
						return fmt.Errorf("failed to find saved group %d for category %s: %w", groupIdx, categoryModel.Name, err)
					}

					for _, roundMatches := range groupModel.Rounds {
						for _, matchModel := range roundMatches {
							matchModel.CategoryID = savedCategoryID // Ensure CategoryID
							matchModel.GroupID = &dbGroup.ID        // Set GroupID for the match
							_, err := r.matchRepo.SaveMatch(savedCategoryID, matchModel, &dbGroup.ID, nil, tx)
							if err != nil {
								slog.Error("Failed to save group match", "categoryID", savedCategoryID, "groupID", dbGroup.ID, "matchDetails", fmt.Sprintf("%+v", matchModel), "error", err)
								return fmt.Errorf("failed to save group match for category %s, group %d: %w", categoryModel.Name, groupIdx, err)
							}
						}
					}
				}
			}

			// Save Knockout Rounds and their matches
			if len(categoryModel.KnockoutRounds) > 0 {
				err := r.knockoutRepo.SaveKnockoutRounds(savedCategoryID, categoryModel.KnockoutRounds, tx)
				if err != nil {
					slog.Error("Failed to save knockout rounds", "categoryID", savedCategoryID, "error", err)
					return fmt.Errorf("failed to save knockout rounds for category %s: %w", categoryModel.Name, err)
				}
			}
		}
		return nil
	})

	if err != nil {
		return 0, err
	}
	return savedTournamentID, nil
}

// GetTournament retrieves a tournament by its ID using GORM
func (r *TournamentRepo) GetTournament(tournamentID uint) (*model.Tournament, error) {
	if r.db == nil {
		if err := r.Initialize(); err != nil {
			slog.Error("Failed to initialize database during GetTournament", "error", err)
			return nil, fmt.Errorf("failed to initialize database: %w", err)
		}
	}

	var tournament model.Tournament
	if err := r.db.First(&tournament, tournamentID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil // Tournament not found
		}
		slog.Error("Failed to get tournament by ID", "tournamentID", tournamentID, "error", err)
		return nil, fmt.Errorf("failed to get tournament %d: %w", tournamentID, err)
	}

	// Get Categories
	categories, err := r.categoryRepo.GetCategoriesByTournamentID(tournamentID)
	if err != nil {
		slog.Error("Failed to get categories for tournament", "tournamentID", tournamentID, "error", err)
		return nil, fmt.Errorf("failed to get categories for tournament %d: %w", tournamentID, err)
	}

	for i := range categories {
		cat := &categories[i] // Use pointer to modify original slice element

		// Get Entries for this category
		entries, err := r.entryRepo.GetEntriesByCategoryID(cat.ID)
		if err != nil {
			slog.Error("Failed to get entries for category", "categoryID", cat.ID, "error", err)
			return nil, fmt.Errorf("failed to get entries for category %s (ID: %d): %w", cat.Name, cat.ID, err)
		}
		cat.Entries = entries

		// Get Groups for this category
		groups, err := r.groupRepo.GetGroupsByCategoryID(cat.ID)
		if err != nil {
			slog.Error("Failed to get groups for category", "categoryID", cat.ID, "error", err)
			return nil, fmt.Errorf("failed to get groups for category %s (ID: %d): %w", cat.Name, cat.ID, err)
		}

		for j := range groups {
			grp := &groups[j]
			// Get Matches for this group
			// The matchRepo.GetMatchesByGroupID is expected to return [][]model.Match
			// If it returns []model.Match, then it needs to be adapted or the call changed.
			// Assuming GetMatchesByGroupID in match_repo GORM version is updated to return the correct structure.
			// Let's assume matchRepo.GetMatchesByGroupID returns []model.Match and we organize it.
			// Or, if GetMatchesByGroupID is already returning [][]model.Match as per the old sql version's expectation for group.Rounds

			// The GORM match_repo.GetMatchesByGroupID returns [][]model.Match
			groupMatches, err := r.matchRepo.GetMatchesByGroupID(grp.ID)
			if err != nil {
				slog.Error("Failed to get matches for group", "groupID", grp.ID, "categoryID", cat.ID, "error", err)
				return nil, fmt.Errorf("failed to get matches for group (ID: %d), category %s: %w", grp.ID, cat.Name, err)
			}
			grp.Rounds = groupMatches
		}
		cat.Groups = groups

		// Get Knockout Rounds for this category
		knockoutRounds, err := r.knockoutRepo.GetKnockoutRoundsByCategoryID(cat.ID)
		if err != nil {
			slog.Error("Failed to get knockout rounds for category", "categoryID", cat.ID, "error", err)
			return nil, fmt.Errorf("failed to get knockout rounds for category %s (ID: %d): %w", cat.Name, cat.ID, err)
		}
		cat.KnockoutRounds = knockoutRounds
	}
	tournament.Categories = categories

	// Convert time.Time back to model.Date for consistency if needed by application logic
	// For now, assume the caller handles model.Tournament with StartTime as time.Time
	// If model.Date is strictly required by other parts of the app:
	// tournamentToReturn := tournament
	// tournamentToReturn.StartTime = model.Date(tournament.StartTime.(time.Time)) // Assuming StartTime is time.Time from DB

	return &tournament, nil
}
