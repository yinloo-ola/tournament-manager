package tournament

import (
	"net/http"

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
