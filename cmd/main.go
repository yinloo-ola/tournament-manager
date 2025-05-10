package main

import (
	"context"
	// "database/sql" // Removed
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	static "github.com/soulteary/gin-static"
	"github.com/yinloo-ola/tournament-manager/endpoint/entry"
	"github.com/yinloo-ola/tournament-manager/endpoint/roundrobin"
	"github.com/yinloo-ola/tournament-manager/endpoint/schedule"
	"github.com/yinloo-ola/tournament-manager/endpoint/tournament"
	"github.com/yinloo-ola/tournament-manager/internal/repo"
	"github.com/yinloo-ola/tournament-manager/web"
	// _ "github.com/glebarez/go-sqlite" // Removed
)

// Repositories holds all repository instances
type Repositories struct {
	tournamentRepo *repo.TournamentRepo
	categoryRepo   *repo.CategoryRepo
	entryRepo      *repo.EntryRepo
	groupRepo      *repo.GroupRepo
	knockoutRepo   *repo.KnockoutRepo
	matchRepo      *repo.MatchRepo
}

// Services holds all service instances
type Services struct {
	entrySvc      *entry.Service
	roundRobinSvc *roundrobin.Service
	scheduleSvc   *schedule.Service
	tournamentSvc *tournament.Service
}

// initRepositories initializes all repositories
func initRepositories() *Repositories {
	tournamentRepo := &repo.TournamentRepo{}
	if err := tournamentRepo.Initialize(); err != nil {
		slog.Error("Failed to initialize tournament repository and database", "error", err)
		os.Exit(1)
	}

	gormDB := tournamentRepo.DB()
	if gormDB == nil {
		slog.Error("Failed to get GORM DB instance from TournamentRepo")
		os.Exit(1)
	}

	return &Repositories{
		tournamentRepo: tournamentRepo,
		categoryRepo:   repo.NewCategoryRepo(gormDB),
		entryRepo:      repo.NewEntryRepo(gormDB),
		groupRepo:      repo.NewGroupRepo(gormDB),
		knockoutRepo:   repo.NewKnockoutRepo(gormDB),
		matchRepo:      repo.NewMatchRepo(gormDB),
	}
}

// initServices initializes all services with their dependencies
func initServices(repos *Repositories) *Services {
	return &Services{
		entrySvc:      &entry.Service{}, // Assuming services are stateless or get DB from repos if needed
		roundRobinSvc: &roundrobin.Service{},
		scheduleSvc:   &schedule.Service{},
		tournamentSvc: tournament.NewService(repos.tournamentRepo),
	}
}

func main() {
	initLogger()

	// Initialize repositories (which now includes DB initialization)
	repos := initRepositories()

	// Initialize services
	services := initServices(repos)

	// Setup router and API endpoints
	router := gin.Default()
	router.NoRoute(static.ServeEmbed("dist", web.WebStatic))
	apiRouters := router.Group("/api")
	{
		// Entry endpoints
		apiRouters.POST("/importSinglesEntry", services.entrySvc.ImportSinglesEntry)
		apiRouters.POST("/importTeamEntry", services.entrySvc.ImportTeamEntry)
		apiRouters.POST("/importDoublesEntry", services.entrySvc.ImportDoublesEntry)

		// Round robin endpoints
		apiRouters.POST("/exportRoundRobinExcel", services.roundRobinSvc.ExportRoundRobinExcel)

		// Schedule endpoints
		apiRouters.POST("/exportDraftSchedule", services.scheduleSvc.ExportDraftSchedule)
		apiRouters.POST("/importFinalSchedule", services.scheduleSvc.ImportFinalSchedule)
		apiRouters.POST("/generateRounds", services.scheduleSvc.GenerateRounds)
		apiRouters.POST("/exportScoresheetWithTemplate", services.scheduleSvc.ExportScoresheetWithTemplate)

		// Tournament endpoints
		apiRouters.POST("/saveTournament", services.tournamentSvc.SaveTournament)
		apiRouters.GET("/getTournament/:id", services.tournamentSvc.GetTournament)
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
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	slog.Info("Shutting down server...")

	// The context is used to inform the server it has 5 seconds to finish
	// the request it is currently handling
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("Server forced to shutdown", "error", err)
	}

	slog.Info("Server exiting")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatal("Server Shutdown:", err)
	}

	log.Println("Server exiting")
}
