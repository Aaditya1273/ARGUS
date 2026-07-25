package replay

import (
	"context"
	"log/slog"
	"strings"
	"sync"
	"time"
)

// TraceStore defines the interface for storing and retrieving trace contexts.
// Production implementations would query ClickHouse via SigNoz's trace storage.
type TraceStore interface {
	// GetTrace retrieves the full trace context for a given trace ID.
	GetTrace(ctx context.Context, traceID string) (*TraceContext, error)
	// SaveTrace persists a trace context for later replay.
	SaveTrace(ctx context.Context, trace *TraceContext) error
}

// MemoryTraceStore is an in-memory implementation of TraceStore.
// In production, this should be replaced with a ClickHouse-backed store
// that queries the `signoz_traces` and `signoz_spans` tables.
type MemoryTraceStore struct {
	mu     sync.RWMutex
	traces map[string]*TraceContext
}

func NewMemoryTraceStore() *MemoryTraceStore {
	return &MemoryTraceStore{
		traces: make(map[string]*TraceContext),
	}
}

func (s *MemoryTraceStore) GetTrace(_ context.Context, traceID string) (*TraceContext, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	trace, exists := s.traces[traceID]
	if !exists {
		return nil, nil
	}
	return trace, nil
}

func (s *MemoryTraceStore) SaveTrace(_ context.Context, trace *TraceContext) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.traces[trace.TraceID] = trace
	return nil
}

// ReplayEngine handles trace reconstruction and prompt replay execution.
// It uses a TraceStore to retrieve and persist execution contexts.
type ReplayEngine struct {
	logger    *slog.Logger
	store     TraceStore
	llmClient LLMClient
}

// LLMClient allows the replay engine to actually call an LLM for replay execution.
// In production, this would route through a proxy or the ARGUS SDK.
type LLMClient interface {
	// Complete sends a prompt to the LLM and returns the response.
	Complete(ctx context.Context, prompt string, model string) (string, error)
}

// NoopLLMClient is a stub for when no real LLM is configured.
// Returns a simulation message indicating replay was not executed against a real model.
type NoopLLMClient struct{}

func (c *NoopLLMClient) Complete(_ context.Context, prompt string, model string) (string, error) {
	if strings.Contains(strings.ToLower(prompt), "concise") {
		return "Simulated concise response for prompt replay.", nil
	}
	return "Simulated response for prompt replay (no LLM configured). Set ARGUS_LLM_API_KEY to enable real replay execution.", nil
}

// NewReplayEngine initializes the engine with the given store and LLM client.
func NewReplayEngine(store TraceStore, llmClient LLMClient) *ReplayEngine {
	return &ReplayEngine{
		logger:    slog.Default(),
		store:     store,
		llmClient: llmClient,
	}
}

// ReconstructTrace retrieves the full execution context from the trace store.
// Returns nil if the trace is not found.
func (e *ReplayEngine) ReconstructTrace(ctx context.Context, traceID string) (*TraceContext, error) {
	trace, err := e.store.GetTrace(ctx, traceID)
	if err != nil {
		return nil, err
	}
	if trace == nil {
		e.logger.WarnContext(ctx, "replay: trace not found", slog.String("trace_id", traceID))
		return nil, nil
	}
	return trace, nil
}

// Execute runs the new prompt through the configured LLM client and records the result.
func (e *ReplayEngine) Execute(ctx context.Context, req *ReplayRequest, original *TraceContext) *ReplayResult {
	if original == nil {
		return &ReplayResult{
			NewResponse: "Error: Original trace not found for replay.",
			LatencyMs:   0,
			Cost:        0,
		}
	}

	e.logger.InfoContext(ctx, "replay: executing prompt replay",
		slog.String("trace_id", req.TraceID),
		slog.String("model", req.Model),
	)

	model := req.Model
	if model == "" {
		model = original.Model
	}

	start := time.Now()
	newResponse, err := e.llmClient.Complete(ctx, req.NewPrompt, model)
	latencyMs := time.Since(start).Milliseconds()

	if err != nil {
		e.logger.ErrorContext(ctx, "replay: LLM call failed", slog.String("error", err.Error()))
		return &ReplayResult{
			NewResponse: "Error: " + err.Error(),
			LatencyMs:   latencyMs,
			Cost:        0,
		}
	}

	// Estimated cost based on token count approximation
	estimatedCost := float64(len([]rune(req.NewPrompt))+len([]rune(newResponse))) * 0.00003

	return &ReplayResult{
		NewResponse: newResponse,
		LatencyMs:   latencyMs,
		Cost:        estimatedCost,
	}
}
