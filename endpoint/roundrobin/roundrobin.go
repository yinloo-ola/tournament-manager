package roundrobin

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/yinloo-ola/tournament-manager/endpoint/roundrobin/internal"
	"github.com/yinloo-ola/tournament-manager/model"
)

type Service struct{}

func (z *Service) ExportRoundRobinExcel(c *gin.Context) {
	var tournament model.Tournament
	err := c.BindJSON(&tournament)
	if err != nil {
		c.AbortWithError(http.StatusBadRequest, fmt.Errorf("invalid tournament: %w", err))
		return
	}
	ioWriter, err := internal.CreateRobinCharts(tournament)
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
