// Package alerts manages the mapping between ARGUS governance rules and real
// SigNoz alert rules. This enables ARGUS violations to appear as SigNoz alerts
// with proper notification routing, history tracking, and investigation support.
// Implements the signoz-creating-alerts and signoz-explaining-alerts skill patterns.
package alerts

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/SigNoz/signoz/pkg/alertmanager"
	"github.com/SigNoz/signoz/pkg/query-service/argus/engine"
	"github.com/SigNoz/signoz/pkg/types/alertmanagertypes"
)

// ARGUSRuleManager maps ARGUS governance rules to SigNoz alert rules.
// Each ARGUS rule (infinite loop, budget exceeded, etc.) maps to a SigNoz
// alert rule that can be viewed in the UI, trigger notifications, and be investigated.
type ARGUSRuleManager struct {
	logger       *slog.Logger
	alertmanager alertmanager.Alertmanager
	orgID        string
	rules        []RuleMapping
}

// RuleMapping describes how an ARGUS governance rule maps to a SigNoz alert.
type RuleMapping struct {
	// ARGUS rule name (e.g., "infinite-loop-detector", "budget-exceeded")
	ARGUSRule string `json:"argus_rule"`
	// SigNoz alert name (e.g., "ARGUS-InfiniteLoop", "ARGUS-BudgetExceeded")
	SigNozAlert string `json:"signoz_alert"`
	// Severity mapping
	DefaultSeverity string `json:"default_severity"`
	// Human-readable description
	Description string `json:"description"`
	// Suggested recovery action
	AutoAction engine.AutomaticAction `json:"auto_action"`
}

// NewARGUSRuleManager creates a new rule manager backed by real SigNoz AlertManager.
func NewARGUSRuleManager(
	logger *slog.Logger,
	am alertmanager.Alertmanager,
	orgID string,
) *ARGUSRuleManager {
	rm := &ARGUSRuleManager{
		logger:       logger,
		alertmanager: am,
		orgID:        orgID,
		rules:        DefaultRuleMappings(),
	}
	return rm
}

// DefaultRuleMappings returns the standard ARGUS rule to SigNoz alert mappings.
func DefaultRuleMappings() []RuleMapping {
	return []RuleMapping{
		{
			ARGUSRule:       "infinite-loop-detector",
			SigNozAlert:     "ARGUS-InfiniteLoop",
			DefaultSeverity: "critical",
			Description:     "AI agent detected in an infinite loop - executing same tool call pattern repeatedly without progress",
			AutoAction:      engine.ActionKillRun,
		},
		{
			ARGUSRule:       "budget-exceeded",
			SigNozAlert:     "ARGUS-BudgetExceeded",
			DefaultSeverity: "critical",
			Description:     "AI agent has exceeded allocated budget threshold - cost tracking triggered limit enforcement",
			AutoAction:      engine.ActionReduceContext,
		},
		{
			ARGUSRule:       "retry-storm",
			SigNozAlert:     "ARGUS-RetryStorm",
			DefaultSeverity: "warning",
			Description:     "AI agent entering retry storm - repeated failed attempts to same operation without backoff",
			AutoAction:      engine.ActionTriggerFallback,
		},
		{
			ARGUSRule:       "latency-spike",
			SigNozAlert:     "ARGUS-LatencySpike",
			DefaultSeverity: "warning",
			Description:     "AI agent latency spike detected - response time significantly above baseline",
			AutoAction:      engine.ActionSwitchPrompt,
		},
		{
			ARGUSRule:       "agent-stuck",
			SigNozAlert:     "ARGUS-AgentStuck",
			DefaultSeverity: "warning",
			Description:     "AI agent appears stuck - no progress or state change in expected time window",
			AutoAction:      engine.ActionKillRun,
		},
		{
			ARGUSRule:       "repeated-prompt",
			SigNozAlert:     "ARGUS-RepeatedPrompt",
			DefaultSeverity: "info",
			Description:     "AI agent sending identical prompts repeatedly - possible prompt caching inefficiency",
			AutoAction:      engine.ActionReduceContext,
		},
		{
			ARGUSRule:       "prompt-recursion",
			SigNozAlert:     "ARGUS-PromptRecursion",
			DefaultSeverity: "high",
			Description:     "AI agent in prompt recursion - output being fed back as input in escalating pattern",
			AutoAction:      engine.ActionSwitchPrompt,
		},
		{
			ARGUSRule:       "tool-timeout",
			SigNozAlert:     "ARGUS-ToolTimeout",
			DefaultSeverity: "warning",
			Description:     "AI agent tool call timed out - external dependency not responding within expected duration",
			AutoAction:      engine.ActionTriggerFallback,
		},
		{
			ARGUSRule:       "token-explosion",
			SigNozAlert:     "ARGUS-TokenExplosion",
			DefaultSeverity: "critical",
			Description:     "AI agent token consumption spike detected - context window growing rapidly",
			AutoAction:      engine.ActionReduceContext,
		},
	}
}

