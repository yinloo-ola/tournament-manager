package main

import (
	"log/slog"
	"os"
)

func initLogger() {
	env := os.Getenv("GIN_MODE")
	lvl := slog.LevelInfo
	if env == "debug" {
		lvl = slog.LevelDebug
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level:     lvl,
		AddSource: true,
	}))
	slog.SetDefault(logger)
}
