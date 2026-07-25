// Package alerting integrates ARGUS governance violations with SigNoz AlertManager.
// When the governance engine detects a violation (infinite loop, budget exceeded, etc.),
// this package creates real SigNoz alerts via alertmanager.PutAlerts() so they appear
// in the SigNoz UI, trigger notification channels, and can be investigated.
package alerting

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/SigNoz/signoz/pkg/alertmanager"
	"github.com/SigNoz/signoz/pkg/query-service/argus/engine"
	"github.com/SigNoz/signoz/pkg/types/alertmanagertypes"
	"github.com/go-openapi/strfmt"
	"github.com/prometheus/alertmanager/api/v2/models"
)

// ViolationAlertManager routes ARGUS governance violations through real SigNoz AlertManager.
// This replaces the old approach of only emitting OTel span events — now violations
// create real AlertManager alerts that can page Slack, PagerDuty, email, etc.
type ViolationAlertManager struct {
	logger       *slog.Logger
	alertmanager alertmanager.Alertmanager
	orgID        string
	source       string // e.g., "argus-governance"
}

// NewViolationAlertManager creates an alert manager that pushes violations to SigNoz AlertManager.
// Pass the real SigNoz alertmanager.Alertmanager instance and organization ID.
func NewViolationAlertManager(
	logger *slog.Logger,
	am alertmanager.Alertmanager,
	orgID string,
) *ViolationAlertManager {
	return &ViolationAlertManager{
		logger:       logger,
		alertmanager: am,
		orgID:        orgID,
		source:       "argus-governance",
	}
}

// HandleViolation converts an ARGUS governance violation into a real SigNoz AlertManager alert
// and pushes it via PutAlerts(). This makes the violation visible in the SigNoz UI,
// triggers notification channels (Slack, PagerDuty, etc.), and enables investigation.
func (v *ViolationAlertManager) HandleViolation(ctx context.Context, agentCtx *engine.AgentContext, violation engine.RuleResult) {
	severity := mapSeverity(violation.Severity, violation.AutomaticAction)
	now := time.Now()

	// Build the PostableAlert using the real SigNoz AlertManager v2 API types.
	// PostableAlert has: Alert (models.Alert), Annotations, StartsAt, EndsAt
	alert := &alertmanagertypes.PostableAlert{
		Annotations: models.LabelSet{
			"summary":     fmt.Sprintf("ARGUS: %s — %s", violation.RuleName, violation.Reason),
			"description": fmt.Sprintf("Rule: %s\nReason: %s\nRecommended: %s\nAction: %s\nTrace: %s\nProject: %s", violation.RuleName, violation.Reason, violation.RecommendedAction, string(violation.AutomaticAction), agentCtx.TraceID, agentCtx.ProjectName),
			"runbook":     "https://github.com/SigNoz/signoz/docs/argus/runbook.md",
		},
		StartsAt: strfmt.DateTime(now),
		EndsAt:   strfmt.DateTime(now.Add(1 * time.Hour)),
		Alert: models.Alert{
			Labels: models.LabelSet{
				"alertname":      fmt.Sprintf("ARGUS-%s", violation.RuleName),
				"severity":       severity,
				"argus_rule":     violation.RuleName,
				"argus_severity": string(violation.Severity),
				"argus_action":   string(violation.AutomaticAction),
				"argus_trace_id": agentCtx.TraceID,
				"argus_project":  agentCtx.ProjectName,
				"argus_source":   v.source,
				"alert_type":     "argus_governance",
			},
			GeneratorURL: strfmt.URI(fmt.Sprintf("argus://governance/%s/%s", violation.RuleName, agentCtx.TraceID)),
		},
	}

	postableAlerts := alertmanagertypes.PostableAlerts{alert}

	if err := v.alertmanager.PutAlerts(ctx, v.orgID, postableAlerts); err != nil {
		v.logger.ErrorContext(ctx, "argus alertmanager: failed to push violation alert",
			slog.String("rule", violation.RuleName),
			slog.String("error", err.Error()),
		)
		return
	}

	v.logger.InfoContext(ctx, "argus alertmanager: pushed violation alert to SigNoz AlertManager",
		slog.String("rule", violation.RuleName),
		slog.String("severity", severity),
		slog.String("trace_id", agentCtx.TraceID),
	)
}