// GetRuleMapping returns the SigNoz alert mapping for a given ARGUS rule name.
func (rm *ARGUSRuleManager) GetRuleMapping(ruleName string) *RuleMapping {
	for _, r := range rm.rules {
		if r.ARGUSRule == ruleName {
			return &r
		}
	}
	return nil
}

// ListSigNozAlerts lists all current alerts from SigNoz AlertManager that are
// related to ARGUS governance (filtered by alert_type=argus_governance).
func (rm *ARGUSRuleManager) ListSigNozAlerts(ctx context.Context) ([]*alertmanagertypes.DeprecatedGettableAlert, error) {
	if rm.alertmanager == nil {
		return nil, fmt.Errorf("alertmanager not available")
	}

	alerts, err := rm.alertmanager.GetAlerts(ctx, rm.orgID, alertmanagertypes.GettableAlertsParams{})
	if err != nil {
		return nil, fmt.Errorf("failed to get alerts: %w", err)
	}

	// Filter for ARGUS-related alerts
	var argusAlerts []*alertmanagertypes.DeprecatedGettableAlert
	for _, alert := range alerts {
		if alert != nil && alert.Labels != nil {
			if alertType, ok := alert.Labels["alert_type"]; ok && alertType == "argus_governance" {
				argusAlerts = append(argusAlerts, alert)
			}
		}
	}

	return argusAlerts, nil
}

// ListNotificationChannels returns all configured notification channels.
func (rm *ARGUSRuleManager) ListNotificationChannels(ctx context.Context) ([]*alertmanagertypes.Channel, error) {
	if rm.alertmanager == nil {
		return nil, fmt.Errorf("alertmanager not available")
	}
	return rm.alertmanager.ListChannels(ctx, rm.orgID)
}

// CreateNotificationChannel creates a new notification channel for ARGUS alert routing.
func (rm *ARGUSRuleManager) CreateNotificationChannel(ctx context.Context, receiver *alertmanagertypes.Receiver) (*alertmanagertypes.Channel, error) {
	if rm.alertmanager == nil {
		return nil, fmt.Errorf("alertmanager not available")
	}
	return rm.alertmanager.CreateChannel(ctx, rm.orgID, receiver)
}

// ExplainAlert generates a human-readable explanation of an ARGUS governance violation.
// This implements the signoz-explaining-alerts skill pattern.
func (rm *ARGUSRuleManager) ExplainAlert(violation engine.RuleResult, agentCtx *engine.AgentContext) string {
	mapping := rm.GetRuleMapping(violation.RuleName)
	if mapping == nil {
		mapping = &RuleMapping{
			ARGUSRule:       violation.RuleName,
			SigNozAlert:     fmt.Sprintf("ARGUS-%s", violation.RuleName),
			DefaultSeverity: string(violation.Severity),
			Description:     violation.Reason,
		}
	}

	explanation := fmt.Sprintf(
		"🚨 ARGUS Alert: %s\n\n"+
			"**What fired**: %s\n"+
			"**Severity**: %s (auto-action: %s)\n"+
			"**Agent**: %s (trace: %s)\n"+
			"**Reason**: %s\n"+
			"**Recommended**: %s\n"+
			"**SigNoz Alert Rule**: %s",
		mapping.SigNozAlert,
		mapping.Description,
		mapping.DefaultSeverity,
		string(violation.AutomaticAction),
		agentCtx.ProjectName,
		agentCtx.TraceID,
		violation.Reason,
		violation.RecommendedAction,
		mapping.SigNozAlert,
	)

	return explanation
}

// AlertHistoryItem represents a single alert transition from real SigNoz data.
type AlertHistoryItem struct {
	RuleName       string `json:"rule_name"`
	State          string `json:"state"`
	Timestamp      int64  `json:"timestamp"`
	Fingerprint    string `json:"fingerprint,omitempty"`
	StateChanged   bool   `json:"state_changed"`
}
