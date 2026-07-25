package engine_test

import (
	"context"
	"log/slog"
	"testing"
	"time"

	"github.com/SigNoz/signoz/pkg/query-service/argus/engine"
	"github.com/SigNoz/signoz/pkg/query-service/argus/engine/plugins"
)

func newTestLogger(t *testing.T) *slog.Logger {
	t.Helper()
	return slog.New(slog.DiscardHandler)
}

func TestInfiniteLoopDetector(t *testing.T) {
	ctx := &engine.AgentContext{
		Spans: []engine.TraceSpan{
			{Kind: "tool", Name: "search"},
			{Kind: "tool", Name: "search"},
			{Kind: "tool", Name: "search"},
		},
	}

	detector := plugins.NewInfiniteLoopDetector(3)
	result := detector.Evaluate(ctx)

	if result == nil {
		t.Fatal("Expected loop to be detected")
	}

	if result.Severity != engine.SeverityCritical {
		t.Fatalf("Expected CRITICAL severity, got %v", result.Severity)
	}
}

func TestBudgetExceededDetector(t *testing.T) {
	ctx := &engine.AgentContext{
		BudgetLimit: 10.0,
		CurrentCost: 15.0,
	}

	detector := plugins.NewBudgetExceededDetector()
	result := detector.Evaluate(ctx)

	if result == nil {
		t.Fatal("Expected budget violation to be detected")
	}
}

func TestGovernanceEngine(t *testing.T) {
	eng := engine.NewGovernanceEngine(newTestLogger(t), nil)
	eng.RegisterPlugin(plugins.NewBudgetExceededDetector())
	eng.RegisterPlugin(plugins.NewLatencySpikeDetector(time.Second * 5))

	agentCtx := &engine.AgentContext{
		BudgetLimit: 10.0,
		CurrentCost: 15.0,
		Spans: []engine.TraceSpan{
			{Kind: "llm", Duration: time.Second * 10},
		},
	}

	violations := eng.EvaluateContext(context.Background(), agentCtx)
	if len(violations) != 2 {
		t.Fatalf("Expected 2 violations, got %d", len(violations))
	}
}
