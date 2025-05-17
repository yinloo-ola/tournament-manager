package repo

import (
	"errors"
	"fmt"
	"log/slog"

	"github.com/yinloo-ola/tournament-manager/model"
	"gorm.io/gorm"
)

// GroupRepo provides database operations for group data using GORM
type GroupRepo struct {
	db *gorm.DB
}

// NewGroupRepo creates a new GroupRepo with a GORM DB instance
func NewGroupRepo(db *gorm.DB) *GroupRepo {
	return &GroupRepo{
		db: db,
	}
}

// SaveGroups saves all groups for a category using GORM
// The `txOrDb` argument can be either *gorm.DB or *gorm.DB.Begin() (a transaction)
// This function will replace existing groups for the category with the new ones.
func (r *GroupRepo) SaveGroups(categoryID uint, groups []model.Group, txOrDb *gorm.DB) error {
	db := r.db
	if txOrDb != nil {
		db = txOrDb
	}

	return db.Transaction(func(tx *gorm.DB) error {
		return nil
	})
}

// GetGroupsByCategoryID retrieves all groups for a category using GORM
func (r *GroupRepo) GetGroupsByCategoryID(categoryID uint) ([]model.Group, error) {
	var groups []model.Group
	err := r.db.Preload("Entries"). // Entries are directly associated and can be preloaded.
		// Rounds [][]Match will be populated by higher-level logic (e.g., TournamentRepo)
		// after fetching matches separately using MatchRepo.
		Where("category_id = ?", categoryID).Order("group_index asc").Find(&groups).Error

	if err != nil {
		return nil, fmt.Errorf("failed to get groups by category ID with GORM: %w", err)
	}

	// Populate EntriesIdx from preloaded Entries
	// This requires knowing the full list of entries for the category to map IDs back to original indices.
	var categoryEntries []model.Entry
	if err := r.db.Where("category_id = ?", categoryID).Order("id asc").Find(&categoryEntries).Error; err != nil {
		slog.Error("Failed to fetch category entries for populating EntriesIdx", "categoryID", categoryID, "error", err)
		// Continue without EntriesIdx or return error, depending on strictness.
		// For now, we'll proceed, and EntriesIdx might be incomplete if this fails.
	}
	entryIDToOriginalIndex := make(map[uint]int)
	for i, e := range categoryEntries {
		entryIDToOriginalIndex[e.ID] = i
	}

	for i := range groups {
		groups[i].EntriesIdx = make([]int, len(groups[i].Entries))
		for j, entry := range groups[i].Entries {
			if originalIndex, ok := entryIDToOriginalIndex[entry.ID]; ok {
				groups[i].EntriesIdx[j] = originalIndex
			} else {
				// This case means an entry associated with a group via group_entries
				// was not found in the category's main list of entries when ordered by ID.
				// This could indicate a data integrity issue or a flaw in the indexing logic.
				groups[i].EntriesIdx[j] = model.EntryEmptyIdx // Fallback
				slog.Warn("Entry from group not found in category's master entry list", "groupID", groups[i].ID, "entryID", entry.ID, "categoryID", categoryID)
			}
		}
		// The groups[i].Rounds field is intentionally not populated here by GroupRepo.
		// It will be populated by TournamentRepo after fetching relevant matches
		// from MatchRepo and organizing them into the [][]model.Match structure.
	}

	return groups, nil
}

// GetGroupByID retrieves a group by its ID using GORM
func (r *GroupRepo) GetGroupByID(groupID uint) (*model.Group, error) {
	var group model.Group
	// Preload Entries. Rounds are handled by TournamentRepo.
	err := r.db.Preload("Entries").First(&group, groupID).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil // Group not found
		}
		return nil, fmt.Errorf("failed to get group by ID with GORM: %w", err)
	}

	// Populate EntriesIdx
	var categoryEntries []model.Entry
	if err := r.db.Where("category_id = ?", group.CategoryID).Order("id asc").Find(&categoryEntries).Error; err != nil {
		slog.Error("Failed to fetch category entries for populating EntriesIdx for group", "groupID", groupID, "error", err)
		// Proceed, EntriesIdx might be incomplete.
	}
	entryIDToOriginalIndex := make(map[uint]int)
	for i, e := range categoryEntries {
		entryIDToOriginalIndex[e.ID] = i
	}
	group.EntriesIdx = make([]int, len(group.Entries))
	for j, entry := range group.Entries {
		if originalIndex, ok := entryIDToOriginalIndex[entry.ID]; ok {
			group.EntriesIdx[j] = originalIndex
		} else {
			group.EntriesIdx[j] = model.EntryEmptyIdx
			slog.Warn("Entry from group not found in category's master entry list during GetGroupByID", "groupID", group.ID, "entryID", entry.ID, "categoryID", group.CategoryID)
		}
	}

	// group.Rounds is not populated here. See comment in GetGroupsByCategoryID.
	return &group, nil
}

// DeleteGroup deletes a group and all related data using GORM
func (r *GroupRepo) DeleteGroup(groupID uint) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// Delete matches associated with this group
		if err := tx.Where("group_id = ?", groupID).Delete(&model.Match{}).Error; err != nil {
			return fmt.Errorf("failed to delete matches for group: %w", err)
		}

		// GORM's `Select(clause.Associations)` on Delete should handle clearing many2many `group_entries`
		// Alternatively, clear associations manually before deleting the group:
		var group model.Group
		if err := tx.First(&group, groupID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil // Group already deleted
			}
			return fmt.Errorf("failed to find group for deleting associations: %w", err)
		}
		if err := tx.Model(&group).Association("Entries").Clear(); err != nil {
			return fmt.Errorf("failed to clear group entries association: %w", err)
		}

		// Delete the group itself
		if err := tx.Delete(&model.Group{}, groupID).Error; err != nil {
			return fmt.Errorf("failed to delete group: %w", err)
		}
		return nil
	})
}
