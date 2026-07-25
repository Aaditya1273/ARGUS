package plugins

import (
	"fmt"
	"github.com/SigNoz/signoz/pkg/query-service/argus/engine"
)

type BudgetExceededDetector struct{}

func NewBudgetExceededDetector() *BudgetExceededDetector {
	return &BudgetExceededDetector{}
}

func (d *BudgetExceededDetector) Name() string {
	return "Budget Exceeded"
}

func (d *BudgetExceededDetector) Evaluate(ctx *engine.AgentContext) *engine.RuleResult {
	if ctx.BudgetLimit > 0 && ctx.CurrentCost > ctx.BudgetLimit {
		return &engine.RuleResult{
			RuleName:          d.Name(),
			Severity:          engine.SeverityCritical,
			Reason:            fmt.Sprintf("Agent cost (%.2f) exceeded the runtime budget limit (%.2f).", ctx.CurrentCost, ctx.BudgetLimit),
			RecommendedAction: "Review LLM model usage or set tighter constraints on agent autonomy.",
			AutomaticAction:   engine.ActionKillRun,
		}
	}
	return nil
}
