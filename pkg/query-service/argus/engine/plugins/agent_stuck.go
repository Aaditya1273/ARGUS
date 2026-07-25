package plugins

import (
	"time"
	"github.com/SigNoz/signoz/pkg/query-service/argus/engine"
)

type AgentStuckDetector struct {
	MaxInactivity time.Duration
}

func NewAgentStuckDetector(max time.Duration) *AgentStuckDetector {
	return &AgentStuckDetector{MaxInactivity: max}
}

func (d *AgentStuckDetector) Name() string {
	return "Agent Stuck"
}

func (d *AgentStuckDetector) Evaluate(ctx *engine.AgentContext) *engine.RuleResult {
	if len(ctx.Spans) == 0 {
		return nil
	}

	// Assuming the context is evaluated periodically, 
	// we just look at the last span. If it's been running or inactive too long, flag it.
	// (A real implementation would compare against current time, for simulation we just flag spans with excessive duration that aren't marked timeout)
	
	lastSpan := ctx.Spans[len(ctx.Spans)-1]
	if lastSpan.Duration > d.MaxInactivity && lastSpan.Status != "timeout" {
		return &engine.RuleResult{
			RuleName:          d.Name(),
			Severity:          engine.SeverityHigh,
			Reason:            "Agent has been processing a single span for longer than " + d.MaxInactivity.String(),
			RecommendedAction: "Check for deadlocks in agent code or external dependencies.",
			AutomaticAction:   engine.ActionAlert,
		}
	}

	return nil
}
