package cost_test

import (
	"context"
	"log/slog"
	"testing"

	"github.com/SigNoz/signoz/pkg/query-service/argus/cost"
)

func newTestLogger() *slog.Logger {
	return slog.New(slog.DiscardHandler)
}

func TestCostTracker(t *testing.T) {
	tracker := cost.NewCostTracker()
	
	ctx := &cost.TraceCostContext{
		TraceID: "t-1",
		Model: "gpt-4",
		InputTokens: 1000,
		OutputTokens: 1000,
	}

	calculatedCost := tracker.CalculateCost(ctx)
	// 2000 tokens * 0.03 / 1000 = 0.06
	if calculatedCost != 0.06 {
		t.Fatalf("Expected 0.06, got %f", calculatedCost)
	}
}

func TestPolicyEngine(t *testing.T) {
	tracker := cost.NewCostTracker()
	engine := cost.NewPolicyEngine(newTestLogger(), tracker)

	// Add a policy first since defaults were removed
	engine.AddPolicy(context.Background(), cost.CostPolicy{
		Name: "Run Cost Limit",
		Condition: cost.PolicyCondition{Dimension: "run_cost", Operator: ">", Threshold: 5.0},
		Action: "KILL_RUN",
		Enabled: true,
	})

	costCtx := &cost.TraceCostContext{
		TraceID: "t-1",
		TotalCost: 10.0, // Above the $5 Run Cost Limit
	}

	policy := engine.Evaluate(context.Background(), costCtx)
	if policy == nil {
		t.Fatal("Expected policy violation for run cost")
	}

	if policy.Action != "KILL_RUN" {
		t.Fatalf("Expected KILL_RUN, got %s", policy.Action)
	}
}
