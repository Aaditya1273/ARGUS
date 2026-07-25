package argus

import (
	"context"
	"fmt"
)

type CostFirewall struct {
	BudgetLimit float64
	CurrentBurn float64
}

func NewCostFirewall(budget float64) *CostFirewall {
	return &CostFirewall{
		BudgetLimit: budget,
		CurrentBurn: 0,
	}
}

// EvaluateRun processes an incoming trace/metrics run and updates burn
func (cf *CostFirewall) EvaluateRun(ctx context.Context, agentID string, cost float64) (bool, error) {
	cf.CurrentBurn += cost

	if cf.CurrentBurn > cf.BudgetLimit {
		return false, fmt.Errorf("agent %s tripped circuit breaker: budget exceeded (burn: %.2f, limit: %.2f)", agentID, cf.CurrentBurn, cf.BudgetLimit)
	}

	return true, nil
}
