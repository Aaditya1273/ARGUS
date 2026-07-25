package plugins

import (
	"fmt"
	"time"
	"github.com/SigNoz/signoz/pkg/query-service/argus/engine"
)

type LatencySpikeDetector struct {
	MaxDuration time.Duration
}

func NewLatencySpikeDetector(max time.Duration) *LatencySpikeDetector {
	return &LatencySpikeDetector{MaxDuration: max}
}

func (d *LatencySpikeDetector) Name() string {
	return "Latency Spike"
}

func (d *LatencySpikeDetector) Evaluate(ctx *engine.AgentContext) *engine.RuleResult {
	for _, span := range ctx.Spans {
		if span.Kind == "llm" && span.Duration > d.MaxDuration {
			return &engine.RuleResult{
				RuleName:          d.Name(),
				Severity:          engine.SeverityMedium,
				Reason:            fmt.Sprintf("LLM call took %s, exceeding SLA of %s", span.Duration, d.MaxDuration),
				RecommendedAction: "Consider switching to a faster or smaller model for this task.",
				AutomaticAction:   engine.ActionTriggerFallback,
			}
		}
	}
	return nil
}
