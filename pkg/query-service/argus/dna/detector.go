package dna

import (
	"fmt"
)

// AnomalyDetector compares fingerprints against healthy baselines
type AnomalyDetector struct {
	baselines map[string]*HealthyBaseline
}

func NewAnomalyDetector() *AnomalyDetector {
	return &AnomalyDetector{
		baselines: make(map[string]*HealthyBaseline),
	}
}

// SeedBaseline is used for MVP to establish a standard profile
func (d *AnomalyDetector) SeedBaseline(b *HealthyBaseline) {
	d.baselines[b.AgentID] = b
}

// Evaluate checks a fingerprint for deviations
func (d *AnomalyDetector) Evaluate(fp *AgentFingerprint) *AnomalyReport {
	report := &AnomalyReport{
		TraceID: fp.TraceID,
		IsAnomalous: false,
	}

	baseline, exists := d.baselines[fp.AgentID]
	if !exists {
		// No baseline to compare against
		return report
	}

	// 1. Structural Checks (Unexpected Tools)
	for tool := range fp.ToolFrequency {
		if !baseline.ExpectedTools[tool] {
			report.StructuralAnomalies = append(report.StructuralAnomalies, fmt.Sprintf("Unexpected Tool Execution: '%s'", tool))
			report.IsAnomalous = true
		}
	}

	// 2. Numerical Checks (Z-Score)
	// Z = (X - Mean) / StdDev
	if baseline.LatencyStdDev > 0 {
		zLatency := (float64(fp.TotalLatencyMs) - baseline.MeanLatencyMs) / baseline.LatencyStdDev
		if zLatency > 3.0 { // 3 standard deviations
			report.NumericalAnomalies = append(report.NumericalAnomalies, fmt.Sprintf("Latency Anomaly (Z=%.2f)", zLatency))
			report.IsAnomalous = true
		}
	}

	if baseline.CostStdDev > 0 {
		zCost := (fp.TotalCost - baseline.MeanCost) / baseline.CostStdDev
		if zCost > 3.0 {
			report.NumericalAnomalies = append(report.NumericalAnomalies, fmt.Sprintf("Cost Spike (Z=%.2f)", zCost))
			report.IsAnomalous = true
		}
	}

	// 3. Hallucination Indicator (High token output + unusual tools)
	if baseline.TokensStdDev > 0 {
		zTokens := (float64(fp.InputTokens) - baseline.MeanTokens) / baseline.TokensStdDev
		if zTokens > 3.5 && len(report.StructuralAnomalies) > 0 {
			report.NumericalAnomalies = append(report.NumericalAnomalies, "Potential Hallucination / Agent Lost")
			report.IsAnomalous = true
		}
	}

	return report
}
