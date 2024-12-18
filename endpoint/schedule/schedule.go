package schedule

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/yinloo-ola/tournament-manager/endpoint/schedule/internal"
	"github.com/yinloo-ola/tournament-manager/model"
)

type Service struct{}

func (z *Service) ImportFinalSchedule(c *gin.Context) {
	// TODO: use excelize to read the excel file
	// c.Request.
	// c.JSON(200, tournament)
}

func (z *Service) ExportDraftSchedule(c *gin.Context) {
	var tournament model.Tournament
	err := c.BindJSON(&tournament)
	if err != nil {
		c.AbortWithError(http.StatusBadRequest, fmt.Errorf("invalid tournament: %w", err))
		return
	}
	ioWriter, err := internal.CreateDraftSchedule(tournament)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s_rr_charts.xlsx"`, tournament.Name))
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	err = ioWriter.Write(c.Writer)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
}

func (z *Service) GenerateRounds(c *gin.Context) {
	var tournament model.Tournament
	err := c.BindJSON(&tournament)
	if err != nil {
		c.AbortWithError(http.StatusBadRequest, fmt.Errorf("invalid tournament: %w", err))
		return
	}
	tournament, err = internal.GenerateRoundsForTournament(tournament)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, fmt.Errorf("GenerateRoundsForTournament failed: %w", err))
		return
	}
	c.JSON(200, tournament)
}
