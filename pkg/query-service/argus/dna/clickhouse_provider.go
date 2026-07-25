package dna

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"time"

	"github.com/SigNoz/signoz/pkg/telemetrystore"
	"github.com/SigNoz/signoz/pkg/telemetrytraces"
	"github.com/huandu/go-sqlbuilder"
)

// ClickHouseBaselineProvider generates Agent DNA baselines from real
// SigNoz ClickHouse trace data. It queries distributed_signoz_index_v3
// to build statistical profiles of agent behavior.
type ClickHouseBaselineProvider struct {
	logger         *slog.Logger
	telemetryStore telemetrystore.TelemetryStore
	detector       *AnomalyDetector
}

// NewClickHouseBaselineProvider creates a DNA baseline provider backed by real ClickHouse data.
func NewClickHouseBaselineProvider(logger *slog.Logger, ts telemetrystore.TelemetryStore, detector *AnomalyDetector) *ClickHouseBaselineProvider {
	return &ClickHouseBaselineProvider{
		logger:         logger,
		telemetryStore: ts,
		detector:       detector,
	}
}

// BuildBaselineFromTraces queries real ClickHouse trace data over the specified window
// and builds a statistical HealthyBaseline for the given agent/service.
func (p *ClickHouseBaselineProvider) BuildBaselineFromTraces(ctx context.Context, agentID string, since time.Duration) (*HealthyBaseline, error) {
	conn := p.telemetryStore.ClickhouseDB()
	now := time.Now()
	endSec := now.Unix()
	startSec := now.Add(-since).Unix()
	endNano := now.UnixNano()
	startNano := now.Add(-since).UnixNano()

	// Query 1: Aggregate latency, cost, and token stats per trace
	sb := sqlbuilder.NewSelectBuilder()
	sb.Select(
		"trace_id",
		"sum(duration_nano) / 1000000 AS total_latency_ms",
		"sum(toUInt64OrZero(attributes_string['gen_ai.usage.prompt_tokens'])) + sum(toUInt64OrZero(attributes_string['gen_ai.usage.completion_tokens'])) AS total_tokens",
		"count() AS span_count",
		"countIf(has_error = true) AS error_count",
	)
	sb.From(fmt.Sprintf("%s.%s", telemetrytraces.DBName, telemetrytraces.SpanIndexV3TableName))
	sb.Where(
		sb.GE("timestamp", startNano),
		sb.L("timestamp", endNano),
		sb.GE("ts_bucket_start", startSec-1800),
		sb.LE("ts_bucket_start", endSec),
	)
	if agentID != "" {
		sb.Where(fmt.Sprintf("attributes_string['argus.agent_id'] = %s", sb.Var(agentID)))
	} else {
		sb.Where("mapContains(attributes_string, 'argus.agent_id')")
	}
	sb.GroupBy("trace_id")

	query, args := sb.BuildWithFlavor(sqlbuilder.ClickHouse)
	rows, err := conn.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("baseline query failed: %w", err)
	}
	defer rows.Close()

	var (
		latencies []float64
		costs     []float64
		tokenVals []float64
	)
	traceIDs := make([]string, 0)
	latencyMap := make(map[string]float64)
	tokenMap := make(map[string]float64)

	for rows.Next() {
		var (
			traceID           string
			totalLatencyMs    float64
			totalTokens       uint64
			spanCount, errCnt uint64
		)
		if err := rows.Scan(&traceID, &totalLatencyMs, &totalTokens, &spanCount, &errCnt); err != nil {
			continue
		}
		latencies = append(latencies, totalLatencyMs)
		tokenVals = append(tokenVals, float64(totalTokens))
		costs = append(costs, float64(totalTokens)*0.00001) // approximate cost from tokens
		traceIDs = append(traceIDs, traceID)
		latencyMap[traceID] = totalLatencyMs
		tokenMap[traceID] = float64(totalTokens)
	}

	if len(latencies) == 0 {
		return nil, nil
	}

	// Calculate statistics
	meanLatency, stdLatency := meanStd(latencies)
	meanCost, stdCost := meanStd(costs)
	meanTokens, stdTokens := meanStd(tokenVals)

	// Query 2: Get tool/operation names used by this agent
	toolSB := sqlbuilder.NewSelectBuilder()
	toolSB.Select("name")
	toolSB.Select("count() AS usage")
	toolSB.From(fmt.Sprintf("%s.%s", telemetrytraces.DBName, telemetrytraces.SpanIndexV3TableName))
	toolSB.Where(
		sb.GE("timestamp", startNano),
		sb.L("timestamp", endNano),
		sb.GE("ts_bucket_start", startSec-1800),
		sb.LE("ts_bucket_start", endSec),
	)
	if agentID != "" {
		toolSB.Where(fmt.Sprintf("attributes_string['argus.agent_id'] = %s", sb.Var(agentID)))
	}
	toolSB.GroupBy("name")
	toolSB.OrderBy("usage DESC")

	toolQuery, toolArgs := toolSB.BuildWithFlavor(sqlbuilder.ClickHouse)
	toolRows, err := conn.Query(ctx, toolQuery, toolArgs...)
	if err != nil {
		return nil, fmt.Errorf("tool query failed: %w", err)
	}
	defer toolRows.Close()

	expectedTools := make(map[string]bool)
	frequentSequences := make(map[string]bool)

	for toolRows.Next() {
		var toolName string
		var usageCount uint64
		if err := toolRows.Scan(&toolName, &usageCount); err != nil {
			continue
		}
		if usageCount > 1 {
			expectedTools[toolName] = true
		}
	}

	baseline := &HealthyBaseline{
		AgentID:           agentID,
		MeanLatencyMs:     meanLatency,
		LatencyStdDev:     stdLatency,
		MeanCost:          meanCost,
		CostStdDev:        stdCost,
		MeanTokens:        meanTokens,
		TokensStdDev:      stdTokens,
		ExpectedTools:     expectedTools,
		FrequentSequences: frequentSequences,
	}

	// Seed into the detector for real anomaly detection
	p.detector.SeedBaseline(baseline)

	p.logger.InfoContext(ctx, "dna clickhouse: built baseline from real trace data",
		slog.String("agent_id", agentID),
		slog.Int("trace_count", len(traceIDs)),
		slog.Int("tool_count", len(expectedTools)),
		slog.Float64("mean_latency_ms", meanLatency),
	)

	return baseline, nil
}

