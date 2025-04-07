package repo

import (
	"database/sql"
	"fmt"
	"log/slog"

	"github.com/yinloo-ola/tournament-manager/model"
)

// GroupRepo provides database operations for group data
type GroupRepo struct {
	db *sql.DB
}

// NewGroupRepo creates a new GroupRepo
func NewGroupRepo(db *sql.DB) *GroupRepo {
	return &GroupRepo{
		db: db,
	}
}

// SaveGroups saves all groups for a category
func (r *GroupRepo) SaveGroups(categoryID int64, groups []model.Group) error {
	// Start a transaction
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	// Delete existing groups and group entries for this category
	_, err = tx.Exec("DELETE FROM group_entries WHERE group_id IN (SELECT id FROM groups WHERE category_id = ?)", categoryID)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete existing group entries: %w", err)
	}

	_, err = tx.Exec("DELETE FROM groups WHERE category_id = ?", categoryID)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete existing groups: %w", err)
	}

	// Insert new groups and group entries
	for groupIdx, group := range groups {
		// Insert group
		result, err := tx.Exec(
			"INSERT INTO groups (category_id, group_index) VALUES (?, ?)",
			categoryID, groupIdx,
		)
		if err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to insert group: %w", err)
		}

		groupID, err := result.LastInsertId()
		if err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to get inserted group ID: %w", err)
		}

		// Insert group entries
		// Note: We need to map from entriesIdx (which are indices) to actual entry IDs
		// This requires looking up the entries by their position in the category's entries array
		for _, entryIdx := range group.EntriesIdx {
			// Skip empty or bye entries
			if entryIdx == model.EntryEmptyIdx || entryIdx == model.EntryByeIdx {
				continue
			}

			// Get the entry ID for this index
			var entryID int64
			err := tx.QueryRow(
				`SELECT id FROM entries WHERE category_id = ? ORDER BY id LIMIT 1 OFFSET ?`,
				categoryID, entryIdx,
			).Scan(&entryID)

			if err != nil {
				tx.Rollback()
				slog.Error("Failed to find entry ID for index", "categoryID", categoryID, "entryIdx", entryIdx, "error", err)
				return fmt.Errorf("failed to find entry ID for index %d: %w", entryIdx, err)
			}

			// Insert group entry
			_, err = tx.Exec(
				"INSERT INTO group_entries (group_id, entry_id) VALUES (?, ?)",
				groupID, entryID,
			)
			if err != nil {
				tx.Rollback()
				return fmt.Errorf("failed to insert group entry: %w", err)
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

// GetGroupsByCategoryID retrieves all groups for a category
func (r *GroupRepo) GetGroupsByCategoryID(categoryID int64) ([]model.Group, error) {
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

	// Get all groups for this category
	groupRows, err := r.db.Query(
		"SELECT id, group_index FROM groups WHERE category_id = ? ORDER BY group_index",
		categoryID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get groups: %w", err)
	}
	defer groupRows.Close()

	var groups []model.Group
	groupIDToIdx := make(map[int64]int) // Map group ID to its index in the groups slice

	for groupRows.Next() {
		var groupID int64
		var groupIndex int
		err := groupRows.Scan(&groupID, &groupIndex)
		if err != nil {
			return nil, fmt.Errorf("failed to scan group: %w", err)
		}

		// Create a new group
		group := model.Group{
			EntriesIdx: []int{},
			Rounds:     [][]model.Match{},
		}

		// Add group to groups slice
		groups = append(groups, group)
		groupIDToIdx[groupID] = len(groups) - 1
	}

	// Get all group entries
	for groupID, groupIdx := range groupIDToIdx {
		entryRows, err := r.db.Query(
			"SELECT entry_id FROM group_entries WHERE group_id = ?",
			groupID,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to get group entries: %w", err)
		}

		for entryRows.Next() {
			var entryID int64
			err := entryRows.Scan(&entryID)
			if err != nil {
				entryRows.Close()
				return nil, fmt.Errorf("failed to scan group entry: %w", err)
			}

			// Get the index for this entry ID
			idx, ok := entryIDToIdx[entryID]
			if !ok {
				entryRows.Close()
				return nil, fmt.Errorf("entry ID %d not found in entry map", entryID)
			}

			// Add entry index to group
			groups[groupIdx].EntriesIdx = append(groups[groupIdx].EntriesIdx, idx)
		}
		entryRows.Close()
	}

	// Get matches for each group
	// This is handled by the match repository, so we'll leave the Rounds field empty for now
	// The match repository will populate this when retrieving matches

	return groups, nil
}

// GetGroupByID retrieves a group by its ID
func (r *GroupRepo) GetGroupByID(groupID int64) (*model.Group, error) {
	// Get the category ID for this group
	var categoryID int64
	err := r.db.QueryRow("SELECT category_id FROM groups WHERE id = ?", groupID).Scan(&categoryID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // Group not found
		}
		return nil, fmt.Errorf("failed to get category ID for group: %w", err)
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

	// Create a new group
	group := model.Group{
		EntriesIdx: []int{},
		Rounds:     [][]model.Match{},
	}

	// Get all group entries
	entryRows, err = r.db.Query("SELECT entry_id FROM group_entries WHERE group_id = ?", groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to get group entries: %w", err)
	}
	defer entryRows.Close()

	for entryRows.Next() {
		var entryID int64
		err := entryRows.Scan(&entryID)
		if err != nil {
			return nil, fmt.Errorf("failed to scan group entry: %w", err)
		}

		// Get the index for this entry ID
		idx, ok := entryIDToIdx[entryID]
		if !ok {
			return nil, fmt.Errorf("entry ID %d not found in entry map", entryID)
		}

		// Add entry index to group
		group.EntriesIdx = append(group.EntriesIdx, idx)
	}

	// Get matches for this group
	// This is handled by the match repository, so we'll leave the Rounds field empty for now
	// The match repository will populate this when retrieving matches

	return &group, nil
}

// DeleteGroup deletes a group and all related data
func (r *GroupRepo) DeleteGroup(groupID int64) error {
	// Start a transaction
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	// Delete group entries
	_, err = tx.Exec("DELETE FROM group_entries WHERE group_id = ?", groupID)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete group entries: %w", err)
	}

	// Delete matches
	_, err = tx.Exec("DELETE FROM matches WHERE group_id = ?", groupID)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete matches: %w", err)
	}

	// Delete group
	_, err = tx.Exec("DELETE FROM groups WHERE id = ?", groupID)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete group: %w", err)
	}

	// Commit transaction
	err = tx.Commit()
	if err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}
