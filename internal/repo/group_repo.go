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
		// Delete existing groups (and their matches + group_entries via GORM cascades or explicit delete)
		// First, get IDs of existing groups for this category
		var existingGroupIDs []uint
		if err := tx.Model(&model.Group{}).Where("category_id = ?", categoryID).Pluck("id", &existingGroupIDs).Error; err != nil {
			slog.Error("Failed to fetch existing group IDs for deletion", "categoryID", categoryID, "error", err)
			return fmt.Errorf("failed to fetch existing group IDs: %w", err)
		}

		if len(existingGroupIDs) > 0 {
			// Delete matches associated with these groups
			if err := tx.Where("group_id IN (?)", existingGroupIDs).Delete(&model.Match{}).Error; err != nil {
				slog.Error("Failed to delete existing matches for groups", "groupIDs", existingGroupIDs, "error", err)
				return fmt.Errorf("failed to delete existing matches: %w", err)
			}
			// Delete group_entries (many2many join table records)
			// GORM's `Select(clause.Associations)` on `Delete(&model.Group{})` should handle this if relationships are defined.
			// Or explicitly:
			if err := tx.Exec("DELETE FROM group_entries WHERE group_id IN (?)", existingGroupIDs).Error; err != nil {
				slog.Error("Failed to delete existing group_entries", "groupIDs", existingGroupIDs, "error", err)
				return fmt.Errorf("failed to delete existing group_entries: %w", err)
			}
			// Delete the groups themselves
			if err := tx.Delete(&model.Group{}, "id IN (?)", existingGroupIDs).Error; err != nil {
				slog.Error("Failed to delete existing groups", "groupIDs", existingGroupIDs, "error", err)
				return fmt.Errorf("failed to delete existing groups: %w", err)
			}
		}

		// Insert new groups
		for i, group := range groups {
			group.CategoryID = categoryID
			group.GroupIndex = i // Assuming GroupIndex is 0-based from the input slice

			// The `group.Entries` field should be populated with actual `*model.Entry` pointers
			// that have their IDs set, for GORM to create the many2many relationships.
			// The input `group.EntriesIdx` needs to be converted to `group.Entries []*model.Entry`.
			// This requires fetching Entry models by their original indices or IDs.
			// This part is complex as `group.EntriesIdx` are indices from `category.Entries`.

			// Let's assume the caller has already populated `group.Entries` with the correct Entry instances
			// or we need a mechanism to fetch/link them here.
			// For now, if `group.Entries` (the GORM field) is populated, it will be saved.
			// If only `group.EntriesIdx` (the old field) is available, this save will not link entries.
			// The model.Group was updated to use `Entries []*Entry gorm:"many2many:group_entries;"`
			// and `EntriesIdx []int gorm:"-"`

			// We need to resolve EntriesIdx to actual Entry objects before saving the group.
			resolvedEntries := make([]*model.Entry, 0, len(group.EntriesIdx))
			if len(group.EntriesIdx) > 0 {
				// Fetch all entries for the category once to create a map for quick lookup
				var categoryEntries []model.Entry
				if err := tx.Where("category_id = ?", categoryID).Order("id asc").Find(&categoryEntries).Error; err != nil {
					slog.Error("Failed to fetch entries for category to resolve group entries", "categoryID", categoryID, "error", err)
					return fmt.Errorf("failed to fetch entries for group creation: %w", err)
				}

				for _, entryIdx := range group.EntriesIdx {
					if entryIdx >= 0 && entryIdx < len(categoryEntries) {
						resolvedEntries = append(resolvedEntries, &categoryEntries[entryIdx])
					} else if entryIdx != model.EntryEmptyIdx && entryIdx != model.EntryByeIdx {
						slog.Warn("Invalid entry index in group", "categoryID", categoryID, "groupIndex", i, "entryIdx", entryIdx)
						// Optionally return an error here if strictness is required
					}
				}
			}
			group.Entries = resolvedEntries // Assign the resolved entries

			if err := tx.Create(&group).Error; err != nil {
				slog.Error("Failed to insert group with GORM", "categoryID", categoryID, "groupIndex", i, "error", err)
				return fmt.Errorf("failed to insert group %d: %w", i, err)
			}

			// Matches for the group (Rounds) would be saved separately, typically by iterating
			// through group.Rounds and calling a matchRepo.SaveMatch for each.
			// This is handled in TournamentRepo.SaveTournament after groups are saved.
		}
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