// BuildFingerprintFromTrace queries a single trace from ClickHouse and
// generates a real AgentFingerprint from it.
func (p *ClickHouseBaselineProvider) BuildFingerprintFromTrace(ctx context.Context, traceID string, agentID string) (*AgentFingerprint, error) {
	conn := p.telemetryStore.ClickhouseDB()
	now := time.Now()
	endNano := now.UnixNano()
	startNano := now.Add(-24 * time.Hour).UnixNano()

	sb := sqlbuilder.NewSelectBuilder()
	sb.Select(
		"name",
		"kind_string",
		"duration_nano",
		"attributes_string['gen_ai.request.model'] AS model",
		"attributes_string['gen_ai.usage.prompt_tokens'] AS prompt_tokens",
		"attributes_string['gen_ai.usage.completion_tokens'] AS completion_tokens",
		"attributes_string['argus.tool_name'] AS tool_name",
		"has_error",
	)
	sb.From(fmt.Sprintf("%s.%s", telemetrytraces.DBName, telemetrytraces.SpanIndexV3TableName))
	sb.Where(
		"trace_id = " + sb.Var(traceID),
		sb.GE("timestamp", startNano),
		sb.L("timestamp", endNano),
	)
	sb.OrderBy("timestamp ASC")

	query, args := sb.BuildWithFlavor(sqlbuilder.ClickHouse)
	rows, err := conn.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("fingerprint query failed: %w", err)
	}
	defer rows.Close()

	var (
		tools        []string
		models       []string
		totalLatency int64
		inputTokens  int
		outputTokens int
	)
	modelSet := make(map[string]bool)

	for rows.Next() {
		var (
			name, kind, model, toolName string
			durationNano, promptT, compT uint64
			hasError                    bool
		)
		if err := rows.Scan(&name, &kind, &durationNano, &model, &promptT, &compT, &toolName, &hasError); err != nil {
			continue
		}

		totalLatency += int64(durationNano / 1_000_000)
		inputTokens += int(promptT)
		outputTokens += int(compT)

		if toolName != "" {
			tools = append(tools, toolName)
		} else if name != "" {
			tools = append(tools, name)
		}

		if model != "" && !modelSet[model] {
			modelSet[model] = true
			models = append(models, model)
		}
		// hasError is available for error analysis but not used in fingerprint
	}

	profiler := NewProfiler()
	return profiler.GenerateFingerprint(traceID, agentID, tools, models, totalLatency, inputTokens+outputTokens, float64(inputTokens+outputTokens)*0.00001), nil
}

// meanStd calculates mean and standard deviation of a float64 slice.
func meanStd(values []float64) (float64, float64) {
	if len(values) == 0 {
		return 0, 0
	}
	var sum float64
	for _, v := range values {
		sum += v
	}
	mean := sum / float64(len(values))

	var varianceSum float64
	for _, v := range values {
		diff := v - mean
		varianceSum += diff * diff
	}
	variance := varianceSum / float64(len(values))
	return mean, math.Sqrt(variance)
}
