package engine

import "time"

// Severity indicates how critical the rule violation is
type Severity string

const (
	SeverityLow      Severity = "LOW"
	SeverityMedium   Severity = "MEDIUM"
	SeverityHigh     Severity = "HIGH"
	SeverityCritical Severity = "CRITICAL"
)

// AutomaticAction defines the system response to a violation
type AutomaticAction string

const (
	ActionNone            AutomaticAction = "NONE"
	ActionAlert           AutomaticAction = "ALERT"
	ActionKillRun         AutomaticAction = "KILL_RUN"
	ActionTriggerFallback AutomaticAction = "TRIGGER_FALLBACK"
	ActionRetry           AutomaticAction = "RETRY"
	ActionReduceContext   AutomaticAction = "REDUCE_CONTEXT"
	ActionSwitchPrompt    AutomaticAction = "SWITCH_PROMPT"
	ActionDisableTool     AutomaticAction = "DISABLE_TOOL"
	ActionCircuitBreaker  AutomaticAction = "CIRCUIT_BREAKER"
	ActionEscalateHuman   AutomaticAction = "ESCALATE_HUMAN"
)

// RuleResult is the payload emitted by a detector when a violation is found
type RuleResult struct {
	RuleName          string
	Severity          Severity
	Reason            string
	RecommendedAction string
	AutomaticAction   AutomaticAction
}

// TraceSpan models an individual span in an agent run (e.g., tool call, llm call)
type TraceSpan struct {
	SpanID       string
	Name         string
	Kind         string // "llm", "tool", "chain"
	Duration     time.Duration
	InputTokens  int
	OutputTokens int
	PromptText   string
	Status       string // "ok", "error", "timeout"
}

// AgentContext holds the real-time execution state of the agent trace
type AgentContext struct {
	TraceID     string
	ProjectName string
	BudgetLimit float64
	CurrentCost float64
	Spans       []TraceSpan
}

// DetectorPlugin is the interface every modular rule must implement
type DetectorPlugin interface {
	Name() string
	Evaluate(ctx *AgentContext) *RuleResult
}
