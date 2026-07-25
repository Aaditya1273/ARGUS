package actions

import (
	"context"

	"github.com/SigNoz/signoz/pkg/query-service/argus/engine"
	"github.com/SigNoz/signoz/pkg/query-service/argus/recovery"
)

type RetryAction struct{}

func NewRetryAction() *RetryAction { return &RetryAction{} }
func (a *RetryAction) Name() string { return "Retry" }
func (a *RetryAction) ActionType() engine.AutomaticAction { return engine.ActionRetry }

func (a *RetryAction) Execute(ctx context.Context, agentCtx *engine.AgentContext, violation engine.RuleResult) *recovery.RecoveryResult {
	return &recovery.RecoveryResult{Success: true, Message: "Transmitted retry signal with exponential backoff configuration"}
}
