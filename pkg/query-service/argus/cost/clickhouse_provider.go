package cost

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/SigNoz/signoz/pkg/telemetrystore"
	"github.com/SigNoz/signoz/pkg/telemetrytraces"
	"github.com/huandu/go-sqlbuilder"
)

// ClickHouseCostProvider queries real cost data from SigNoz ClickHouse.
// It reads gen_ai span attributes (model, token counts) from the traces table
// and calculates actual costs based on token usage and model pricing.
type ClickHouseCostProvider struct {
	logger         *slog.Logger
	telemetryStore telemetrystore.TelemetryStore
	tracker        *CostTracker
}

// NewClickHouseCostProvider creates a cost provider backed by real SigNoz data.
func NewClickHouseCostProvider(logger *slog.Logger, ts telemetrystore.TelemetryStore, tracker *CostTracker) *ClickHouseCostProvider {
	return &ClickHouseCostProvider{
		logger:         logger,
		telemetryStore: ts,
		tracker:        tracker,
	}
}

// ModelCostEntry represents the cost breakdown for a single LLM call.
type ModelCostEntry struct {
	Model           string  `json:"model"`
	TotalCost       float64 `json:"total_cost"`
	InputTokens     int64   `json:"input_tokens"`
	OutputTokens    int64   `json:"output_tokens"`
	SpanCount       int64   `json:"span_count"`
	AvgLatencyMs    float64 `json:"avg_latency_ms"`
}

// AggregateCostResult holds the aggregated cost metrics from ClickHouse.
type AggregateCostResult struct {
	TotalCost    float64          `json:"total_cost"`
	ByModel      []ModelCostEntry `json:"by_model"`
	ByAgent      []ModelCostEntry `json:"by_agent"`
	AgentIDs     []string         `json:"agent_ids"`
	ModelNames   []string         `json:"model_names"`
}

// QueryRealCosts queries the real SigNoz ClickHouse traces table for LLM cost data
// over the specified time range. It extracts gen_ai span attributes and calculates
// costs using the tracker's pricing table.
func (p *ClickHouseCostProvider) QueryRealCosts(ctx context.Context, since time.Duration) (*AggregateCostResult, error) {
	conn := p.telemetryStore.ClickhouseDB()
	now := time.Now()
	endSec := now.Unix()
	startSec := now.Add(-since).Unix()
	endNano := now.UnixNano()
	startNano := now.Add(-since).UnixNano()

	// Query real trace data for LLM spans, extracting model and token info
	sb := sqlbuilder.NewSelectBuilder()
	sb.Select(
		"count() AS span_count",
		"attributes_string['gen_ai.request.model'] AS model_name",
		"avg(duration_nano) / 1000000 AS avg_latency_ms",
		"sum(toUInt64OrZero(attributes_string['gen_ai.usage.prompt_tokens'])) AS total_input_tokens",
		"sum(toUInt64OrZero(attributes_string['gen_ai.usage.completion_tokens'])) AS total_output_tokens",
		"attributes_string['argus.agent_id'] AS agent_id",
	)
	sb.From(fmt.Sprintf("%s.%s", telemetrytraces.DBName, telemetrytraces.SpanIndexV3TableName))
	sb.Where(
		"mapContains(attributes_string, 'gen_ai.request.model')",
		sb.GE("timestamp", startNano),
		sb.L("timestamp", endNano),
		sb.GE("ts_bucket_start", startSec-1800),
		sb.LE("ts_bucket_start", endSec),
	)
	sb.GroupBy("model_name", "agent_id")
	sb.OrderBy("span_count DESC")

	query, args := sb.BuildWithFlavor(sqlbuilder.ClickHouse)
	rows, err := conn.Query(ctx, query, args...)
	if err != nil {
		p.logger.WarnContext(ctx, "cost clickhouse: query failed", slog.String("error", err.Error()))
		return &AggregateCostResult{}, fmt.Errorf("clickhouse cost query failed: %w", err)
	}
	defer rows.Close()

	result := &AggregateCostResult{
		ByModel:    make([]ModelCostEntry, 0),
		ByAgent:    make([]ModelCostEntry, 0),
		AgentIDs:   make([]string, 0),
		ModelNames: make([]string, 0),
	}

	modelCosts := make(map[string]*ModelCostEntry)
	agentCosts := make(map[string]*ModelCostEntry)
	agentSet := make(map[string]bool)
	modelSet := make(map[string]bool)

	for rows.Next() {
		var (
			spanCount                                                      uint64
			modelName, agentID                                             *string
			avgLatencyMs                                                   float64
			totalInputTokens, totalOutputTokens                            uint64
		)

		if err := rows.Scan(&spanCount, &modelName, &avgLatencyMs, &totalInputTokens, &totalOutputTokens, &agentID); err != nil {
			continue
		}

		model := ""
		if modelName != nil {
			model = *modelName
		}
		agent := ""
		if agentID != nil {
			agent = *agentID
		}

		// Calculate cost using the tracker's pricing
		totalTokens := float64(totalInputTokens + totalOutputTokens)
		pricing := p.tracker.GetPricing(model)
		calculatedCost := (totalTokens / 1000.0) * pricing

		if model != "" && !modelSet[model] {
			modelSet[model] = true
			result.ModelNames = append(result.ModelNames, model)
		}
		if agent != "" && !agentSet[agent] {
			agentSet[agent] = true
			result.AgentIDs = append(result.AgentIDs, agent)
		}

		// Aggregate by model
		if model != "" {
			if _, ok := modelCosts[model]; !ok {
				modelCosts[model] = &ModelCostEntry{Model: model}
			}
			modelCosts[model].TotalCost += calculatedCost
			modelCosts[model].InputTokens += int64(totalInputTokens)
			modelCosts[model].OutputTokens += int64(totalOutputTokens)
			modelCosts[model].SpanCount += int64(spanCount)
			modelCosts[model].AvgLatencyMs = avgLatencyMs
		}

		// Aggregate by agent
		if agent != "" {
			if _, ok := agentCosts[agent]; !ok {
				agentCosts[agent] = &ModelCostEntry{Model: model}
			}
			agentCosts[agent].TotalCost += calculatedCost
			agentCosts[agent].InputTokens += int64(totalInputTokens)
			agentCosts[agent].OutputTokens += int64(totalOutputTokens)
			agentCosts[agent].SpanCount += int64(spanCount)
		}
	}

	for _, entry := range modelCosts {
		result.ByModel = append(result.ByModel, *entry)
		result.TotalCost += entry.TotalCost
	}
	for _, entry := range agentCosts {
		result.ByAgent = append(result.ByAgent, *entry)
	}

	return result, nil
}

