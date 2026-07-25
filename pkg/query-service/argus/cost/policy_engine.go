package cost

import (
	"context"
	"log/slog"
	"sync"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// PolicyEngine evaluates cost contexts against billing policies
type PolicyEngine struct {
	mu       sync.RWMutex
	logger   *slog.Logger
	policies []CostPolicy
	tracker  *CostTracker
}

// NewPolicyEngine initializes the engine
func NewPolicyEngine(logger *slog.Logger, tracker *CostTracker) *PolicyEngine {
	return &PolicyEngine{
		logger:   logger,
		policies: make([]CostPolicy, 0),
		tracker:  tracker,
	}
}

// AddPolicy registers a new user-defined cost guardrail
func (pe *PolicyEngine) AddPolicy(ctx context.Context, policy CostPolicy) {
	pe.mu.Lock()
	defer pe.mu.Unlock()
	// Validate the policy condition
	switch policy.Condition.Operator {
	case ">", ">=", "==", "<", "<=":
		// valid
	default:
		pe.logger.WarnContext(ctx, "cost policy: invalid operator, defaulting to >",
			slog.String("operator", policy.Condition.Operator),
		)
		policy.Condition.Operator = ">"
	}
	pe.policies = append(pe.policies, policy)
	pe.logger.InfoContext(ctx, "cost policy: added",
		slog.String("policy", policy.Name),
		slog.String("dimension", policy.Condition.Dimension),
		slog.Float64("threshold", policy.Condition.Threshold),
	)
}

// GetPolicies returns the list of active policies
func (pe *PolicyEngine) GetPolicies() []CostPolicy {
	pe.mu.RLock()
	defer pe.mu.RUnlock()
	return pe.policies
}

// Evaluate evaluates the current trace and global state against all rules.
// Violations are emitted as OTel span events, visible in SigNoz Trace Explorer.
func (pe *PolicyEngine) Evaluate(ctx context.Context, costCtx *TraceCostContext) *CostPolicy {
	pe.mu.RLock()
	defer pe.mu.RUnlock()

	span := trace.SpanFromContext(ctx)
	globalState := pe.tracker.GetMetrics()

	for _, pol := range pe.policies {
		if !pol.Enabled {
			continue
		}

		var valueToTest float64
		switch pol.Condition.Dimension {
		case "run_cost":
			valueToTest = costCtx.TotalCost
		case "daily_budget":
			valueToTest = globalState.CurrentDaily
		case "model_gpt-4":
			valueToTest = globalState.CostPerModel["gpt-4"]
		default:
			continue
		}

		// Evaluate operator
		violation := false
		switch pol.Condition.Operator {
		case ">":
			violation = valueToTest > pol.Condition.Threshold
		case ">=":
			violation = valueToTest >= pol.Condition.Threshold
		case "==":
			violation = valueToTest == pol.Condition.Threshold
		case "<":
			violation = valueToTest < pol.Condition.Threshold
		case "<=":
			violation = valueToTest <= pol.Condition.Threshold
		}

		if violation {
			pe.logger.WarnContext(ctx, "cost policy: violation triggered",
				slog.String("policy", pol.Name),
				slog.String("dimension", pol.Condition.Dimension),
				slog.Float64("value", valueToTest),
				slog.Float64("threshold", pol.Condition.Threshold),
				slog.String("action", pol.Action),
				slog.String("trace_id", costCtx.TraceID),
			)

			span.AddEvent("argus.cost.violation", trace.WithAttributes(
				attribute.String("argus.policy", pol.Name),
				attribute.String("argus.dimension", pol.Condition.Dimension),
				attribute.Float64("argus.value", valueToTest),
				attribute.Float64("argus.threshold", pol.Condition.Threshold),
				attribute.String("argus.action", pol.Action),
				attribute.String("argus.trace_id", costCtx.TraceID),
			))

			return &pol
		}
	}

	return nil
}

// GenerateAlert fires a cost alert through the alerting system and emits
// an OTel span event visible in SigNoz Trace Explorer.
func (pe *PolicyEngine) GenerateAlert(ctx context.Context, pol *CostPolicy, costCtx *TraceCostContext) {
	pe.logger.ErrorContext(ctx, "cost firewall: alert triggered",
		slog.String("rule", pol.Name),
		slog.String("action", pol.Action),
		slog.String("trace_id", costCtx.TraceID),
		slog.Float64("cost", costCtx.TotalCost),
	)

	span := trace.SpanFromContext(ctx)
	span.AddEvent("argus.cost.alert", trace.WithAttributes(
		attribute.String("argus.policy", pol.Name),
		attribute.String("argus.action", pol.Action),
		attribute.String("argus.trace_id", costCtx.TraceID),
		attribute.Float64("argus.cost", costCtx.TotalCost),
	))
}
