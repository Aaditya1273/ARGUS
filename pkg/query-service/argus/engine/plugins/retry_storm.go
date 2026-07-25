package plugins

import (
	"fmt"

	"github.com/SigNoz/signoz/pkg/query-service/argus/engine"
)

type RetryStormDetector struct {
	MaxRetries int
}

func NewRetryStormDetector(max int) *RetryStormDetector {
	return &RetryStormDetector{MaxRetries: max}
}

func (d *RetryStormDetector) Name() string {
	return "Retry Storm"
}

func (d *RetryStormDetector) Evaluate(ctx *engine.AgentContext) *engine.RuleResult {
	if len(ctx.Spans) < d.MaxRetries {
		return nil
	}

	retries := 0
	var lastFailedTool string

	for i := len(ctx.Spans) - 1; i >= 0; i-- {
		span := ctx.Spans[i]
		if span.Kind != "tool" {
			continue // Skip non-tool spans for retry detection
		}

		if span.Status == "error" {
			if lastFailedTool == "" {
				lastFailedTool = span.Name
				retries = 1
			} else if span.Name == lastFailedTool {
				retries++
				if retries >= d.MaxRetries {
					return &engine.RuleResult{
						RuleName:          d.Name(),
						Severity:          engine.SeverityHigh,
						Reason:            fmt.Sprintf("Agent retried failing tool '%s' %d times.", lastFailedTool, retries),
						RecommendedAction: "Implement exponential backoff or abort the agent task earlier on critical tool failures.",
						AutomaticAction:   engine.ActionKillRun,
					}
				}
			} else {
				break
			}
		} else if span.Name == lastFailedTool && span.Status == "ok" {
			break // The retry eventually succeeded, storm abated
		}
	}

	return nil
}
