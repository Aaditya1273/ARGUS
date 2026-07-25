package recovery

import (
	"context"
	"log/slog"

	"github.com/SigNoz/signoz/pkg/query-service/argus/engine"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("argus.recovery")

// SelfHealingEngine orchestrates the automated recovery of agents
type SelfHealingEngine struct {
	logger  *slog.Logger
	actions map[engine.AutomaticAction]RecoveryAction
}

// NewSelfHealingEngine creates a new recovery engine
func NewSelfHealingEngine(logger *slog.Logger) *SelfHealingEngine {
	return &SelfHealingEngine{
		logger:  logger,
		actions: make(map[engine.AutomaticAction]RecoveryAction),
	}
}

// RegisterAction maps a governance action type to a concrete recovery strategy
func (s *SelfHealingEngine) RegisterAction(action RecoveryAction) {
	s.actions[action.ActionType()] = action
	s.logger.InfoContext(context.Background(), "argus recovery: registered action",
		slog.String("action", action.Name()),
		slog.String("type", string(action.ActionType())),
	)
}

// ExecuteRecovery runs the mapped recovery strategy and emits a full lifecycle trace
func (s *SelfHealingEngine) ExecuteRecovery(ctx context.Context, agentCtx *engine.AgentContext, violation engine.RuleResult) *RecoveryResult {
	action, exists := s.actions[violation.AutomaticAction]
	if !exists {
		s.logger.WarnContext(ctx, "argus recovery: no action registered",
			slog.String("action_type", string(violation.AutomaticAction)),
			slog.String("trace_id", agentCtx.TraceID),
		)
		return nil
	}

	// Start OpenTelemetry span to trace the automated decision and recovery
	ctx, span := tracer.Start(ctx, "Automated Recovery: "+action.Name(), trace.WithAttributes(
		attribute.String("argus.problem.rule", violation.RuleName),
		attribute.String("argus.problem.reason", violation.Reason),
		attribute.String("argus.problem.severity", string(violation.Severity)),
		attribute.String("argus.decision.action", string(violation.AutomaticAction)),
		attribute.String("argus.agent.trace_id", agentCtx.TraceID),
		attribute.String("argus.agent.project", agentCtx.ProjectName),
	))
	defer span.End()

	s.logger.InfoContext(ctx, "argus recovery: executing",
		slog.String("action", action.Name()),
		slog.String("trace_id", agentCtx.TraceID),
	)
	result := action.Execute(ctx, agentCtx, violation)

	// Record outcome
	span.SetAttributes(
		attribute.Bool("argus.outcome.success", result.Success),
		attribute.String("argus.outcome.message", result.Message),
	)

	if !result.Success {
		span.RecordError(nil, trace.WithAttributes(attribute.String("error.message", result.Message)))
		s.logger.ErrorContext(ctx, "argus recovery: action failed",
			slog.String("action", action.Name()),
			slog.String("message", result.Message),
		)
	}

	return result
}
