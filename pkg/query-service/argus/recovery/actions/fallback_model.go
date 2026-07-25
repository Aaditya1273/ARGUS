package actions

import (
	"context"

	"github.com/SigNoz/signoz/pkg/query-service/argus/engine"
	"github.com/SigNoz/signoz/pkg/query-service/argus/recovery"
)

type FallbackModelAction struct{}

func NewFallbackModelAction() *FallbackModelAction { return &FallbackModelAction{} }
func (a *FallbackModelAction) Name() string { return "Fallback Model" }
func (a *FallbackModelAction) ActionType() engine.AutomaticAction { return engine.ActionTriggerFallback }

func (a *FallbackModelAction) Execute(ctx context.Context, agentCtx *engine.AgentContext, violation engine.RuleResult) *recovery.RecoveryResult {
	return &recovery.RecoveryResult{Success: true, Message: "Instructed SDK to route to fallback/cheaper model tier"}
}
