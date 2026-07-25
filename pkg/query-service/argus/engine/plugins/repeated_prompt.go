package plugins

import (
	"github.com/SigNoz/signoz/pkg/query-service/argus/engine"
)

type RepeatedPromptDetector struct {
	MaxRepeats int
}

func NewRepeatedPromptDetector(max int) *RepeatedPromptDetector {
	return &RepeatedPromptDetector{MaxRepeats: max}
}

func (d *RepeatedPromptDetector) Name() string {
	return "Repeated Prompt Execution"
}

func (d *RepeatedPromptDetector) Evaluate(ctx *engine.AgentContext) *engine.RuleResult {
	repeats := 0
	var lastPrompt string

	for i := len(ctx.Spans) - 1; i >= 0; i-- {
		span := ctx.Spans[i]
		if span.Kind != "llm" || span.PromptText == "" {
			continue
		}

		if lastPrompt == "" {
			lastPrompt = span.PromptText
			repeats = 1
		} else if span.PromptText == lastPrompt {
			repeats++
			if repeats >= d.MaxRepeats {
				return &engine.RuleResult{
					RuleName:          d.Name(),
					Severity:          engine.SeverityHigh,
					Reason:            "The agent submitted the exact same prompt multiple times.",
					RecommendedAction: "Check agent state management to ensure it is receiving tool outputs.",
					AutomaticAction:   engine.ActionTriggerFallback,
				}
			}
		} else {
			break
		}
	}

	return nil
}
