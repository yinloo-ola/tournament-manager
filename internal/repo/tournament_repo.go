package repo

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	_ "github.com/glebarez/go-sqlite"
	"github.com/yinloo-ola/tournament-manager/model"
)

// TournamentRepo provides database operations for tournament data
type TournamentRepo struct {
	db *sql.DB
}

// Initialize opens a connection to the SQLite database
func (r *TournamentRepo) Initialize() error {
	var err error
	r.db, err = sql.Open("sqlite", "./tournament.db")
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	// Initialize database schema if needed
	if err := r.initSchema(); err != nil {
		return fmt.Errorf("failed to initialize schema: %w", err)
	}

	return nil
}

// initSchema creates the database tables if they don't exist
func (r *TournamentRepo) initSchema() error {
	// Read schema.sql file and execute it
	// For simplicity, we'll just create the tables directly here
	// In a production app, you might want to read from the schema.sql file
	
	// Create tournaments table
	_, err := r.db.Exec(`
		CREATE TABLE IF NOT EXISTS tournaments (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			num_tables INTEGER NOT NULL,
			start_time TEXT NOT NULL,
			data TEXT NOT NULL
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create tournaments table: %w", err)
	}

	return nil
}

// SaveTournament saves a tournament to the database and returns the ID
func (r *TournamentRepo) SaveTournament(tournament model.Tournament) (int64, error) {
	// Initialize database connection if not already initialized
	if r.db == nil {
		if err := r.Initialize(); err != nil {
			slog.Error("Failed to initialize database", "error", err)
			return 0, fmt.Errorf("failed to initialize database: %w", err)
		}
	}

	// Convert tournament to JSON for storage
	tournamentJSON, err := json.Marshal(tournament)
	if err != nil {
		slog.Error("Failed to marshal tournament data", "error", err)
		return 0, fmt.Errorf("failed to process tournament data: %w", err)
	}

	// Check if tournament with the same name already exists
	var existingID int
	err = r.db.QueryRow("SELECT id FROM tournaments WHERE name = ?", tournament.Name).Scan(&existingID)
	
	var result sql.Result
	if err == nil {
		// Tournament exists, update it
		result, err = r.db.Exec(
			"UPDATE tournaments SET num_tables = ?, start_time = ?, data = ? WHERE id = ?",
			tournament.NumTables,
			time.Time(tournament.StartTime).Format(time.RFC3339),
			tournamentJSON,
			existingID,
		)
		if err != nil {
			slog.Error("Failed to update tournament", "error", err)
			return 0, fmt.Errorf("failed to update tournament: %w", err)
		}
	} else if err == sql.ErrNoRows {
		// Tournament doesn't exist, insert new one
		result, err = r.db.Exec(
			"INSERT INTO tournaments (name, num_tables, start_time, data) VALUES (?, ?, ?, ?)",
			tournament.Name,
			tournament.NumTables,
			time.Time(tournament.StartTime).Format(time.RFC3339),
			tournamentJSON,
		)
		if err != nil {
			slog.Error("Failed to insert tournament", "error", err)
			return 0, fmt.Errorf("failed to save tournament: %w", err)
		}
	} else {
		// Some other error occurred
		slog.Error("Database error when checking for existing tournament", "error", err)
		return 0, fmt.Errorf("database error: %w", err)
	}

	// Get the ID of the inserted/updated tournament
	var id int64
	if existingID != 0 {
		id = int64(existingID)
	} else {
		id, err = result.LastInsertId()
		if err != nil {
			slog.Error("Failed to get inserted tournament ID", "error", err)
			return 0, fmt.Errorf("failed to get tournament ID: %w", err)
		}
	}

	return id, nil
}
