package cost

import "time"

// CostMetrics represents aggregated costs across various dimensions
type CostMetrics struct {
	TotalCost      float64            `json:"total_cost"`
	CostPerUser    map[string]float64 `json:"cost_per_user"`
	CostPerTeam    map[string]float64 `json:"cost_per_team"`
	CostPerAgent   map[string]float64 `json:"cost_per_agent"`
	CostPerModel   map[string]float64 `json:"cost_per_model"`
	DailyBudget    float64            `json:"daily_budget"`
	MonthlyBudget  float64            `json:"monthly_budget"`
	CurrentDaily   float64            `json:"current_daily"`
	CurrentMonthly float64            `json:"current_monthly"`
}

// PolicyCondition represents a threshold or rule
type PolicyCondition struct {
	Dimension string  `json:"dimension"`
	Operator  string  `json:"operator"`
	Threshold float64 `json:"threshold"`
}

// CostPolicy represents a billing guardrail rule
type CostPolicy struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Condition PolicyCondition `json:"condition"`
	Action    string          `json:"action"`
	Enabled   bool            `json:"enabled"`
	CreatedAt time.Time       `json:"created_at"`
}

// TraceCostContext represents the live cost of an active trace
type TraceCostContext struct {
	TraceID      string  `json:"trace_id"`
	AgentID      string  `json:"agent_id"`
	UserID       string  `json:"user_id"`
	TeamID       string  `json:"team_id"`
	Model        string  `json:"model"`
	InputTokens  int     `json:"input_tokens"`
	OutputTokens int     `json:"output_tokens"`
	TotalCost    float64 `json:"total_cost"`
}
