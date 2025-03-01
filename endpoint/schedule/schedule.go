package schedule

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
	"github.com/yinloo-ola/tournament-manager/endpoint/schedule/internal"
	"github.com/yinloo-ola/tournament-manager/model"
)

type Service struct{}

func (z *Service) ExportScoresheetWithTemplate(c *gin.Context) {
	// Set a reasonable max memory limit for form parsing
	err := c.Request.ParseMultipartForm(32 << 20) // 32MB max memory
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse form data: " + err.Error()})
		return
	}

	// Get the tournament JSON from the form
	tournamentJSON := c.Request.FormValue("tournament")
	if tournamentJSON == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tournament data not provided"})
		return
	}

	// Parse the tournament JSON
	var tournament model.Tournament
	err = json.Unmarshal([]byte(tournamentJSON), &tournament)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse tournament data: " + err.Error()})
		return
	}

	// Get the uploaded file
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to get file: " + err.Error()})
		return
	}

	// Open the uploaded file
	uploadedFile, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to open file: " + err.Error()})
		return
	}
	defer uploadedFile.Close()

	// Parse the Excel file
	excelFile, err := excelize.OpenReader(uploadedFile)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse Excel file: " + err.Error()})
		return
	}
	defer excelFile.Close()

	file, err := internal.ExportScoresheet(c.Request.Context(), tournament, excelFile)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to export scoresheet: " + err.Error()})
		return
	}

	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", "attachment; filename=scoresheet.xlsx")

	err = file.Write(c.Writer)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to write Excel file: " + err.Error()})
		return
	}
}

func (z *Service) ImportFinalSchedule(c *gin.Context) {
	ctx := c.Request.Context()
	categoriesGroupsMap, err := internal.ImportFinalSchedule(ctx, c.Request.Body)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, fmt.Errorf("ImportFinalSchedule failed: %w", err))
		return
	}
	c.JSON(200, categoriesGroupsMap)
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
