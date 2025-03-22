package entry

import (
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
	minPlayers := c.Request.FormValue("minPlayers")
	minPlayers = strings.TrimSpace(minPlayers)
	maxPlayers := c.Request.FormValue("maxPlayers")
	maxPlayers = strings.TrimSpace(maxPlayers)
	minPlayersInt, err := strconv.Atoi(minPlayers)
	if err != nil {
		c.AbortWithError(http.StatusBadRequest, err)
		return
	}
	maxPlayersInt, err := strconv.Atoi(maxPlayers)
	if err != nil {
		c.AbortWithError(http.StatusBadRequest, err)
		return
	}
	entries, err := internal.ImportTeamEntries(c.Request.Context(), c.Request.Body, minPlayersInt, maxPlayersInt)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	c.JSON(200, entries)
}

func (z *Service) ImportDoublesEntry(c *gin.Context) {
	entries, err := internal.ImportDoublesEntries(c.Request.Context(), c.Request.Body)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	c.JSON(200, entries)
}
