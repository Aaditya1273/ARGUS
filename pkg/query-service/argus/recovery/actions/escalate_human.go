package actions

import (
	"context"

	"github.com/SigNoz/signoz/pkg/query-service/argus/engine"
	"github.com/SigNoz/signoz/pkg/query-service/argus/recovery"
)

type EscalateHumanAction struct{}

func NewEscalateHumanAction() *EscalateHumanAction { return &EscalateHumanAction{} }
func (a *EscalateHumanAction) Name() string { return "Escalate to Human" }
func (a *EscalateHumanAction) ActionType() engine.AutomaticAction { return engine.ActionEscalateHuman }

func (a *EscalateHumanAction) Execute(ctx context.Context, agentCtx *engine.AgentContext, violation engine.RuleResult) *recovery.RecoveryResult {
	return &recovery.RecoveryResult{Success: true, Message: "Halted agent and flagged trace for Human-In-The-Loop review"}
}
