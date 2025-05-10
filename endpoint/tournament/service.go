package tournament

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/yinloo-ola/tournament-manager/internal/repo"
	"github.com/yinloo-ola/tournament-manager/model"
)

// Service handles tournament-related operations
type Service struct {
	tournamentRepo *repo.TournamentRepo
}

// NewService creates a new tournament service with the given repository
func NewService(repo *repo.TournamentRepo) *Service {
	return &Service{
		tournamentRepo: repo,
	}
}

// SaveTournament handles the API request to save a tournament to the database
func (s *Service) SaveTournament(c *gin.Context) {
	// Parse tournament data from request
	var tournament model.Tournament
	if err := c.ShouldBindJSON(&tournament); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament data"})
		return
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
