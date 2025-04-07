package repo

import (
	"database/sql"
	"fmt"
	"log/slog"
	"time"

	_ "github.com/glebarez/go-sqlite"
	"github.com/yinloo-ola/tournament-manager/model"
)

// TournamentRepo provides database operations for tournament data
type TournamentRepo struct {
	db *sql.DB
	categoryRepo  *CategoryRepo
	entryRepo     *EntryRepo
	groupRepo    *GroupRepo
	knockoutRepo *KnockoutRepo
	matchRepo    *MatchRepo
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

	// Initialize sub-repositories
	r.categoryRepo = NewCategoryRepo(r.db)
	r.entryRepo = NewEntryRepo(r.db)
	r.groupRepo = NewGroupRepo(r.db)
	r.knockoutRepo = NewKnockoutRepo(r.db)
	r.matchRepo = NewMatchRepo(r.db)

	return nil
}

// initSchema creates the database tables if they don't exist
func (r *TournamentRepo) initSchema() error {
	// Read schema from schema.sql file
	// For simplicity, we'll just create the tables directly here
	
	// Create tournaments table
	_, err := r.db.Exec(`
		CREATE TABLE IF NOT EXISTS tournaments (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			num_tables INTEGER NOT NULL,
			start_time TEXT NOT NULL
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create tournaments table: %w", err)
	}

	// Create categories table
	_, err = r.db.Exec(`
		CREATE TABLE IF NOT EXISTS categories (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
			name TEXT NOT NULL,
			short_name TEXT NOT NULL,
			entry_type TEXT NOT NULL CHECK(entry_type IN ('Singles', 'Doubles', 'Team')),
			entries_per_grp_main INTEGER NOT NULL,
			entries_per_grp_remainder INTEGER NOT NULL,
			duration_minutes INTEGER NOT NULL,
			num_qualified_per_group INTEGER NOT NULL,
			min_players INTEGER,
			max_players INTEGER
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create categories table: %w", err)
	}

	// Create entries table
	_, err = r.db.Exec(`
		CREATE TABLE IF NOT EXISTS entries (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			category_id INTEGER NOT NULL REFERENCES categories(id),
			entry_type TEXT NOT NULL CHECK(entry_type IN ('Singles', 'Doubles', 'Team')),
			seeding INTEGER,
			club TEXT,
			team_name TEXT
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create entries table: %w", err)
	}

	// Create players table
	_, err = r.db.Exec(`
		CREATE TABLE IF NOT EXISTS players (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			category_id INTEGER NOT NULL REFERENCES categories(id),
			entry_id INTEGER NOT NULL REFERENCES entries(id),
			name TEXT NOT NULL,
			date_of_birth TEXT NOT NULL,
			gender TEXT NOT NULL CHECK(gender IN ('M', 'F')),
			player_order INTEGER NOT NULL
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create players table: %w", err)
	}

	// Create groups table
	_, err = r.db.Exec(`
		CREATE TABLE IF NOT EXISTS groups (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			category_id INTEGER NOT NULL REFERENCES categories(id),
			group_index INTEGER NOT NULL
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create groups table: %w", err)
	}

	// Create group_entries table
	_, err = r.db.Exec(`
		CREATE TABLE IF NOT EXISTS group_entries (
			group_id INTEGER NOT NULL REFERENCES groups(id),
			entry_id INTEGER NOT NULL REFERENCES entries(id),
			PRIMARY KEY (group_id, entry_id)
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create group_entries table: %w", err)
	}

	// Create knockout_rounds table
	_, err = r.db.Exec(`
		CREATE TABLE IF NOT EXISTS knockout_rounds (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			category_id INTEGER NOT NULL REFERENCES categories(id),
			round_number INTEGER NOT NULL
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create knockout_rounds table: %w", err)
	}

	// Create matches table
	_, err = r.db.Exec(`
		CREATE TABLE IF NOT EXISTS matches (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			category_id INTEGER NOT NULL REFERENCES categories(id),
			group_id INTEGER REFERENCES groups(id),
			knockout_round_id INTEGER REFERENCES knockout_rounds(id),
			entry1_id INTEGER REFERENCES entries(id),
			entry2_id INTEGER REFERENCES entries(id),
			datetime TEXT NOT NULL,
			duration_minutes INTEGER NOT NULL,
			table_number TEXT NOT NULL,
			category_short_name TEXT NOT NULL,
			group_idx INTEGER NOT NULL,
			round_idx INTEGER NOT NULL,
			round INTEGER NOT NULL,
			match_idx INTEGER NOT NULL,
			games TEXT,
			matches_in_team_match TEXT,
			winner_entry_id INTEGER REFERENCES entries(id),
			score1 INTEGER,
			score2 INTEGER
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create matches table: %w", err)
	}

	// Create lineup_items table
	_, err = r.db.Exec(`
		CREATE TABLE IF NOT EXISTS lineup_items (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			category_id INTEGER NOT NULL REFERENCES categories(id),
			name TEXT NOT NULL,
			match_type TEXT NOT NULL CHECK(match_type IN ('Singles', 'Doubles')),
			gender_requirement TEXT NOT NULL CHECK(gender_requirement IN ('M', 'F', 'Mixed', 'Any')),
			age_req_type TEXT CHECK(age_req_type IN ('minimum', 'maximum')),
			age_req_value INTEGER
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create lineup_items table: %w", err)
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

	// Start a transaction
	tx, err := r.db.Begin()
	if err != nil {
		slog.Error("Failed to begin transaction", "error", err)
		return 0, fmt.Errorf("failed to begin transaction: %w", err)
	}

	// Check if tournament with the same name already exists
	var existingID int64
	err = tx.QueryRow("SELECT id FROM tournaments WHERE name = ?", tournament.Name).Scan(&existingID)
	
	var result sql.Result
	if err == nil {
		// Tournament exists, update it
		result, err = tx.Exec(
			"UPDATE tournaments SET num_tables = ?, start_time = ? WHERE id = ?",
			tournament.NumTables,
			time.Time(tournament.StartTime).Format(time.RFC3339),
			existingID,
		)
		if err != nil {
			tx.Rollback()
			slog.Error("Failed to update tournament", "error", err)
			return 0, fmt.Errorf("failed to update tournament: %w", err)
		}
	} else if err == sql.ErrNoRows {
		// Tournament doesn't exist, insert new one
		result, err = tx.Exec(
			"INSERT INTO tournaments (name, num_tables, start_time) VALUES (?, ?, ?)",
			tournament.Name,
			tournament.NumTables,
			time.Time(tournament.StartTime).Format(time.RFC3339),
		)
		if err != nil {
			tx.Rollback()
			slog.Error("Failed to insert tournament", "error", err)
			return 0, fmt.Errorf("failed to save tournament: %w", err)
		}
		
		existingID, err = result.LastInsertId()
		if err != nil {
			tx.Rollback()
			slog.Error("Failed to get inserted tournament ID", "error", err)
			return 0, fmt.Errorf("failed to get tournament ID: %w", err)
		}
	} else {
		// Some other error occurred
		tx.Rollback()
		slog.Error("Database error when checking for existing tournament", "error", err)
		return 0, fmt.Errorf("database error: %w", err)
	}

	// Save categories and their related data
	for _, category := range tournament.Categories {
		categoryID, err := r.categoryRepo.SaveCategory(existingID, category)
		if err != nil {
			tx.Rollback()
			slog.Error("Failed to save category", "category", category.Name, "error", err)
			return 0, fmt.Errorf("failed to save category %s: %w", category.Name, err)
		}
		
		// Save entries
		for _, entry := range category.Entries {
			_, err := r.entryRepo.SaveEntry(categoryID, entry)
			if err != nil {
				tx.Rollback()
				slog.Error("Failed to save entry", "entry", entry.Name(), "error", err)
				return 0, fmt.Errorf("failed to save entry %s: %w", entry.Name(), err)
			}
		}
		
		// Save groups
		if len(category.Groups) > 0 {
			err := r.groupRepo.SaveGroups(categoryID, category.Groups)
			if err != nil {
				tx.Rollback()
				slog.Error("Failed to save groups", "category", category.Name, "error", err)
				return 0, fmt.Errorf("failed to save groups for category %s: %w", category.Name, err)
			}
			
			// Save group matches
			for groupIdx, group := range category.Groups {
				// Get group ID
				var groupID int64
				err := tx.QueryRow(
					"SELECT id FROM groups WHERE category_id = ? AND group_index = ?",
					categoryID, groupIdx,
				).Scan(&groupID)
				if err != nil {
					tx.Rollback()
					slog.Error("Failed to get group ID", "category", category.Name, "groupIdx", groupIdx, "error", err)
					return 0, fmt.Errorf("failed to get group ID for category %s, group %d: %w", category.Name, groupIdx, err)
				}
				
				// Save group matches
				if len(group.Rounds) > 0 {
					err := r.matchRepo.SaveGroupMatches(categoryID, groupID, groupIdx, group.Rounds)
					if err != nil {
						tx.Rollback()
						slog.Error("Failed to save group matches", "category", category.Name, "groupIdx", groupIdx, "error", err)
						return 0, fmt.Errorf("failed to save group matches for category %s, group %d: %w", category.Name, groupIdx, err)
					}
				}
			}
		}
		
		// Save knockout rounds
		if len(category.KnockoutRounds) > 0 {
			err := r.knockoutRepo.SaveKnockoutRounds(categoryID, category.KnockoutRounds)
			if err != nil {
				tx.Rollback()
				slog.Error("Failed to save knockout rounds", "category", category.Name, "error", err)
				return 0, fmt.Errorf("failed to save knockout rounds for category %s: %w", category.Name, err)
			}
		}
	}

	// Commit transaction
	err = tx.Commit()
	if err != nil {
		slog.Error("Failed to commit transaction", "error", err)
		return 0, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return existingID, nil
}

// GetTournament retrieves a tournament by its ID
func (r *TournamentRepo) GetTournament(tournamentID int64) (*model.Tournament, error) {
	// Initialize database connection if not already initialized
	if r.db == nil {
		if err := r.Initialize(); err != nil {
			slog.Error("Failed to initialize database", "error", err)
			return nil, fmt.Errorf("failed to initialize database: %w", err)
		}
	}

	// Get tournament basic info
	var tournament model.Tournament
	var startTimeStr string

	err := r.db.QueryRow(
		"SELECT name, num_tables, start_time FROM tournaments WHERE id = ?",
		tournamentID,
	).Scan(&tournament.Name, &tournament.NumTables, &startTimeStr)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // Tournament not found
		}
		return nil, fmt.Errorf("failed to get tournament: %w", err)
	}

	// Parse start time
	startTime, err := time.Parse(time.RFC3339, startTimeStr)
	if err != nil {
		return nil, fmt.Errorf("failed to parse start time: %w", err)
	}
	tournament.StartTime = model.Date(startTime)

	// Get categories
	categories, err := r.categoryRepo.GetCategoriesByTournamentID(tournamentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get categories: %w", err)
	}

	// For each category, get entries, groups, and knockout rounds
	for i, category := range categories {
		// Get entries
		entries, err := r.entryRepo.GetEntriesByCategoryID(int64(i))
		if err != nil {
			return nil, fmt.Errorf("failed to get entries for category %s: %w", category.Name, err)
		}
		categories[i].Entries = entries

		// Get groups
		groups, err := r.groupRepo.GetGroupsByCategoryID(int64(i))
		if err != nil {
			return nil, fmt.Errorf("failed to get groups for category %s: %w", category.Name, err)
		}

		// For each group, get matches
		for j := range groups {
			// Get group ID
			var groupID int64
			err := r.db.QueryRow(
				"SELECT id FROM groups WHERE category_id = ? AND group_index = ?",
				i, j,
			).Scan(&groupID)
			if err != nil {
				return nil, fmt.Errorf("failed to get group ID for category %s, group %d: %w", category.Name, j, err)
			}

			// Get matches
			rounds, err := r.matchRepo.GetMatchesByGroupID(groupID)
			if err != nil {
				return nil, fmt.Errorf("failed to get matches for category %s, group %d: %w", category.Name, j, err)
			}
			groups[j].Rounds = rounds
		}
		categories[i].Groups = groups

		// Get knockout rounds
		knockoutRounds, err := r.knockoutRepo.GetKnockoutRoundsByCategoryID(int64(i))
		if err != nil {
			return nil, fmt.Errorf("failed to get knockout rounds for category %s: %w", category.Name, err)
		}
		categories[i].KnockoutRounds = knockoutRounds
	}

	tournament.Categories = categories
	return &tournament, nil
}
