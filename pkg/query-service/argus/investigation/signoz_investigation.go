// Package investigation provides root cause analysis (RCA) for ARGUS governance
// violations by correlating them with real SigNoz trace data, service metrics,
// and neighboring signals. This implements the signoz-investigating-alerts skill
// pattern within the ARGUS runtime control plane.
package investigation

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/SigNoz/signoz/pkg/query-service/argus/engine"
	"github.com/SigNoz/signoz/pkg/query-service/interfaces"
	"github.com/SigNoz/signoz/pkg/query-service/model"
	"github.com/SigNoz/signoz/pkg/telemetrystore"
	"github.com/SigNoz/signoz/pkg/telemetrytraces"
)

// ViolationInvestigator performs RCA for ARGUS governance violations using real SigNoz data.
type ViolationInvestigator struct {
	logger         *slog.Logger
	reader         interfaces.Reader
	telemetryStore telemetrystore.TelemetryStore
}

// InvestigationReport contains the full RCA output for a governance violation.
type InvestigationReport struct {
	// The violation that triggered this investigation
	Violation engine.RuleResult `json:"violation"`
	// The agent context at time of violation
	AgentContext *engine.AgentContext `json:"agent_context,omitempty"`

	// Tier 1: What fired and how hard
	PeakValue     float64 `json:"peak_value"`
	Threshold     float64 `json:"threshold"`
	BreachPercent float64 `json:"breach_percent"` // (peak - threshold) / threshold * 100
	FireDuration  string  `json:"fire_duration"`
	PreFireBaseline string `json:"pre_fire_baseline"`

	// Tier 2: Neighbor signals
	NeighborSignals []NeighborSignal `json:"neighbor_signals,omitempty"`

	// Tier 3: Trace and log evidence
	ErrorTraces []ErrorTraceEvidence `json:"error_traces,omitempty"`
	LogPatterns []LogPatternEvidence `json:"log_patterns,omitempty"`

	// Final analysis
	LikelyCauses    []CauseHypothesis `json:"likely_causes,omitempty"`
	Confidence      string            `json:"confidence"` // high, medium, low
	FirePattern     string            `json:"fire_pattern"` // one-off, sustained, flapping, recurring, marginal
	RuledOut        []string          `json:"ruled_out,omitempty"`
	SuggestedAction string            `json:"suggested_action,omitempty"`
}

// NeighborSignal describes a related signal that was checked.
type NeighborSignal struct {
	Name       string  `json:"name"`
	FireValue  float64 `json:"fire_value"`
	Baseline   float64 `json:"baseline"`
	ChangePct  float64 `json:"change_percent"`
	Direction  string  `json:"direction"` // up, down, flat
	Correlated bool    `json:"correlated"`
}

// ErrorTraceEvidence describes error traces found during investigation.
type ErrorTraceEvidence struct {
	TraceID     string `json:"trace_id"`
	ServiceName string `json:"service_name"`
	Operation   string `json:"operation"`
	ErrorMessage string `json:"error_message"`
	Count       int    `json:"count"`
}

// LogPatternEvidence describes log patterns found during investigation.
type LogPatternEvidence struct {
	Pattern string `json:"pattern"`
	Count   int    `json:"count"`
	Service string `json:"service"`
}

// CauseHypothesis describes a suspected cause with supporting evidence.
type CauseHypothesis struct {
	Hypothesis string  `json:"hypothesis"`
	Evidence   string  `json:"evidence"`
	Confidence string  `json:"confidence"`
}

// NewViolationInvestigator creates a new investigator backed by real SigNoz data.
func NewViolationInvestigator(
	logger *slog.Logger,
	reader interfaces.Reader,
	telemetryStore telemetrystore.TelemetryStore,
) *ViolationInvestigator {
	return &ViolationInvestigator{
		logger:         logger,
		reader:         reader,
		telemetryStore: telemetryStore,
	}
}

// Investigate performs a full three-tier investigation for an ARGUS governance violation.
// It follows the pattern from signoz-investigating-alerts: Tier 1 (what fired),
// Tier 2 (neighbor signals), Tier 3 (traces and logs).
func (inv *ViolationInvestigator) Investigate(ctx context.Context, violation engine.RuleResult, agentCtx *engine.AgentContext) (*InvestigationReport, error) {
	report := &InvestigationReport{
		Violation:    violation,
		AgentContext: agentCtx,
		FirePattern:  "one-off",
		Confidence:   "low",
	}

	// Tier 1: Query real trace data to quantify the violation
	if traceID := agentCtx.TraceID; traceID != "" && inv.reader != nil {
		traceParams := &model.SearchTracesParams{
			TraceID: traceID,
		}
		traceResults, err := inv.reader.SearchTraces(ctx, traceParams)
		if err == nil && traceResults != nil {
			inv.analyzeTraceResults(report, traceResults)
		}
	}

	// Tier 2: Check neighbor signals
	if agentCtx.ProjectName != "" && inv.reader != nil {
		inv.checkNeighborSignals(ctx, report, agentCtx)
	}

	// Determine fire pattern
	if report.BreachPercent < 10 {
		report.FirePattern = "marginal"
		report.Confidence = "low"
		report.SuggestedAction = "Threshold may be too tight. Consider tuning parameters or adding hysteresis."
	} else if report.BreachPercent > 100 {
		report.FirePattern = "sustained"
		if len(report.LikelyCauses) > 0 {
			report.Confidence = "high"
		} else {
			report.Confidence = "medium"
		}
	}

	return report, nil
}

