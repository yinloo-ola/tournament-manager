package repo

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"

	"github.com/yinloo-ola/tournament-manager/model"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// CategoryRepo provides database operations for category data using GORM
type CategoryRepo struct {
	db *gorm.DB
}

// NewCategoryRepo creates a new CategoryRepo with a GORM DB instance
func NewCategoryRepo(db *gorm.DB) *CategoryRepo {
	return &CategoryRepo{
		db: db,
	}
}

// SaveCategory saves a category to the database using GORM and returns the ID
// The `txOrDb` argument can be either *gorm.DB or *gorm.DB.Begin() (a transaction)
func (r *CategoryRepo) SaveCategory(tournamentID uint, category model.Category, txOrDb *gorm.DB) (uint, error) {
	db := r.db
	if txOrDb != nil {
		db = txOrDb
	}

	// Assign TournamentID to the category
	category.TournamentID = tournamentID

	// Prepare LineupItems for GORM by marshaling AgeRequirement to JSON
	for i := range category.Lineup {
		if category.Lineup[i].AgeRequirement != nil {
			ageReqBytes, err := json.Marshal(category.Lineup[i].AgeRequirement)
			if err != nil {
				return 0, fmt.Errorf("failed to marshal age requirement for lineup item %s: %w", category.Lineup[i].Name, err)
			}
			category.Lineup[i].AgeRequirement = datatypes.JSON(ageReqBytes)
		}
	}

	var existingCategory model.Category
	err := db.Where("tournament_id = ? AND name = ?", tournamentID, category.Name).First(&existingCategory).Error

	if err == nil {
		// Category exists, update it
		category.ID = existingCategory.ID // Ensure ID is set for update

		// GORM's Save will update the category and its associations if configured correctly.
		// For associations like Lineup, we might need to clear old ones and add new ones.
		// This uses FullSaveAssociations which should handle create/update/delete of associations.
		// Ensure LineupItem has a CategoryID field.
		if err := db.Session(&gorm.Session{FullSaveAssociations: true}).Save(&category).Error; err != nil {
			slog.Error("Failed to update category with GORM", "error", err)
			return 0, fmt.Errorf("failed to update category: %w", err)
		}
		return category.ID, nil
	} else if errors.Is(err, gorm.ErrRecordNotFound) {
		// Category doesn't exist, insert new one
		// GORM's Create will insert the category and its associations.
		if err := db.Create(&category).Error; err != nil {
			slog.Error("Failed to insert category with GORM", "error", err)
			return 0, fmt.Errorf("failed to save category: %w", err)
		}
		return category.ID, nil
	} else {
		// Some other error occurred
		slog.Error("Database error when checking/saving category with GORM", "error", err)
		return 0, fmt.Errorf("database error: %w", err)
	}
}

// GetCategoryByID retrieves a category by its ID using GORM
func (r *CategoryRepo) GetCategoryByID(categoryID uint) (*model.Category, error) {
	var category model.Category
	// Preload Lineup and unmarshal AgeRequirement from JSON
	err := r.db.Preload("Lineup").First(&category, categoryID).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil // Category not found
		}
		return nil, fmt.Errorf("failed to get category by ID with GORM: %w", err)
	}

	// Unmarshal AgeRequirement for each lineup item
	for i := range category.Lineup {
		if len(category.Lineup[i].AgeRequirement) > 0 && string(category.Lineup[i].AgeRequirement) != "null" {
			var ageReq model.AgeRequirement
			if err := json.Unmarshal(category.Lineup[i].AgeRequirement, &ageReq); err != nil {
				slog.Warn("Failed to unmarshal age requirement for lineup item", "lineupItemID", category.Lineup[i].ID, "error", err)
				// Decide if this should be a critical error or if the item can be returned partially
			} else {
				// To put it back into a non-JSON field if the model expects *model.AgeRequirement for app logic
				// For now, the model.LineupItem.AgeRequirement is datatypes.JSON.
				// If you have another field like `AgeRequirementStruct *model.AgeRequirement `gorm:"-"`` in LineupItem:
				// category.Lineup[i].AgeRequirementStruct = &ageReq
			}
		}
	}

	return &category, nil
}

