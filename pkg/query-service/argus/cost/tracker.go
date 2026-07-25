package cost

import (
	"context"
	"sync"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

// CostTracker calculates and maintains the real-time cost state
type CostTracker struct {
	mu            sync.RWMutex
	PricingTable  map[string]float64 // Model name -> cost per 1k tokens
	GlobalMetrics *CostMetrics
	costTotal     metric.Float64Counter
}

// NewCostTracker initializes the tracking engine with default model pricing
func NewCostTracker() *CostTracker {
	counter, _ := otel.Meter("argus.cost").Float64Counter(
		"argus.cost.total",
		metric.WithDescription("Total cost of LLM calls"),
		metric.WithUnit("USD"),
	)
	return &CostTracker{
		costTotal: counter,
		PricingTable: map[string]float64{
			"gpt-4":       0.03, // $0.03 per 1k tokens (blended input/output for simplicity)
			"gpt-3.5-turbo": 0.002,
			"claude-3-opus": 0.015,
		},
		GlobalMetrics: &CostMetrics{
			CostPerUser:  make(map[string]float64),
			CostPerTeam:  make(map[string]float64),
			CostPerAgent: make(map[string]float64),
			CostPerModel: make(map[string]float64),
			DailyBudget:  500.0,  // Default global daily budget
			MonthlyBudget: 10000.0, // Default global monthly budget
		},
	}
}

// GetPricing returns the pricing for a given model, with a sensible default.
func (t *CostTracker) GetPricing(model string) float64 {
	t.mu.RLock()
	defer t.mu.RUnlock()
	if rate, ok := t.PricingTable[model]; ok {
		return rate
	}
	return 0.01 // fallback generic rate
}

// SetPricing sets the pricing for a given model.
func (t *CostTracker) SetPricing(model string, rate float64) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.PricingTable[model] = rate
}

// CalculateCost computes the cost of a specific trace and updates global state.
// Cost is emitted as an OTel metric, making it visible in SigNoz Metrics Explorer
// and queryable via Query Builder.
func (t *CostTracker) CalculateCost(ctx *TraceCostContext) float64 {
	t.mu.Lock()
	defer t.mu.Unlock()

	rate, exists := t.PricingTable[ctx.Model]
	if !exists {
		rate = 0.01 // Fallback generic rate
	}

	totalTokens := float64(ctx.InputTokens + ctx.OutputTokens)
	cost := (totalTokens / 1000.0) * rate

	// Update live context
	ctx.TotalCost = cost

	// Update global aggregates
	t.GlobalMetrics.TotalCost += cost
	t.GlobalMetrics.CurrentDaily += cost
	t.GlobalMetrics.CurrentMonthly += cost
	
	if ctx.UserID != "" { t.GlobalMetrics.CostPerUser[ctx.UserID] += cost }
	if ctx.TeamID != "" { t.GlobalMetrics.CostPerTeam[ctx.TeamID] += cost }
	if ctx.AgentID != "" { t.GlobalMetrics.CostPerAgent[ctx.AgentID] += cost }
	if ctx.Model != "" { t.GlobalMetrics.CostPerModel[ctx.Model] += cost }

	// Emit OTel metric — appears in SigNoz Metrics Explorer & Query Builder
	// Note: uses context.Background() because CalculateCost is often called
	// without an external context. Callers that have a context should pass it.
	if t.costTotal != nil {
		t.costTotal.Add(context.Background(), cost, metric.WithAttributes(
			attribute.String("agent_id", ctx.AgentID),
			attribute.String("model", ctx.Model),
			attribute.String("user_id", ctx.UserID),
			attribute.String("team_id", ctx.TeamID),
			attribute.String("trace_id", ctx.TraceID),
		))
	}

	return cost
}

// GetMetrics returns a snapshot of current costs
func (t *CostTracker) GetMetrics() *CostMetrics {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.GlobalMetrics
}
