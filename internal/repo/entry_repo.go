package repo

import (
	"database/sql"
	"fmt"

	"github.com/yinloo-ola/tournament-manager/model"
)

// EntryRepo provides database operations for entry data
type EntryRepo struct {
	db *sql.DB
}

// NewEntryRepo creates a new EntryRepo
func NewEntryRepo(db *sql.DB) *EntryRepo {
	return &EntryRepo{
		db: db,
	}
}

// SaveEntry saves an entry to the database and returns the ID
func (r *EntryRepo) SaveEntry(categoryID int64, entry model.Entry) (int64, error) {
	// Start a transaction
	tx, err := r.db.Begin()
	if err != nil {
		return 0, fmt.Errorf("failed to begin transaction: %w", err)
	}

	// Convert seeding and club to SQL nullable types
	var seedingSQL sql.NullInt64
	var clubSQL sql.NullString
	var teamNameSQL sql.NullString

	if entry.Seeding != nil {
		seedingSQL.Int64 = int64(*entry.Seeding)
		seedingSQL.Valid = true
	}

	if entry.Club != nil {
		clubSQL.String = *entry.Club
		clubSQL.Valid = true
	}

	if entry.EntryType == model.Team && entry.TeamEntry != nil {
		teamNameSQL.String = entry.TeamEntry.TeamName
		teamNameSQL.Valid = true
	}

	// Insert or update the entry
	var entryID int64
	var existingEntryID int64

	// Check if we can find an existing entry with the same characteristics
	// For singles: same player name
	// For doubles: same player names
	// For team: same team name
	switch entry.EntryType {
	case model.Singles:
		if entry.SinglesEntry != nil {
			err = tx.QueryRow(
				`SELECT e.id FROM entries e 
				JOIN players p ON e.id = p.entry_id 
				WHERE e.category_id = ? AND e.entry_type = ? AND p.name = ? 
				LIMIT 1`,
				categoryID, entry.EntryType, entry.SinglesEntry.Player.Name).Scan(&existingEntryID)
		}
	case model.Doubles:
		if entry.DoublesEntry != nil {
			// This is a simplification - in a real system you might need a more sophisticated matching
			player1 := entry.DoublesEntry.Players[0].Name
			player2 := entry.DoublesEntry.Players[1].Name
			err = tx.QueryRow(
				`SELECT e.id FROM entries e 
				JOIN players p1 ON e.id = p1.entry_id 
				JOIN players p2 ON e.id = p2.entry_id 
				WHERE e.category_id = ? AND e.entry_type = ? 
				AND ((p1.name = ? AND p2.name = ?) OR (p1.name = ? AND p2.name = ?))
				AND p1.id != p2.id
				LIMIT 1`,
				categoryID, entry.EntryType, player1, player2, player2, player1).Scan(&existingEntryID)
		}
	case model.Team:
		if entry.TeamEntry != nil {
			err = tx.QueryRow(
				`SELECT id FROM entries 
				WHERE category_id = ? AND entry_type = ? AND team_name = ?`,
				categoryID, entry.EntryType, entry.TeamEntry.TeamName).Scan(&existingEntryID)
		}
	}

	if err == nil {
		// Entry exists, update it
		_, err = tx.Exec(
			`UPDATE entries SET 
				seeding = ?, 
				club = ?, 
				team_name = ? 
			WHERE id = ?`,
			seedingSQL,
			clubSQL,
			teamNameSQL,
			existingEntryID,
		)
		if err != nil {
			tx.Rollback()
			return 0, fmt.Errorf("failed to update entry: %w", err)
		}

		// Delete existing players for this entry
		_, err = tx.Exec("DELETE FROM players WHERE entry_id = ?", existingEntryID)
		if err != nil {
			tx.Rollback()
			return 0, fmt.Errorf("failed to delete existing players: %w", err)
		}

		entryID = existingEntryID
	} else if err == sql.ErrNoRows {
		// Entry doesn't exist, insert new one
		result, err := tx.Exec(
			`INSERT INTO entries (
				category_id, 
				entry_type, 
				seeding, 
				club, 
				team_name
			) VALUES (?, ?, ?, ?, ?)`,
			categoryID,
			entry.EntryType,
			seedingSQL,
			clubSQL,
			teamNameSQL,
		)
		if err != nil {
			tx.Rollback()
			return 0, fmt.Errorf("failed to insert entry: %w", err)
		}

		entryID, err = result.LastInsertId()
		if err != nil {
			tx.Rollback()
			return 0, fmt.Errorf("failed to get inserted entry ID: %w", err)
		}
	} else {
		// Some other error occurred
		tx.Rollback()
		return 0, fmt.Errorf("database error when checking for existing entry: %w", err)
	}

	// Insert players based on entry type
	switch entry.EntryType {
	case model.Singles:
		if entry.SinglesEntry != nil {
			player := entry.SinglesEntry.Player
			_, err = tx.Exec(
				`INSERT INTO players (
					category_id, 
					entry_id, 
					name, 
					date_of_birth, 
					gender, 
					player_order
				) VALUES (?, ?, ?, ?, ?, ?)`,
				categoryID,
				entryID,
				player.Name,
				player.DateOfBirth,
				player.Gender,
				0, // First player
			)
			if err != nil {
				tx.Rollback()
				return 0, fmt.Errorf("failed to insert player: %w", err)
			}
		}
	case model.Doubles:
		if entry.DoublesEntry != nil {
			for i, player := range entry.DoublesEntry.Players {
				_, err = tx.Exec(
					`INSERT INTO players (
						category_id, 
						entry_id, 
						name, 
						date_of_birth, 
						gender, 
						player_order
					) VALUES (?, ?, ?, ?, ?, ?)`,
					categoryID,
					entryID,
					player.Name,
					player.DateOfBirth,
					player.Gender,
					i, // Player order
				)
				if err != nil {
					tx.Rollback()
					return 0, fmt.Errorf("failed to insert player: %w", err)
				}
			}
		}
	case model.Team:
		if entry.TeamEntry != nil {
			for i, player := range entry.TeamEntry.Players {
				_, err = tx.Exec(
					`INSERT INTO players (
						category_id, 
						entry_id, 
						name, 
						date_of_birth, 
						gender, 
						player_order
					) VALUES (?, ?, ?, ?, ?, ?)`,
					categoryID,
					entryID,
					player.Name,
					player.DateOfBirth,
					player.Gender,
					i, // Player order
				)
				if err != nil {
					tx.Rollback()
					return 0, fmt.Errorf("failed to insert player: %w", err)
				}
			}
		}
	}

	// Commit transaction
	err = tx.Commit()
	if err != nil {
		return 0, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return entryID, nil
}

// GetEntriesByCategoryID retrieves all entries for a category
func (r *EntryRepo) GetEntriesByCategoryID(categoryID int64) ([]model.Entry, error) {
	// Get all entries for this category
	rows, err := r.db.Query(
		`SELECT 
			id, 
			entry_type, 
			seeding, 
			club, 
			team_name 
		FROM entries 
		WHERE category_id = ?`, 
		categoryID)
	
	if err != nil {
		return nil, fmt.Errorf("failed to get entries: %w", err)
	}
	defer rows.Close()
	
	var entries []model.Entry
	
	for rows.Next() {
		var entry model.Entry
		var entryID int64
		var seedingSQL sql.NullInt64
		var clubSQL, teamNameSQL sql.NullString
		
		err := rows.Scan(
			&entryID,
			&entry.EntryType,
			&seedingSQL,
			&clubSQL,
			&teamNameSQL,
		)
		
		if err != nil {
			return nil, fmt.Errorf("failed to scan entry: %w", err)
		}
		
		if seedingSQL.Valid {
			seeding := int(seedingSQL.Int64)
			entry.Seeding = &seeding
		}
		
		if clubSQL.Valid {
			club := clubSQL.String
			entry.Club = &club
		}
		
		// Get players for this entry
		playerRows, err := r.db.Query(
			`SELECT 
				name, 
				date_of_birth, 
				gender, 
				player_order 
			FROM players 
			WHERE entry_id = ? 
			ORDER BY player_order`, 
			entryID)
		
		if err != nil {
			return nil, fmt.Errorf("failed to get players: %w", err)
		}
		
		var players []model.Player
		
		for playerRows.Next() {
			var player model.Player
			var playerOrder int
			
			err := playerRows.Scan(
				&player.Name,
				&player.DateOfBirth,
				&player.Gender,
				&playerOrder,
			)
			
			if err != nil {
				playerRows.Close()
				return nil, fmt.Errorf("failed to scan player: %w", err)
			}
			
			players = append(players, player)
		}
		playerRows.Close()
		
		// Populate the appropriate entry type
		switch entry.EntryType {
		case model.Singles:
			if len(players) > 0 {
				entry.SinglesEntry = &model.SinglesEntry{
					Player: players[0],
				}
			}
		case model.Doubles:
			if len(players) >= 2 {
				entry.DoublesEntry = &model.DoublesEntry{
					Players: [2]model.Player{players[0], players[1]},
				}
			}
		case model.Team:
			if teamNameSQL.Valid {
				var minPlayers, maxPlayers int
				// Get min/max players from category
				err := r.db.QueryRow(
					"SELECT min_players, max_players FROM categories WHERE id = ?",
					categoryID).Scan(&minPlayers, &maxPlayers)
				
				if err != nil {
					minPlayers = 1 // Default values if not found
					maxPlayers = 99
				}
				
				entry.TeamEntry = &model.TeamEntry{
					TeamName:   teamNameSQL.String,
					Players:    players,
					MinPlayers: minPlayers,
					MaxPlayers: maxPlayers,
				}
			}
		}
		
		entries = append(entries, entry)
	}
	
	return entries, nil
}

// GetEntryByID retrieves an entry by its ID
func (r *EntryRepo) GetEntryByID(entryID int64) (*model.Entry, error) {
	var entry model.Entry
	var categoryID int64
	var seedingSQL sql.NullInt64
	var clubSQL, teamNameSQL sql.NullString
	
	err := r.db.QueryRow(
		`SELECT 
			category_id,
			entry_type, 
			seeding, 
			club, 
			team_name 
		FROM entries 
		WHERE id = ?`, 
		entryID).Scan(
			&categoryID,
			&entry.EntryType,
			&seedingSQL,
			&clubSQL,
			&teamNameSQL,
		)
	
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // Entry not found
		}
		return nil, fmt.Errorf("failed to get entry: %w", err)
	}
	
	if seedingSQL.Valid {
		seeding := int(seedingSQL.Int64)
		entry.Seeding = &seeding
	}
	
	if clubSQL.Valid {
		club := clubSQL.String
		entry.Club = &club
	}
	
	// Get players for this entry
	rows, err := r.db.Query(
		`SELECT 
			name, 
			date_of_birth, 
			gender, 
			player_order 
		FROM players 
		WHERE entry_id = ? 
		ORDER BY player_order`, 
		entryID)
	
	if err != nil {
		return nil, fmt.Errorf("failed to get players: %w", err)
	}
	defer rows.Close()
	
	var players []model.Player
	
	for rows.Next() {
		var player model.Player
		var playerOrder int
		
		err := rows.Scan(
			&player.Name,
			&player.DateOfBirth,
			&player.Gender,
			&playerOrder,
		)
		
		if err != nil {
			return nil, fmt.Errorf("failed to scan player: %w", err)
		}
		
		players = append(players, player)
	}
	
	// Populate the appropriate entry type
	switch entry.EntryType {
	case model.Singles:
		if len(players) > 0 {
			entry.SinglesEntry = &model.SinglesEntry{
				Player: players[0],
			}
		}
	case model.Doubles:
		if len(players) >= 2 {
			entry.DoublesEntry = &model.DoublesEntry{
				Players: [2]model.Player{players[0], players[1]},
			}
		}
	case model.Team:
		if teamNameSQL.Valid {
			var minPlayers, maxPlayers int
			// Get min/max players from category
			err := r.db.QueryRow(
				"SELECT min_players, max_players FROM categories WHERE id = ?",
				categoryID).Scan(&minPlayers, &maxPlayers)
			
			if err != nil {
				minPlayers = 1 // Default values if not found
				maxPlayers = 99
			}
			
			entry.TeamEntry = &model.TeamEntry{
				TeamName:   teamNameSQL.String,
				Players:    players,
				MinPlayers: minPlayers,
				MaxPlayers: maxPlayers,
			}
		}
	}
	
	return &entry, nil
}

// DeleteEntry deletes an entry and all related data
func (r *EntryRepo) DeleteEntry(entryID int64) error {
	// Start a transaction
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	
	// Delete from group_entries
	_, err = tx.Exec("DELETE FROM group_entries WHERE entry_id = ?", entryID)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete from group_entries: %w", err)
	}
	
	// Delete players
	_, err = tx.Exec("DELETE FROM players WHERE entry_id = ?", entryID)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete players: %w", err)
	}
	
	// Delete entry
	_, err = tx.Exec("DELETE FROM entries WHERE id = ?", entryID)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete entry: %w", err)
	}
	
	// Commit transaction
	err = tx.Commit()
	if err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}
	
	return nil
}
