package replay

// TraceContext represents the reconstructed context of a specific LLM execution
type TraceContext struct {
	TraceID          string    `json:"trace_id"`
	OriginalPrompt   string    `json:"original_prompt"`
	Model            string    `json:"model"`
	Tools            []string  `json:"tools"`
	MemoryState      string    `json:"memory_state"`
	Messages         []Message `json:"messages"`
	OriginalResponse string    `json:"original_response"`
	LatencyMs        int64     `json:"latency_ms"`
	Cost             float64   `json:"cost"`
}

// Message represents a single turn in the chat history
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ReplayRequest represents the user's modifications before executing the replay
type ReplayRequest struct {
	TraceID   string `json:"trace_id"`
	NewPrompt string `json:"new_prompt"`
	Model     string `json:"model"`
}

// ReplayResult encapsulates the new execution metrics
type ReplayResult struct {
	NewResponse string  `json:"new_response"`
	LatencyMs   int64   `json:"latency_ms"`
	Cost        float64 `json:"cost"`
}

// DiffResult compares the original execution against the replay
type DiffResult struct {
	TraceID          string  `json:"trace_id"`
	OriginalPrompt   string  `json:"original_prompt"`
	NewPrompt        string  `json:"new_prompt"`
	ResponseDiff     string  `json:"response_diff"`
	LatencyDeltaMs   int64   `json:"latency_delta_ms"`
	CostDelta        float64 `json:"cost_delta"`
	OriginalResponse string  `json:"original_response"`
	NewResponse      string  `json:"new_response"`
}
