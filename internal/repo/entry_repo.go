package repo

import (
	"fmt"
	"log/slog"

	"github.com/yinloo-ola/tournament-manager/model"
	"gorm.io/gorm"
)

// EntryRepo provides database operations for entry data using GORM
type EntryRepo struct {
	db *gorm.DB
}

// NewEntryRepo creates a new EntryRepo with a GORM DB instance
func NewEntryRepo(db *gorm.DB) *EntryRepo {
	return &EntryRepo{
		db: db,
	}
}

// DeleteEntry deletes an entry and its associated players using GORM
func (r *EntryRepo) DeleteEntry(entryID uint) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// Delete from group_entries (many2many join table)
		// Assuming `group_entries` table schema: group_id, entry_id
		// GORM might handle this via Association().Clear() when deleting a Group or Entry
		// if the relationship is defined. For direct deletion:
		if err := tx.Exec("DELETE FROM group_entries WHERE entry_id = ?", entryID).Error; err != nil {
			// This might not be an error if the entry wasn't in any groups, but GORM returns err.
			// Consider checking if err is "record not found" for this specific case if it's noisy.
			slog.Warn("Failed to delete from group_entries, might be okay if entry not in group", "entryID", entryID, "error", err)
			// For now, we continue, as the main goal is to delete the entry and its players.
		}

		// GORM's `Select(clause.Associations)` on Delete will handle associated Players
		// if the foreign key `EntryID` in `Player` model is set up correctly with constraints
		// or if GORM's Hooks (BeforeDelete, AfterDelete) are used.
		// More explicit:
		if err := tx.Where("entry_id = ?", entryID).Delete(&model.Player{}).Error; err != nil {
			return fmt.Errorf("failed to delete players for entry: %w", err)
		}

		// Delete the entry itself
		if err := tx.Delete(&model.Entry{}, entryID).Error; err != nil {
			return fmt.Errorf("failed to delete entry: %w", err)
		}
		return nil
	})
}
