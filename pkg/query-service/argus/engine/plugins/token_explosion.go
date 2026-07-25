package plugins

import (
	"fmt"
	"github.com/SigNoz/signoz/pkg/query-service/argus/engine"
)

type TokenExplosionDetector struct {
	MaxTotalTokens int
}

func NewTokenExplosionDetector(max int) *TokenExplosionDetector {
	return &TokenExplosionDetector{MaxTotalTokens: max}
}

func (d *TokenExplosionDetector) Name() string {
	return "Token Explosion"
}

func (d *TokenExplosionDetector) Evaluate(ctx *engine.AgentContext) *engine.RuleResult {
	totalTokens := 0
	for _, span := range ctx.Spans {
		if span.Kind == "llm" {
			totalTokens += span.InputTokens + span.OutputTokens
		}
	}

	if totalTokens > d.MaxTotalTokens {
		return &engine.RuleResult{
			RuleName:          d.Name(),
			Severity:          engine.SeverityCritical,
			Reason:            fmt.Sprintf("Agent consumed %d tokens, exceeding explosion threshold of %d.", totalTokens, d.MaxTotalTokens),
			RecommendedAction: "Optimize system prompt and limit retrieval chunk sizes.",
			AutomaticAction:   engine.ActionKillRun,
		}
	}

	return nil
}
