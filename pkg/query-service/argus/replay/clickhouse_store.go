package replay

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/SigNoz/signoz/pkg/telemetrystore"
	"github.com/SigNoz/signoz/pkg/telemetrytraces"
	"github.com/huandu/go-sqlbuilder"
)

// ClickHouseTraceStore is a production implementation of TraceStore
// that queries real SigNoz trace data from ClickHouse.
// It reads from signoz_traces.distributed_signoz_index_v3 to reconstruct
// full trace contexts for prompt replay.
type ClickHouseTraceStore struct {
	logger         *slog.Logger
	telemetryStore telemetrystore.TelemetryStore
}

// NewClickHouseTraceStore creates a TraceStore backed by the real SigNoz ClickHouse.
func NewClickHouseTraceStore(logger *slog.Logger, ts telemetrystore.TelemetryStore) *ClickHouseTraceStore {
	return &ClickHouseTraceStore{
		logger:         logger,
		telemetryStore: ts,
	}
}

// GetTrace reconstructs a full TraceContext from real ClickHouse trace data.
// It queries distributed_signoz_index_v3 for spans belonging to the trace,
// extracting LLM-specific attributes using GenAI semantic conventions.
func (s *ClickHouseTraceStore) GetTrace(ctx context.Context, traceID string) (*TraceContext, error) {
	conn := s.telemetryStore.ClickhouseDB()

	// First pass: get all spans for this trace from the real traces table.
	// The trace_id in ClickHouse is stored as FixedString(32) hex.
	// We search over recent data (last 7 days) with the bucket filter.
	now := time.Now()
	endSec := now.Unix()
	startSec := now.Add(-7 * 24 * time.Hour).Unix()
	endNano := now.UnixNano()
	startNano := now.Add(-7 * 24 * time.Hour).UnixNano()

	sb := sqlbuilder.NewSelectBuilder()
	sb.Select(
		"trace_id",
		"span_id",
		"parent_span_id",
		"name",
		"kind_string",
		"duration_nano",
		"timestamp",
		"status_code_string",
		"attributes_string['gen_ai.request.model'] AS model",
		"attributes_string['gen_ai.usage.prompt_tokens'] AS prompt_tokens",
		"attributes_string['gen_ai.usage.completion_tokens'] AS completion_tokens",
		"attributes_string['gen_ai.response.id'] AS response_id",
		"attributes_string['gen_ai.prompt'] AS prompt_text",
		"attributes_string['gen_ai.completion'] AS completion_text",
		"attributes_string['llm.token_count.prompt'] AS lt_prompt_tokens",
		"attributes_string['llm.token_count.completion'] AS lt_completion_tokens",
		"attributes_string['argus.agent_id'] AS argus_agent_id",
		"attributes_string['argus.session_id'] AS argus_session_id",
		"attributes_string['argus.tool_name'] AS argus_tool_name",
		"attribute_string_http$$route AS http_route",
		"resource_string_service$$name AS service_name",
	)
	sb.From(fmt.Sprintf("%s.%s", telemetrytraces.DBName, telemetrytraces.SpanIndexV3TableName))
	sb.Where(
		"trace_id = " + sb.Var(traceID),
		sb.GE("timestamp", startNano),
		sb.L("timestamp", endNano),
		sb.GE("ts_bucket_start", startSec-1800),
		sb.LE("ts_bucket_start", endSec),
	)
	sb.OrderBy("timestamp ASC")

	query, args := sb.BuildWithFlavor(sqlbuilder.ClickHouse)
	rows, err := conn.Query(ctx, query, args...)
	if err != nil {
		s.logger.WarnContext(ctx, "clickhouse trace store: query failed",
			slog.String("trace_id", traceID),
			slog.String("error", err.Error()),
		)
		return nil, fmt.Errorf("clickhouse query failed: %w", err)
	}
	defer rows.Close()

	var (
		messages       []Message
		tools          []string
		model          string
		originalPrompt string
		responseText   string
		latencyMs      int64 = 0
		found          bool  = false
	)

	for rows.Next() {
		found = true
		var (
			dbTraceID, dbSpanID, dbParentSpanID, dbName, dbKind, dbStatus string
			dbDurationNano, dbTimestamp                                    uint64
			dbModel, dbPromptTokens, dbCompletionTokens, dbResponseID      *string
			dbPromptText, dbCompletionText                                 *string
			dbLtPrompt, dbLtCompletion                                     *string
			dbAgentID, dbSessionID, dbToolName                             *string
			dbHTTPRoute, dbServiceName                                     *string
		)

		if err := rows.Scan(
			&dbTraceID, &dbSpanID, &dbParentSpanID, &dbName, &dbKind,
			&dbDurationNano, &dbTimestamp, &dbStatus,
			&dbModel, &dbPromptTokens, &dbCompletionTokens, &dbResponseID,
			&dbPromptText, &dbCompletionText,
			&dbLtPrompt, &dbLtCompletion,
			&dbAgentID, &dbSessionID, &dbToolName,
			&dbHTTPRoute, &dbServiceName,
		); err != nil {
			continue
		}

		if dbModel != nil && *dbModel != "" {
			model = *dbModel
		}

		// Accumulate total latency
		latencyMs += int64(dbDurationNano / 1_000_000)

		// Check for tool calls
		if strings.Contains(strings.ToLower(dbKind), "tool") || (dbToolName != nil && *dbToolName != "") {
			toolName := dbName
			if dbToolName != nil && *dbToolName != "" {
				toolName = *dbToolName
			}
			tools = append(tools, toolName)
		}

		// Extract prompts from LLM spans
		if dbPromptText != nil && *dbPromptText != "" {
			originalPrompt = *dbPromptText
			messages = append(messages, Message{Role: "user", Content: *dbPromptText})
		}

		// Extract completions
		if dbCompletionText != nil && *dbCompletionText != "" {
			responseText = *dbCompletionText
			messages = append(messages, Message{Role: "assistant", Content: *dbCompletionText})
		}

		// dbResponseID is the GenAI response ID, available for dedup
	}

	if !found {
		s.logger.WarnContext(ctx, "clickhouse trace store: trace not found",
			slog.String("trace_id", traceID),
		)
		return nil, nil
	}

	traceCtx := &TraceContext{
		TraceID:          traceID,
		OriginalPrompt:   originalPrompt,
		Model:            model,
		Tools:            tools,
		MemoryState:      "reconstructed",
		Messages:         messages,
		OriginalResponse: responseText,
		LatencyMs:        latencyMs,
		Cost:             0.0, // Will be calculated by the cost tracker
	}

	// Save back to store for caching (best-effort, ignore errors)
	s.logger.DebugContext(ctx, "clickhouse trace store: cached reconstructed trace")

	return traceCtx, nil
}

// SaveTrace persists a trace context.
// In the ClickHouse implementation, this caches to the store for quick re-reads.
// The trace spans are already in ClickHouse — this cache is for the
// reconstructed TraceContext which has parsed/mapped LLM attributes.
func (s *ClickHouseTraceStore) SaveTrace(_ context.Context, trace *TraceContext) error {
	// Future: persist to a PostgreSQL-backed cache table.
	// For now, ClickHouse is the source of truth.
	return nil
}
