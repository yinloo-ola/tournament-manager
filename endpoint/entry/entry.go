package entry

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/yinloo-ola/tournament-manager/endpoint/entry/internal"
)

type Service struct{}

func (z *Service) ImportSinglesEntry(c *gin.Context) {
	entries, err := internal.ImportSinglesEntries(c.Request.Context(), c.Request.Body)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	c.JSON(200, entries)
}

func (z *Service) ImportTeamEntry(c *gin.Context) {
	// Define a reasonable max memory limit for the multipart form (e.g., 32 MiB)
	if err := c.Request.ParseMultipartForm(32 << 20); err != nil {
		c.AbortWithError(http.StatusBadRequest, fmt.Errorf("failed to parse multipart form: %w", err))
		return
	}

	minPlayers := c.Request.FormValue("minPlayers")
	minPlayers = strings.TrimSpace(minPlayers)
	maxPlayers := c.Request.FormValue("maxPlayers")
	maxPlayers = strings.TrimSpace(maxPlayers)
	minPlayersInt, err := strconv.Atoi(minPlayers)
	if err != nil {
		c.AbortWithError(http.StatusBadRequest, fmt.Errorf("invalid minPlayers: %w", err))
		return
	}
	maxPlayersInt, err := strconv.Atoi(maxPlayers)
	if err != nil {
		c.AbortWithError(http.StatusBadRequest, fmt.Errorf("invalid maxPlayers: %w", err))
		return
	}

	// Retrieve the file from the form data
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.AbortWithError(http.StatusBadRequest, fmt.Errorf("failed to get file from form: %w", err))
		return
	}

	// Open the file
	fileReader, err := fileHeader.Open()
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, fmt.Errorf("failed to open uploaded file: %w", err))
		return
	}
	defer fileReader.Close() // Ensure the file reader is closed

	// Pass the file reader instead of the request body
	entries, err := internal.ImportTeamEntries(c.Request.Context(), fileReader, minPlayersInt, maxPlayersInt)
	if err != nil {
		// Wrap the internal error for better context
		c.AbortWithError(http.StatusInternalServerError, fmt.Errorf("failed to import team entries: %w", err))
		return
	}
	c.JSON(200, entries)
}

func (z *Service) ImportDoublesEntry(c *gin.Context) {
	// Retrieve the file from the form data
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.AbortWithError(http.StatusBadRequest, fmt.Errorf("failed to get file from form: %w", err))
		return
	}

	// Open the file
	fileReader, err := fileHeader.Open()
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, fmt.Errorf("failed to open uploaded file: %w", err))
		return
	}
	defer fileReader.Close() // Ensure the file reader is closed

	// Pass the file reader instead of the request body
	entries, err := internal.ImportDoublesEntries(c.Request.Context(), fileReader)
	if err != nil {
		// Wrap the internal error for better context
		c.AbortWithError(http.StatusInternalServerError, fmt.Errorf("failed to import doubles entries: %w", err))
		return
	}
	c.JSON(200, entries)
}
