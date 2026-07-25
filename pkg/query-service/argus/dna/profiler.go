package dna

import (
	"crypto/sha256"
	"fmt"
	"strings"
	"time"
)

// Profiler extracts behavior into a deterministic fingerprint
type Profiler struct{}

func NewProfiler() *Profiler {
	return &Profiler{}
}

// GenerateFingerprint builds the DNA profile from raw execution events
func (p *Profiler) GenerateFingerprint(traceID string, agentID string, tools []string, models []string, latencyMs int64, tokens int, cost float64) *AgentFingerprint {
	freq := make(map[string]int)
	for _, t := range tools {
		freq[t]++
	}

	// Deterministic sequence string: "model1->tool1->tool2->model2"
	var sequence []string
	sequence = append(sequence, models...)
	sequence = append(sequence, tools...)
	seqStr := strings.Join(sequence, "->")

	hash := fmt.Sprintf("%x", sha256.Sum256([]byte(seqStr)))

	return &AgentFingerprint{
		TraceID:        traceID,
		AgentID:        agentID,
		SequenceHash:   hash[:12], // Short hash
		ToolSequence:   tools,
		ToolFrequency:  freq,
		ModelSequence:  models,
		TotalLatencyMs: latencyMs,
		InputTokens:    tokens,
		OutputTokens:   0,
		ContextSizeKb:  float64(tokens) * 0.002, // Rough estimate
		TotalCost:      cost,
		Timestamp:      time.Now(),
	}
}
