package tournament

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/yinloo-ola/tournament-manager/internal/repo"
	"github.com/yinloo-ola/tournament-manager/model"
)

const timeLayout = "2006-01-02T15:04"

// Service handles tournament-related operations
type Service struct {
	tournamentRepo *repo.TournamentRepo
}

type tournamentInput struct {
	Name       string           `json:"name"`
	NumTables  int              `json:"numTables"`
	StartTime  string           `json:"startTime"`
	Categories []model.Category `json:"categories"`
}

// NewService creates a new tournament service with the given repository
func NewService(repo *repo.TournamentRepo) *Service {
	return &Service{
		tournamentRepo: repo,
	}
}

// SaveTournament handles the API request to save a tournament to the database
func (s *Service) SaveTournament(c *gin.Context) {
	var input tournamentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid tournament data",
			"details": err.Error(),
		})
		return
	}

	// Parse the time string as local time (GMT+8)
	loc, _ := time.LoadLocation("Asia/Singapore")
	startTime, err := time.ParseInLocation(timeLayout, input.StartTime, loc)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid time format",
			"details": "Expected format: YYYY-MM-DDTHH:MM",
		})
		return
	}

	tournament := model.Tournament{
		Name:       input.Name,
		NumTables:  input.NumTables,
		StartTime:  startTime,
		Categories: input.Categories,
	}

	// Validate tournament data
	if tournament.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tournament name is required"})
		return
	}

	// Call the repository to save the tournament
	id, err := s.tournamentRepo.SaveTournament(tournament)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Return success response
	c.JSON(http.StatusOK, gin.H{
		"message": "Tournament saved successfully",
		"id":      id,
	})
}

// GetTournament handles the API request to retrieve a tournament from the database
func (s *Service) GetTournament(c *gin.Context) {
	// Get tournament ID from URL parameter
	idStr := c.Param("id")
	if idStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tournament ID is required"})
		return
	}

	// Convert ID to int64
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
		return
	}

	// Call the repository to get the tournament
	tournament, err := s.tournamentRepo.GetTournament(uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Check if tournament was found
	if tournament == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tournament not found"})
		return
	}

	// Return tournament data
	c.JSON(http.StatusOK, tournament)
}
