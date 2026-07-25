package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/SigNoz/signoz/pkg/query-service/argus/appserver"
)

func main() {
	addr := ":8080"
	if v := os.Getenv("ARGUS_ADDR"); v != "" {
		addr = v
	}

	srv := appserver.NewServer(addr)

	go func() {
		slog.Info("ARGUS server starting", "addr", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}