// QueryModelPricing queries the actual model names being used from ClickHouse,
// so the pricing table can be dynamically populated instead of hardcoded.
func (p *ClickHouseCostProvider) QueryModelPricing(ctx context.Context) (map[string]float64, error) {
	conn := p.telemetryStore.ClickhouseDB()
	now := time.Now()
	endNano := now.UnixNano()
	startNano := now.Add(-30 * 24 * time.Hour).UnixNano()

	sb := sqlbuilder.NewSelectBuilder()
	sb.Select(
		"attributes_string['gen_ai.request.model'] AS model",
	)
	sb.From(fmt.Sprintf("%s.%s", telemetrytraces.DBName, telemetrytraces.SpanIndexV3TableName))
	sb.Where(
		"mapContains(attributes_string, 'gen_ai.request.model')",
		sb.GE("timestamp", startNano),
		sb.L("timestamp", endNano),
	)
	sb.GroupBy("model")

	query, args := sb.BuildWithFlavor(sqlbuilder.ClickHouse)
	rows, err := conn.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("model pricing query failed: %w", err)
	}
	defer rows.Close()

	models := make(map[string]float64)
	for rows.Next() {
		var modelName string
		if err := rows.Scan(&modelName); err != nil {
			continue
		}
		if modelName == "" {
			continue
		}
		models[modelName] = p.tracker.GetPricing(modelName)
	}

	return models, nil
}

// SyncPricingFromClickHouse updates the tracker's pricing table with
// models actually observed in real trace data.
func (p *ClickHouseCostProvider) SyncPricingFromClickHouse(ctx context.Context) error {
	models, err := p.QueryModelPricing(ctx)
	if err != nil {
		return err
	}
	for model, price := range models {
		p.tracker.SetPricing(model, price)
	}
	p.logger.InfoContext(ctx, "cost clickhouse: synced pricing from real trace data",
		slog.Int("model_count", len(models)),
	)
	return nil
}
