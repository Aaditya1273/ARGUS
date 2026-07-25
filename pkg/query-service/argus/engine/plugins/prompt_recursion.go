package plugins

import (
	"strings"
	"github.com/SigNoz/signoz/pkg/query-service/argus/engine"
)

type PromptRecursionDetector struct {
	MaxDepth int
}

func NewPromptRecursionDetector(max int) *PromptRecursionDetector {
	return &PromptRecursionDetector{MaxDepth: max}
}

func (d *PromptRecursionDetector) Name() string {
	return "Prompt Recursion"
}

func (d *PromptRecursionDetector) Evaluate(ctx *engine.AgentContext) *engine.RuleResult {
	// A simple heuristic: if the prompt keeps growing and containing the previous prompt entirely,
	// it might be recursively embedding context without pruning.
	depth := 0
	var lastPrompt string

	for _, span := range ctx.Spans {
		if span.Kind != "llm" || span.PromptText == "" {
			continue
		}

		if lastPrompt == "" {
			lastPrompt = span.PromptText
			depth = 1
		} else if len(span.PromptText) > len(lastPrompt) && strings.Contains(span.PromptText, lastPrompt) {
			depth++
			if depth >= d.MaxDepth {
				return &engine.RuleResult{
					RuleName:          d.Name(),
					Severity:          engine.SeverityHigh,
					Reason:            "Prompt context is recursively growing without being pruned.",
					RecommendedAction: "Implement conversation windowing or summarization in the agent's memory.",
					AutomaticAction:   engine.ActionAlert,
				}
			}
			lastPrompt = span.PromptText
		} else {
			lastPrompt = span.PromptText
			depth = 1
		}
	}

	return nil
}
