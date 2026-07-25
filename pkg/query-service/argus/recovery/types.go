package recovery

import (
	"context"

	"github.com/SigNoz/signoz/pkg/query-service/argus/engine"
)

// RecoveryResult encapsulates the outcome of a recovery action
type RecoveryResult struct {
	Success bool
	Message string
}

// RecoveryAction defines a strategy to recover an agent run
type RecoveryAction interface {
	Name() string
	ActionType() engine.AutomaticAction
	Execute(ctx context.Context, agentCtx *engine.AgentContext, violation engine.RuleResult) *RecoveryResult
}
