package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	static "github.com/soulteary/gin-static"
	"github.com/yinloo-ola/tournament-manager/endpoint/roundrobin"
	"github.com/yinloo-ola/tournament-manager/endpoint/schedule"
	"github.com/yinloo-ola/tournament-manager/web"
)

func main() {
	initLogger()

	router := gin.Default()
	router.NoRoute(static.ServeEmbed("dist", web.WebStatic))
	apiRouters := router.Group("/api")
	{
		roundRobinSvc := &roundrobin.Service{}
		apiRouters.POST("/exportRoundRobinExcel", roundRobinSvc.ExportRoundRobinExcel)
		scheduleSvc := &schedule.Service{}
		apiRouters.POST("/exportDraftSchedule", scheduleSvc.ExportDraftSchedule)
		apiRouters.POST("/importFinalSchedule", scheduleSvc.ImportFinalSchedule)
		apiRouters.POST("/generateRounds", scheduleSvc.GenerateRounds)
		apiRouters.POST("/exportScoresheetWithTemplate", scheduleSvc.ExportScoresheetWithTemplate)
	}

	srv := &http.Server{
		Addr:    ":8082",
		Handler: router,
		ErrorLog: slog.NewLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
			AddSource: true,
		}), slog.LevelError),
	}

	go func() {
		// service connections
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Panicf("listen: %s\n", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server with
	// a timeout of 5 seconds.
	quit := make(chan os.Signal, 1)
	// kill (no param) default send syscanll.SIGTERM
	// kill -2 is syscall.SIGINT
	// kill -9 is syscall. SIGKILL but can"t be catch, so don't need add it
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutdown Server ...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server Shutdown:", err)
	}

	log.Println("Server exiting")
}
