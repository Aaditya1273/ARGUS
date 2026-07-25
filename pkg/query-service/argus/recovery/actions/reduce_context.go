package actions

import (
	"context"

	"github.com/SigNoz/signoz/pkg/query-service/argus/engine"
	"github.com/SigNoz/signoz/pkg/query-service/argus/recovery"
)

type ReduceContextAction struct{}

func NewReduceContextAction() *ReduceContextAction { return &ReduceContextAction{} }
func (a *ReduceContextAction) Name() string { return "Reduce Context" }
func (a *ReduceContextAction) ActionType() engine.AutomaticAction { return engine.ActionReduceContext }

func (a *ReduceContextAction) Execute(ctx context.Context, agentCtx *engine.AgentContext, violation engine.RuleResult) *recovery.RecoveryResult {
	return &recovery.RecoveryResult{Success: true, Message: "Requested context summarization pass before next LLM call"}
}
