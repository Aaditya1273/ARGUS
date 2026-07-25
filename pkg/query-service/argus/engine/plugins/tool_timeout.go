package plugins

import (
	"fmt"
	"time"
	"github.com/SigNoz/signoz/pkg/query-service/argus/engine"
)

type ToolTimeoutDetector struct {
	MaxTimeout time.Duration
}

func NewToolTimeoutDetector(max time.Duration) *ToolTimeoutDetector {
	return &ToolTimeoutDetector{MaxTimeout: max}
}

func (d *ToolTimeoutDetector) Name() string {
	return "Tool Timeout"
}

func (d *ToolTimeoutDetector) Evaluate(ctx *engine.AgentContext) *engine.RuleResult {
	for _, span := range ctx.Spans {
		if span.Kind == "tool" && span.Status == "timeout" {
			// Or if duration > max
			if span.Duration > d.MaxTimeout {
				return &engine.RuleResult{
					RuleName:          d.Name(),
					Severity:          engine.SeverityHigh,
					Reason:            fmt.Sprintf("Tool %s timed out after %s", span.Name, span.Duration),
					RecommendedAction: "Check external API health or increase tool timeout limits.",
					AutomaticAction:   engine.ActionAlert,
				}
			}
		}
	}
	return nil
}
