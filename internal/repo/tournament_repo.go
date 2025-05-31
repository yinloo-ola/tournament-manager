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
	// knockoutRepo *KnockoutRepo
	// matchRepo    *MatchRepo
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
	// r.knockoutRepo = NewKnockoutRepo(r.db)
	// r.matchRepo = NewMatchRepo(r.db)

	return nil
}

// SetDB sets the database connection and initializes sub-repositories
func (r *TournamentRepo) SetDB(db *gorm.DB) {
	r.db = db

	r.categoryRepo = NewCategoryRepo(db)
	r.entryRepo = NewEntryRepo(db)
	r.groupRepo = NewGroupRepo(db)
	// r.knockoutRepo = NewKnockoutRepo(db)
	// r.matchRepo = NewMatchRepo(db)
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

	result := r.db.Create(&tournament)
	if result.Error != nil {
		slog.Error("Failed to create tournament", "error", result.Error)
		return 0, fmt.Errorf("failed to create tournament: %w", result.Error)
	}
	return tournament.ID, nil
}

// GetTournament retrieves a tournament by its ID using GORM
func (r *TournamentRepo) GetTournament(id uint) (*model.Tournament, error) {
	var tournament model.Tournament

	// Preload all relevant nested data structures for a tournament.
	// This includes categories, entries within categories, player details for entries,
	// team details (including players within teams) for entries,
	// groups within categories (including their entries and matches),
	// and knockout rounds within categories (including their matches).
	// Use a Session with FullSaveAssociations to ensure all associations are loaded
	dbQuery := r.db.Session(&gorm.Session{FullSaveAssociations: true}).Model(&model.Tournament{}).
		Preload("Categories").
		Preload("Categories.Entries").
		Preload("Categories.Entries.Players"). // For Singles, Doubles, and Team entries
		Preload("Categories.Groups").
		Preload("Categories.Groups.Matches"). // Matches within a group
		Preload("Categories.KnockoutRounds").
		Preload("Categories.KnockoutRounds.Matches") // Matches within a knockout round

	if err := dbQuery.First(&tournament, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil // Return nil, nil if tournament not found
		}
		return nil, err // Return actual error for other DB issues
	}

	return &tournament, nil
}