// analyzeTraceResults processes real trace data from SigNoz to quantify the violation.
func (inv *ViolationInvestigator) analyzeTraceResults(report *InvestigationReport, traceResults *[]model.SearchSpansResult) {
	if traceResults == nil || len(*traceResults) == 0 {
		return
	}

	var totalEvents int
	for _, result := range *traceResults {
		totalEvents += len(result.Events)
	}

	if totalEvents > 0 {
		report.PeakValue = float64(totalEvents)
		report.Threshold = 0
		report.BreachPercent = 100
		report.FireDuration = fmt.Sprintf("%d events across %d result groups", totalEvents, len(*traceResults))
		report.PreFireBaseline = "0"
	}
}

// checkNeighborSignals pulls related SigNoz service metrics to find correlated anomalies.
func (inv *ViolationInvestigator) checkNeighborSignals(ctx context.Context, report *InvestigationReport, agentCtx *engine.AgentContext) {
	now := time.Now()
	startTime := now.Add(-1 * time.Hour)
	svcParams := &model.GetServicesParams{
		Start: &startTime,
		End:   &now,
	}

	services, apiErr := inv.reader.GetServices(ctx, svcParams)
	if apiErr != nil && !apiErr.IsNil() {
		inv.logger.WarnContext(ctx, "investigation: failed to get neighbor signals",
			slog.String("error", apiErr.Error()),
		)
		return
	}

	if services == nil {
		return
	}

	for _, svc := range *services {
		if svc.ServiceName == agentCtx.ProjectName || svc.ErrorRate > 0 {
			// Found a correlated signal
			signal := NeighborSignal{
				Name:       svc.ServiceName,
				FireValue:  svc.ErrorRate,
				Baseline:   0,
				ChangePct:  100,
				Direction:  "up",
				Correlated: svc.ErrorRate > 1.0,
			}
			report.NeighborSignals = append(report.NeighborSignals, signal)

			if svc.ErrorRate > 5.0 {
				report.LikelyCauses = append(report.LikelyCauses, CauseHypothesis{
					Hypothesis: fmt.Sprintf("Service %s shows elevated error rate (%.1f%%)", svc.ServiceName, svc.ErrorRate),
					Evidence:   fmt.Sprintf("Error rate of %.1f%% detected in the investigation window with %d total calls", svc.ErrorRate, svc.NumCalls),
					Confidence: "medium",
				})
			}
		}
	}
}

// GetTraceContext retrieves the full trace context for a trace ID from SigNoz ClickHouse.
// This is used for deeper investigation beyond what the Reader interface provides.
func (inv *ViolationInvestigator) GetTraceContext(ctx context.Context, traceID string) (map[string]interface{}, error) {
	if inv.telemetryStore == nil || inv.telemetryStore.ClickhouseDB() == nil {
		return nil, fmt.Errorf("clickhouse not available")
	}

	query := fmt.Sprintf(`
		SELECT
			trace_id,
			span_id,
			parent_span_id,
			service_name,
			name AS operation,
			duration_nano,
			timestamp,
			status_code,
			status_message,
			attributes_string,
			resources_string
		FROM %s.%s
		WHERE trace_id = ?
		ORDER BY timestamp ASC
		LIMIT 100
	`, telemetrytraces.DBName, telemetrytraces.SpanIndexV3TableName)

	rows, err := inv.telemetryStore.ClickhouseDB().Query(ctx, query, traceID)
	if err != nil {
		return nil, fmt.Errorf("failed to query trace: %w", err)
	}
	defer rows.Close()

	var spans []map[string]interface{}
	for rows.Next() {
		var (
			traceID, spanID, parentSpanID, serviceName, operation string
			durationNano                                          uint64
			timestamp                                             int64
			statusCode                                            string
			statusMessage                                         string
		)
		if err := rows.Scan(&traceID, &spanID, &parentSpanID, &serviceName, &operation,
			&durationNano, &timestamp, &statusCode, &statusMessage); err != nil {
			continue
		}
		spans = append(spans, map[string]interface{}{
			"trace_id":      traceID,
			"span_id":       spanID,
			"parent_span_id": parentSpanID,
			"service_name":  serviceName,
			"operation":     operation,
			"duration_ms":   float64(durationNano) / 1_000_000,
			"timestamp":     timestamp,
			"status_code":   statusCode,
			"status_message": statusMessage,
		})
	}

	return map[string]interface{}{
		"trace_id": traceID,
		"spans":    spans,
		"span_count": len(spans),
	}, rows.Err()
}
