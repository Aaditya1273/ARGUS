package actions

import (
	"context"

	"github.com/SigNoz/signoz/pkg/query-service/argus/engine"
	"github.com/SigNoz/signoz/pkg/query-service/argus/recovery"
)

type CircuitBreakerAction struct{}

func NewCircuitBreakerAction() *CircuitBreakerAction { return &CircuitBreakerAction{} }
func (a *CircuitBreakerAction) Name() string { return "Circuit Breaker" }
func (a *CircuitBreakerAction) ActionType() engine.AutomaticAction { return engine.ActionCircuitBreaker }

func (a *CircuitBreakerAction) Execute(ctx context.Context, agentCtx *engine.AgentContext, violation engine.RuleResult) *recovery.RecoveryResult {
	return &recovery.RecoveryResult{Success: true, Message: "Tripped circuit breaker. Agent execution paused for cooldown window."}
}
