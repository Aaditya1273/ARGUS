package replay

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// TraceStore defines the interface for storing and retrieving trace contexts.
type TraceStore interface {
	GetTrace(ctx context.Context, traceID string) (*TraceContext, error)
	SaveTrace(ctx context.Context, trace *TraceContext) error
}

// MemoryTraceStore is an in-memory implementation of TraceStore.
type MemoryTraceStore struct {
	mu     sync.RWMutex
	traces map[string]*TraceContext
}

func NewMemoryTraceStore() *MemoryTraceStore {
	return &MemoryTraceStore{traces: make(map[string]*TraceContext)}
}

func (s *MemoryTraceStore) GetTrace(_ context.Context, traceID string) (*TraceContext, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	trace, ok := s.traces[traceID]
	if !ok {
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

// LLMClient sends a prompt to an LLM and returns the response.
type LLMClient interface {
	Complete(ctx context.Context, prompt string, model string) (string, error)
}

// OpenAILLMClient is a real OpenAI client using ARGUS_LLM_API_KEY.
type OpenAILLMClient struct {
	apiKey  string
	baseURL string
}

// NewLLMClient returns a real OpenAI client if ARGUS_LLM_API_KEY is set,
// otherwise falls back to NoopLLMClient.
func NewLLMClient() LLMClient {
	key := os.Getenv("ARGUS_LLM_API_KEY")
	if key == "" {
		// also accept the standard OpenAI env var
		key = os.Getenv("OPENAI_API_KEY")
	}
	if key != "" {
		slog.Default().Info("argus replay: real LLM client configured (OpenAI)")
		return &OpenAILLMClient{
			apiKey:  key,
			baseURL: "https://api.openai.com/v1",
		}
	}
	slog.Default().Warn("argus replay: no ARGUS_LLM_API_KEY or OPENAI_API_KEY set, using noop client")
	return &NoopLLMClient{}
}

func (c *OpenAILLMClient) Complete(ctx context.Context, prompt string, model string) (string, error) {
	if model == "" {
		model = "gpt-4o-mini"
	}

	payload := map[string]any{
		"model": model,
		"messages": []map[string]string{
			{"role": "user", "content": prompt},
		},
		"max_tokens": 1024,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("building request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("openai request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("openai error %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("parsing response: %w", err)
	}
	if len(result.Choices) == 0 {
		return "", fmt.Errorf("no choices in response")
	}
	return result.Choices[0].Message.Content, nil
}

// NoopLLMClient is the fallback when no API key is configured.
type NoopLLMClient struct{}

func (c *NoopLLMClient) Complete(_ context.Context, prompt string, _ string) (string, error) {
	if strings.Contains(strings.ToLower(prompt), "concise") {
		return "No LLM configured — set ARGUS_LLM_API_KEY or OPENAI_API_KEY to enable real replay.", nil
	}
	return "No LLM configured — set ARGUS_LLM_API_KEY or OPENAI_API_KEY to enable real replay.", nil
}

// ReplayEngine handles trace reconstruction and prompt replay execution.
type ReplayEngine struct {
	logger    *slog.Logger
	store     TraceStore
	llmClient LLMClient
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
		return &ReplayResult{NewResponse: "Error: Original trace not found for replay."}
	}

	model := req.Model
	if model == "" {
		model = original.Model
	}
	if model == "" {
		model = "gpt-4o-mini"
	}

	prompt := req.NewPrompt
	if prompt == "" {
		prompt = original.OriginalPrompt
	}

	e.logger.InfoContext(ctx, "replay: executing prompt replay",
		slog.String("trace_id", req.TraceID),
		slog.String("model", model),
	)

	start := time.Now()
	newResponse, err := e.llmClient.Complete(ctx, prompt, model)
	latencyMs := time.Since(start).Milliseconds()

	if err != nil {
		e.logger.ErrorContext(ctx, "replay: LLM call failed", slog.String("error", err.Error()))
		return &ReplayResult{NewResponse: "Error: " + err.Error(), LatencyMs: latencyMs}
	}

	// cost estimate: ~$0.00003 per token (GPT-4o-mini pricing)
	estimatedCost := float64(len([]rune(prompt))+len([]rune(newResponse))) * 0.00003

	return &ReplayResult{
		NewResponse: newResponse,
		LatencyMs:   latencyMs,
		Cost:        estimatedCost,
	}
}
