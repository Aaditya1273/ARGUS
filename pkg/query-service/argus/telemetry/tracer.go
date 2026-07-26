// Package telemetry provides ARGUS-specific OpenTelemetry helpers.
// Every MCP tool call, governance violation, and budget event is emitted
// as a real OTel span that ships to SigNoz Cloud.
package telemetry

import (
	"context"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

const instrumentationName = "argus.control-plane"

// Tracer returns the ARGUS OTel tracer (global provider, set in main.go).
func Tracer() trace.Tracer {
	return otel.Tracer(instrumentationName)
}

// RecordMCPToolCall emits a span for a single MCP tool call.
// This is what proves ARGUS is actually used — every Claude tool call
// shows up in SigNoz Trace Explorer as service=argus-control-plane.
func RecordMCPToolCall(ctx context.Context, sessionID, tool string, cost float64, totalBurn float64) {
	_, span := Tracer().Start(ctx, "mcp.tool_call",
		trace.WithSpanKind(trace.SpanKindServer),
		trace.WithTimestamp(time.Now()),
	)
	defer span.End()

	span.SetAttributes(
		attribute.String("mcp.session_id", sessionID),
		attribute.String("mcp.tool", tool),
		attribute.Float64("argus.tool.cost_usd", cost),
		attribute.Float64("argus.total_burn_usd", totalBurn),
		attribute.String("gen_ai.system", "argus-mcp"),
		attribute.String("argus.component", "mcp-server"),
	)
	span.SetStatus(codes.Ok, "tool call recorded")
}

// RecordGovernanceViolation emits a span for a governance rule firing.
func RecordGovernanceViolation(ctx context.Context, sessionID, ruleName, severity, action, reason string) {
	_, span := Tracer().Start(ctx, "argus.governance.violation",
		trace.WithSpanKind(trace.SpanKindInternal),
	)
	defer span.End()

	span.SetAttributes(
		attribute.String("argus.session_id", sessionID),
		attribute.String("argus.rule", ruleName),
		attribute.String("argus.severity", severity),
		attribute.String("argus.action", action),
		attribute.String("argus.reason", reason),
		attribute.String("argus.component", "governance-engine"),
	)
	span.SetStatus(codes.Error, "governance violation: "+ruleName)
}

// RecordBudgetExceeded emits a span when an agent hits its budget limit.
func RecordBudgetExceeded(ctx context.Context, sessionID string, totalBurn, budgetLimit float64) {
	_, span := Tracer().Start(ctx, "argus.budget.exceeded",
		trace.WithSpanKind(trace.SpanKindInternal),
	)
	defer span.End()

	span.SetAttributes(
		attribute.String("argus.session_id", sessionID),
		attribute.Float64("argus.total_burn_usd", totalBurn),
		attribute.Float64("argus.budget_limit_usd", budgetLimit),
		attribute.String("argus.component", "cost-firewall"),
	)
	span.SetStatus(codes.Error, "budget exceeded")
}

// RecordSessionConnect emits a span when a Claude session connects via OAuth.
func RecordSessionConnect(ctx context.Context, sessionID, clientName string, budgetLimit float64) {
	_, span := Tracer().Start(ctx, "argus.session.connect",
		trace.WithSpanKind(trace.SpanKindServer),
	)
	defer span.End()

	span.SetAttributes(
		attribute.String("argus.session_id", sessionID),
		attribute.String("argus.client_name", clientName),
		attribute.Float64("argus.budget_limit_usd", budgetLimit),
		attribute.String("argus.component", "oauth-server"),
	)
	span.SetStatus(codes.Ok, "session connected")
}
