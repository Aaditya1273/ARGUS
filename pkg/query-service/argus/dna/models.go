package dna

import "time"

// AgentFingerprint represents the structural and numerical behavior of an execution
type AgentFingerprint struct {
	TraceID        string         `json:"trace_id"`
	AgentID        string         `json:"agent_id"`
	SequenceHash   string         `json:"sequence_hash"`
	ToolSequence   []string       `json:"tool_sequence"`
	ToolFrequency  map[string]int `json:"tool_frequency"`
	ModelSequence  []string       `json:"model_sequence"`
	TotalLatencyMs int64          `json:"total_latency_ms"`
	InputTokens    int            `json:"input_tokens"`
	OutputTokens   int            `json:"output_tokens"`
	ContextSizeKb  float64        `json:"context_size_kb"`
	TotalCost      float64        `json:"total_cost"`
	Timestamp      time.Time      `json:"timestamp"`
}

// HealthyBaseline represents the statistical steady-state of an agent
type HealthyBaseline struct {
	AgentID           string          `json:"agent_id"`
	MeanLatencyMs     float64         `json:"mean_latency_ms"`
	LatencyStdDev     float64         `json:"latency_std_dev"`
	MeanCost          float64         `json:"mean_cost"`
	CostStdDev        float64         `json:"cost_std_dev"`
	MeanTokens        float64         `json:"mean_tokens"`
	TokensStdDev      float64         `json:"tokens_std_dev"`
	ExpectedTools     map[string]bool `json:"expected_tools"`
	FrequentSequences map[string]bool `json:"frequent_sequences"`
}

// AnomalyReport highlights deviations from the baseline
type AnomalyReport struct {
	TraceID             string   `json:"trace_id"`
	IsAnomalous         bool     `json:"is_anomalous"`
	StructuralAnomalies []string `json:"structural_anomalies"`
	NumericalAnomalies  []string `json:"numerical_anomalies"`
}