// GetCategoriesByTournamentID retrieves all categories for a tournament using GORM
func (r *CategoryRepo) GetCategoriesByTournamentID(tournamentID uint) ([]model.Category, error) {
	var categories []model.Category
	// Preload Lineup and handle AgeRequirement unmarshalling as in GetCategoryByID
	err := r.db.Preload("Lineup").Where("tournament_id = ?", tournamentID).Find(&categories).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get categories by tournament ID with GORM: %w", err)
	}

	for i := range categories {
		for j := range categories[i].Lineup {
			if len(categories[i].Lineup[j].AgeRequirement) > 0 && string(categories[i].Lineup[j].AgeRequirement) != "null" {
				var ageReq model.AgeRequirement
				if err := json.Unmarshal(categories[i].Lineup[j].AgeRequirement, &ageReq); err != nil {
					slog.Warn("Failed to unmarshal age requirement for lineup item", "lineupItemID", categories[i].Lineup[j].ID, "error", err)
				} else {
					// categories[i].Lineup[j].AgeRequirementStruct = &ageReq // If using a transient field
				}
			}
		}
	}

	return categories, nil
}

// DeleteCategory deletes a category and all related data using GORM
// GORM's association features with `Select` can be used for cascading deletes if foreign keys are set up with ON DELETE CASCADE.
// Otherwise, manual deletion of related entities is needed.
func (r *CategoryRepo) DeleteCategory(categoryID uint) error {
	// Using transaction for multiple delete operations
	return r.db.Transaction(func(tx *gorm.DB) error {
		// Delete LineupItems associated with the category
		if err := tx.Where("category_id = ?", categoryID).Delete(&model.LineupItem{}).Error; err != nil {
			return fmt.Errorf("failed to delete lineup items: %w", err)
		}

		// Delete Matches (need to handle both group and knockout matches)
		// This assumes Match has CategoryID. If not, join through Group/KnockoutRound.
		if err := tx.Where("category_id = ?", categoryID).Delete(&model.Match{}).Error; err != nil {
			return fmt.Errorf("failed to delete matches: %w", err)
		}

		// Delete KnockoutRounds
		if err := tx.Where("category_id = ?", categoryID).Delete(&model.KnockoutRound{}).Error; err != nil {
			return fmt.Errorf("failed to delete knockout rounds: %w", err)
		}

		// Delete GroupEntries (join table for Group and Entry)
		// This requires knowing the group IDs first.
		var groupIDs []uint
		if err := tx.Model(&model.Group{}).Where("category_id = ?", categoryID).Pluck("id", &groupIDs).Error; err != nil {
			return fmt.Errorf("failed to get group IDs for deletion: %w", err)
		}
		if len(groupIDs) > 0 {
			// Assuming a join table model `model.GroupEntry` or using GORM's many2many direct SQL
			// If `group_entries` table only has group_id and entry_id, direct SQL might be simpler
			// Or if `model.Group` has `Entries []*model.Entry gorm:"many2many:group_entries;"`
			// GORM's `Select(clause.Associations)` on delete for Group might handle this.
			// For now, a more explicit delete on the join table if it exists:
			// if err := tx.Exec("DELETE FROM group_entries WHERE group_id IN (?)", groupIDs).Error; err != nil {
			// 	return fmt.Errorf("failed to delete group_entries: %w", err)
			// }
			// Simpler: if GORM manages the M2M, deleting groups should handle it or clear associations before.
		}

		// Delete Groups
		// When deleting groups, GORM can also handle associated many2many `group_entries` if `Select(clause.Associations)` is used.
		if err := tx.Select(clause.Associations).Where("category_id = ?", categoryID).Delete(&model.Group{}).Error; err != nil {
			return fmt.Errorf("failed to delete groups: %w", err)
		}

		// Delete Players (associated with Entries, which are associated with Category)
		// This also requires knowing Entry IDs.
		var entryIDs []uint
		if err := tx.Model(&model.Entry{}).Where("category_id = ?", categoryID).Pluck("id", &entryIDs).Error; err != nil {
			return fmt.Errorf("failed to get entry IDs for player deletion: %w", err)
		}
		if len(entryIDs) > 0 {
			if err := tx.Where("entry_id IN (?)", entryIDs).Delete(&model.Player{}).Error; err != nil {
				return fmt.Errorf("failed to delete players: %w", err)
			}
		}

		// Delete Entries
		// Using `Select(clause.Associations)` will also handle deletion of associated Players if the relationship is set up.
		if err := tx.Select(clause.Associations).Where("category_id = ?", categoryID).Delete(&model.Entry{}).Error; err != nil {
			return fmt.Errorf("failed to delete entries: %w", err)
		}

		// Finally, delete the category itself
		// Using `Select(clause.Associations)` ensures that if Category has direct associations not handled above (e.g., Entries, Groups were direct fk), they are handled.
		if err := tx.Select(clause.Associations).Delete(&model.Category{}, categoryID).Error; err != nil {
			return fmt.Errorf("failed to delete category: %w", err)
		}

		return nil
	})
}
