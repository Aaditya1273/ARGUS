package recovery_test

import (
	"context"
	"log/slog"
	"testing"

	"github.com/SigNoz/signoz/pkg/query-service/argus/engine"
	"github.com/SigNoz/signoz/pkg/query-service/argus/recovery"
	"github.com/SigNoz/signoz/pkg/query-service/argus/recovery/actions"
)

func newTestLogger(t *testing.T) *slog.Logger {
	t.Helper()
	return slog.New(slog.DiscardHandler)
}

func TestSelfHealingEngine(t *testing.T) {
	selfHeal := recovery.NewSelfHealingEngine(newTestLogger(t))
	selfHeal.RegisterAction(actions.NewKillAgentAction())

	govEngine := engine.NewGovernanceEngine(newTestLogger(t), func(ctx context.Context, agentCtx *engine.AgentContext, violation engine.RuleResult) {
		selfHeal.ExecuteRecovery(ctx, agentCtx, violation)
	})

	// Inject a violation to see if recovery triggers (integration-like test)
	agentCtx := &engine.AgentContext{
		TraceID: "test-trace-123",
	}
	
	violation := engine.RuleResult{
		RuleName: "Token Explosion",
		Severity: engine.SeverityCritical,
		AutomaticAction: engine.ActionKillRun,
	}

	result := selfHeal.ExecuteRecovery(context.Background(), agentCtx, violation)
	
	if result == nil || !result.Success {
		t.Fatal("Expected kill agent action to succeed")
	}

	// Just a simple integration check
	if govEngine == nil {
		t.Fatal("Failed to wire engine")
	}
}
