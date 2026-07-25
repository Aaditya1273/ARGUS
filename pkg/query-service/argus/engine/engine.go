package engine

import (
	"context"
	"log/slog"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// SelfHealingFn is a callback interface for the recovery engine to avoid circular dependencies.
// The ctx carries request-scoped values; agentCtx carries the full agent execution state.
type SelfHealingFn func(ctx context.Context, agentCtx *AgentContext, violation RuleResult)

// GovernanceEngine manages the lifecycle and execution of all registered rule plugins
type GovernanceEngine struct {
	logger        *slog.Logger
	plugins       []DetectorPlugin
	recoveryHook  SelfHealingFn
}

// NewGovernanceEngine creates a new engine instance
func NewGovernanceEngine(logger *slog.Logger, hook SelfHealingFn) *GovernanceEngine {
	return &GovernanceEngine{
		logger:       logger,
		plugins:      make([]DetectorPlugin, 0),
		recoveryHook: hook,
	}
}

// RegisterPlugin adds a new detector rule to the engine
func (e *GovernanceEngine) RegisterPlugin(plugin DetectorPlugin) {
	e.plugins = append(e.plugins, plugin)
	e.logger.InfoContext(context.Background(), "argus engine: registered plugin",
		slog.String("plugin", plugin.Name()),
	)
}

// EvaluateContext runs the agent trace context through all registered plugins.
// It returns a list of all rule violations found. Each violation is emitted
// as an OTel span event, making it visible in SigNoz Trace Explorer.
func (e *GovernanceEngine) EvaluateContext(ctx context.Context, agentCtx *AgentContext) []RuleResult {
	var violations []RuleResult
	span := trace.SpanFromContext(ctx)

	for _, plugin := range e.plugins {
		result := plugin.Evaluate(agentCtx)
		if result != nil {
			e.logger.WarnContext(ctx, "argus engine: rule triggered",
				slog.String("rule", result.RuleName),
				slog.String("severity", string(result.Severity)),
				slog.String("action", string(result.AutomaticAction)),
				slog.String("reason", result.Reason),
				slog.String("trace_id", agentCtx.TraceID),
			)

			span.AddEvent("argus.governance.violation", trace.WithAttributes(
				attribute.String("argus.rule", result.RuleName),
				attribute.String("argus.severity", string(result.Severity)),
				attribute.String("argus.action", string(result.AutomaticAction)),
				attribute.String("argus.reason", result.Reason),
				attribute.String("argus.trace_id", agentCtx.TraceID),
				attribute.String("argus.project", agentCtx.ProjectName),
			))

			violations = append(violations, *result)

			if e.recoveryHook != nil {
				e.recoveryHook(ctx, agentCtx, *result)
			}
		}
	}

	return violations
}
