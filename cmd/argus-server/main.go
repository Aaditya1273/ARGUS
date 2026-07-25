package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/SigNoz/signoz/pkg/alertmanager"
	"github.com/SigNoz/signoz/pkg/query-service/argus/appserver"
	"github.com/SigNoz/signoz/pkg/query-service/interfaces"
	"github.com/SigNoz/signoz/pkg/telemetrystore"
)

func main() {
	// Load .env.local if it exists
	if envBytes, err := os.ReadFile(".env.local"); err == nil {
		lines := strings.Split(string(envBytes), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				key := strings.TrimSpace(parts[0])
				val := strings.TrimSpace(parts[1])
				val = strings.Trim(val, `"`)
				val = strings.Trim(val, `'`)
				os.Setenv(key, val)
			}
		}
	}

	addr := ":8080"
	if v := os.Getenv("ARGUS_ADDR"); v != "" {
		addr = v
	}

	orgID := os.Getenv("ARGUS_ORG_ID")
	if orgID == "" {
		orgID = "default"
		slog.Warn("ARGUS_ORG_ID not set, using 'default'")
	}

	// Read SigNoz Cloud ingestion credentials from environment.
	// These are the standard OTel env vars set in .env.local:
	//   OTEL_EXPORTER_OTLP_ENDPOINT = https://ingest.in2.signoz.cloud
	//   OTEL_EXPORTER_OTLP_HEADERS  = signoz-ingestion-key=<key>
	signozEndpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	signozIngestionKey := ""
	if headers := os.Getenv("OTEL_EXPORTER_OTLP_HEADERS"); headers != "" {
		// Parse "signoz-ingestion-key=xxxx" format using strings.Cut (Go 1.18+)
		_, v, ok := strings.Cut(headers, "=")
		if ok {
			signozIngestionKey = strings.TrimSpace(v)
		}
	}

	if signozEndpoint != "" && signozIngestionKey != "" {
		slog.Info("ARGUS: SigNoz Cloud credentials loaded",
			slog.String("endpoint", signozEndpoint),
			slog.Int("key_length", len(signozIngestionKey)),
		)
	} else {
		slog.Warn("ARGUS: no SigNoz Cloud credentials found. Set OTEL_EXPORTER_OTLP_ENDPOINT and OTEL_EXPORTER_OTLP_HEADERS")
	}

	// Initialize SigNoz dependencies from environment or pass nil.
	// In production, these are wired by the SigNoz query service container.
	// For standalone ARGUS mode, we pass nil and use in-memory fallback.
	var ts telemetrystore.TelemetryStore
	var reader interfaces.Reader
	var am alertmanager.Alertmanager

	if dsn := os.Getenv("ARGUS_CLICKHOUSE_DSN"); dsn != "" {
		slog.Info("ARGUS connecting to ClickHouse", "dsn", dsn)
		// NOTE: In production, the TelemetryStore is created by the SigNoz
		// query service bootstrap. For standalone mode, implement a DSN-based
		// initializer that creates a clickhousetelemetrystore from the DSN.
		// For now, we pass nil and use in-memory fallback.
		_ = ts
		_ = reader
		_ = am
	}

	// When wired into the full SigNoz query service, pass the real
	// telemetryStore, reader (interfaces.Reader), alertmanager, and orgID.
	// This enables all SigNoz integrations (dashboards, investigation, alerts).
	srv := appserver.NewServer(addr, ts, reader, am, orgID, signozEndpoint, signozIngestionKey)

	go func() {
		slog.Info("ARGUS server starting", "addr", addr, "org_id", orgID)
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
