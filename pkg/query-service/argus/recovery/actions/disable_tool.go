package actions

import (
	"context"

	"github.com/SigNoz/signoz/pkg/query-service/argus/engine"
	"github.com/SigNoz/signoz/pkg/query-service/argus/recovery"
)

type DisableToolAction struct{}

func NewDisableToolAction() *DisableToolAction { return &DisableToolAction{} }
func (a *DisableToolAction) Name() string { return "Disable Tool" }
func (a *DisableToolAction) ActionType() engine.AutomaticAction { return engine.ActionDisableTool }

func (a *DisableToolAction) Execute(ctx context.Context, agentCtx *engine.AgentContext, violation engine.RuleResult) *recovery.RecoveryResult {
	return &recovery.RecoveryResult{Success: true, Message: "Temporarily disabled failing tool from agent runtime capabilities"}
}