// GetChannels returns all configured SigNoz notification channels that ARGUS can route to.
func (v *ViolationAlertManager) GetChannels(ctx context.Context) ([]*alertmanagertypes.Channel, error) {
	return v.alertmanager.ListChannels(ctx, v.orgID)
}

// CreateChannel creates a new notification channel in SigNoz for ARGUS alert routing.
func (v *ViolationAlertManager) CreateChannel(ctx context.Context, name string, receiver *alertmanagertypes.Receiver) (*alertmanagertypes.Channel, error) {
	return v.alertmanager.CreateChannel(ctx, v.orgID, receiver)
}

// NewRecoveryHook returns a SelfHealingFn that routes governance violations through
// both the recovery engine and SigNoz AlertManager.
func NewRecoveryHook(
	logger *slog.Logger,
	am alertmanager.Alertmanager,
	orgID string,
	recoveryEngine *SelfHealingEngine,
) engine.SelfHealingFn {
	violationAM := NewViolationAlertManager(logger, am, orgID)

	return func(ctx context.Context, agentCtx *engine.AgentContext, violation engine.RuleResult) {
		// 1. Push to SigNoz AlertManager for real notification routing
		violationAM.HandleViolation(ctx, agentCtx, violation)

		// 2. Execute recovery action
		if recoveryEngine != nil {
			recoveryEngine.ExecuteRecovery(ctx, agentCtx, violation)
		}
	}
}

// SelfHealingEngine wraps the recovery engine for the hook.
// This prevents circular imports between alerting and recovery packages.
type SelfHealingEngine struct {
	inner *recoveryEngineWrapper
}

type recoveryEngineWrapper struct {
	actions map[engine.AutomaticAction]RecoveryAction
	logger  *slog.Logger
}

// RecoveryAction mirrors the interface from the recovery package to avoid import cycles.
type RecoveryAction interface {
	Name() string
	ActionType() engine.AutomaticAction
	Execute(ctx context.Context, agentCtx *engine.AgentContext, violation engine.RuleResult) *RecoveryResult
}

// RecoveryResult mirrors the struct from the recovery package.
type RecoveryResult struct {
	Success bool
	Message string
}

// NewSelfHealingEngine creates a wrapped SelfHealingEngine.
func NewSelfHealingEngine(logger *slog.Logger) *SelfHealingEngine {
	return &SelfHealingEngine{
		inner: &recoveryEngineWrapper{
			actions: make(map[engine.AutomaticAction]RecoveryAction),
			logger:  logger,
		},
	}
}

// RegisterAction registers a recovery action.
func (s *SelfHealingEngine) RegisterAction(action RecoveryAction) {
	s.inner.actions[action.ActionType()] = action
	s.inner.logger.InfoContext(context.Background(), "argus alerting: registered recovery action",
		slog.String("action", action.Name()),
		slog.String("type", string(action.ActionType())),
	)
}

// ExecuteRecovery runs the mapped recovery strategy.
func (s *SelfHealingEngine) ExecuteRecovery(ctx context.Context, agentCtx *engine.AgentContext, violation engine.RuleResult) *RecoveryResult {
	action, exists := s.inner.actions[violation.AutomaticAction]
	if !exists {
		s.inner.logger.WarnContext(ctx, "argus alerting: no recovery action registered",
			slog.String("action_type", string(violation.AutomaticAction)),
		)
		return &RecoveryResult{Success: false, Message: "no action registered"}
	}

	s.inner.logger.InfoContext(ctx, "argus alerting: executing recovery",
		slog.String("action", action.Name()),
		slog.String("trace_id", agentCtx.TraceID),
	)
	return action.Execute(ctx, agentCtx, violation)
}

// mapSeverity maps ARGUS severity to SigNoz-compatible alert severity.
func mapSeverity(s engine.Severity, action engine.AutomaticAction) string {
	switch {
	case s == engine.SeverityCritical || action == engine.ActionKillRun || action == engine.ActionCircuitBreaker:
		return "critical"
	case s == engine.SeverityHigh:
		return "warning"
	default:
		return "info"
	}
}
