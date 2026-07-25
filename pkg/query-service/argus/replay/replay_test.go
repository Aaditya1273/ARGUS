package replay_test

import (
	"context"
	"testing"

	"github.com/SigNoz/signoz/pkg/query-service/argus/replay"
)

func TestReplayEngine(t *testing.T) {
	store := replay.NewMemoryTraceStore()
	llmClient := &replay.NoopLLMClient{}
	engine := replay.NewReplayEngine(store, llmClient)

	ctx := context.Background()

	// Store a trace first
	store.SaveTrace(ctx, &replay.TraceContext{
		TraceID:        "trace-1",
		OriginalPrompt: "Summarize this text.",
		Model:          "gpt-4",
		Tools:          []string{"web_search", "calculator"},
		Messages: []replay.Message{
			{Role: "user", Content: "Summarize the history of Rome."},
		},
		OriginalResponse: "Rome was founded in 753 BC...",
		LatencyMs:        1250,
		Cost:             0.045,
	})

	// Reconstruct the trace
	traceCtx, err := engine.ReconstructTrace(ctx, "trace-1")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if traceCtx.TraceID != "trace-1" {
		t.Fatalf("Expected trace-1, got %s", traceCtx.TraceID)
	}

	// Execute a replay
	req := &replay.ReplayRequest{
		TraceID:   "trace-1",
		NewPrompt: "Be extremely concise.",
	}

	result := engine.Execute(ctx, req, traceCtx)
	if result.NewResponse == "" {
		t.Fatalf("Expected a response from replay, got empty")
	}
	if result.LatencyMs < 0 {
		t.Fatalf("Expected non-negative latency, got %d", result.LatencyMs)
	}
}

func TestReconstructTraceNotFound(t *testing.T) {
	store := replay.NewMemoryTraceStore()
	llmClient := &replay.NoopLLMClient{}
	engine := replay.NewReplayEngine(store, llmClient)

	traceCtx, err := engine.ReconstructTrace(context.Background(), "nonexistent")
	if err != nil {
		t.Fatalf("Unexpected error for missing trace: %v", err)
	}
	if traceCtx != nil {
		t.Fatalf("Expected nil for missing trace, got %v", traceCtx)
	}
}

func TestDiffer(t *testing.T) {
	differ := replay.NewDiffer()

	origCtx := &replay.TraceContext{OriginalResponse: "Long original text", LatencyMs: 1000}
	req := &replay.ReplayRequest{NewPrompt: "Shorten"}
	newRes := &replay.ReplayResult{NewResponse: "Short", LatencyMs: 500}

	diff := differ.GenerateDiff(origCtx, req, newRes)

	if diff.ResponseDiff != "Content Changed" {
		t.Fatalf("Expected Content Changed, got %s", diff.ResponseDiff)
	}
	if diff.LatencyDeltaMs != -500 {
		t.Fatalf("Expected -500ms, got %d", diff.LatencyDeltaMs)
	}
}
