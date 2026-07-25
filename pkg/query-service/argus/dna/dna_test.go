package dna_test

import (
	"testing"
	"github.com/SigNoz/signoz/pkg/query-service/argus/dna"
)

func TestProfiler(t *testing.T) {
	profiler := dna.NewProfiler()
	
	// Two identical executions should yield the same sequence hash
	fp1 := profiler.GenerateFingerprint("t-1", "agent-x", []string{"search", "calc"}, []string{"gpt-4"}, 1000, 500, 0.02)
	fp2 := profiler.GenerateFingerprint("t-2", "agent-x", []string{"search", "calc"}, []string{"gpt-4"}, 1100, 505, 0.02)
	
	if fp1.SequenceHash != fp2.SequenceHash {
		t.Fatalf("Expected hashes to match for identical sequences")
	}

	fp3 := profiler.GenerateFingerprint("t-3", "agent-x", []string{"calc", "search"}, []string{"gpt-4"}, 1000, 500, 0.02)
	if fp1.SequenceHash == fp3.SequenceHash {
		t.Fatalf("Expected hashes to differ for different tool ordering")
	}
}

func TestDetector(t *testing.T) {
	detector := dna.NewAnomalyDetector()
	detector.SeedBaseline(&dna.HealthyBaseline{
		AgentID:       "agent-x",
		MeanLatencyMs: 1000.0,
		LatencyStdDev: 100.0,
		ExpectedTools: map[string]bool{"search": true},
	})

	profiler := dna.NewProfiler()
	fp := profiler.GenerateFingerprint("t-1", "agent-x", []string{"unapproved"}, []string{"gpt-4"}, 1500, 500, 0.02) // Latency Z=5, Tool Unexpected

	report := detector.Evaluate(fp)
	if !report.IsAnomalous {
		t.Fatalf("Expected execution to be flagged as anomalous")
	}
	if len(report.StructuralAnomalies) == 0 {
		t.Fatalf("Expected structural anomaly for unexpected tool")
	}
	if len(report.NumericalAnomalies) == 0 {
		t.Fatalf("Expected numerical anomaly for high latency")
	}
}
