package plugins

import (
	"fmt"

	"github.com/SigNoz/signoz/pkg/query-service/argus/engine"
)

type InfiniteLoopDetector struct {
	MaxConsecutiveTools int
}

func NewInfiniteLoopDetector(max int) *InfiniteLoopDetector {
	return &InfiniteLoopDetector{MaxConsecutiveTools: max}
}

func (d *InfiniteLoopDetector) Name() string {
	return "Infinite Tool Loop"
}

func (d *InfiniteLoopDetector) Evaluate(ctx *engine.AgentContext) *engine.RuleResult {
	if len(ctx.Spans) < d.MaxConsecutiveTools {
		return nil
	}

	consecutive := 1
	var lastTool string

	// Iterate backwards over spans to find repeating tool calls.
	// Skip non-tool spans (LLM, chain) to account for interleaved execution.
	for i := len(ctx.Spans) - 1; i >= 0; i-- {
		span := ctx.Spans[i]
		if span.Kind != "tool" {
			continue // Skip non-tool spans, don't break (interleaved execution)
		}

		if lastTool == "" {
			lastTool = span.Name
			consecutive = 1
		} else if span.Name == lastTool {
			consecutive++
			if consecutive >= d.MaxConsecutiveTools {
				return &engine.RuleResult{
					RuleName:          d.Name(),
					Severity:          engine.SeverityCritical,
					Reason:            fmt.Sprintf("Agent called tool '%s' %d times consecutively.", lastTool, consecutive),
					RecommendedAction: "Review agent prompt instructions to ensure proper tool output parsing.",
					AutomaticAction:   engine.ActionKillRun,
				}
			}
		} else {
			break // Different tool encountered — loop broken
		}
	}

	return nil
}
