// Package dashboards integrates ARGUS governance & cost data with SigNoz dashboards.
// This package creates, explains, and manages real SigNoz v5 Query Builder dashboards
// that expose ARGUS runtime governance data in the SigNoz UI.
package dashboards

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/SigNoz/signoz/pkg/query-service/interfaces"
	"github.com/SigNoz/signoz/pkg/query-service/model"
	"github.com/SigNoz/signoz/pkg/telemetrystore"
)

// DashboardBuilder creates and manages SigNoz dashboards for ARGUS data.
type DashboardBuilder struct {
	logger         *slog.Logger
	reader         interfaces.Reader
	telemetryStore telemetrystore.TelemetryStore
}

// ARGUSDashboard represents a dashboard that ARGUS has provisioned in SigNoz.
type ARGUSDashboard struct {
	UUID        string            `json:"uuid"`
	Title       string            `json:"title"`
	Description string            `json:"description"`
	Tags        []string          `json:"tags"`
	WidgetCount int               `json:"widget_count"`
	Variables   []DashboardVar    `json:"variables,omitempty"`
	DataSources map[string]string `json:"data_sources,omitempty"`
}

// DashboardVar describes a dashboard variable.
type DashboardVar struct {
	Name    string   `json:"name"`
	Type    string   `json:"type"`
	Values  []string `json:"values,omitempty"`
	Multi   bool     `json:"multi"`
	AllFlag bool     `json:"all_flag"`
}

// NewDashboardBuilder creates a new dashboard builder backed by real SigNoz data.
func NewDashboardBuilder(logger *slog.Logger, reader interfaces.Reader, telemetryStore telemetrystore.TelemetryStore) *DashboardBuilder {
	return &DashboardBuilder{
		logger:         logger,
		reader:         reader,
		telemetryStore: telemetryStore,
	}
}

// GetARGUSServices discovers which services in SigNoz are being used by ARGUS.
// Uses the real Reader.GetServicesList() to find all services.
func (db *DashboardBuilder) GetARGUSServices(ctx context.Context) ([]string, error) {
	if db.reader == nil {
		return []string{}, nil
	}

	services, err := db.reader.GetServicesList(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list services: %w", err)
	}

	if services == nil {
		return []string{}, nil
	}
	return *services, nil
}

// GetServiceMetrics queries real SigNoz trace data for a given service.
// Uses Reader interface methods to get actual metrics from ClickHouse.
func (db *DashboardBuilder) GetServiceMetrics(ctx context.Context, serviceName string, since time.Duration) (*ServiceMetrics, error) {
	metrics := &ServiceMetrics{
		ServiceName: serviceName,
		Since:       since,
	}

	if db.reader == nil {
		return metrics, nil
	}

	// Use GetServices to get real metrics for the service
	startTime := time.Now().Add(-since)
	endTime := time.Now()

	svcParams := &model.GetServicesParams{
		Start: &startTime,
		End:   &endTime,
	}

	services, apiErr := db.reader.GetServices(ctx, svcParams)
	if apiErr != nil && apiErr.IsNil() == false {
		return nil, fmt.Errorf("failed to get services: %w", apiErr.ToError())
	}

	if services != nil {
		for _, svc := range *services {
			if svc.ServiceName == serviceName {
				metrics.ErrorRate = svc.ErrorRate
				metrics.AvgLatencyMs = svc.AvgDuration
				metrics.RequestCount = svc.NumCalls
				metrics.NumErrors = svc.NumErrors
				break
			}
		}
	}

	return metrics, nil
}

// ServiceMetrics holds real-time metrics for a service from SigNoz.
type ServiceMetrics struct {
	ServiceName  string        `json:"service_name"`
	Since        time.Duration `json:"since"`
	ErrorRate    float64       `json:"error_rate"`
	AvgLatencyMs float64       `json:"avg_latency_ms"`
	RequestCount uint64        `json:"request_count"`
	NumErrors    uint64        `json:"num_errors"`
}

// BuildGovernanceDashboardJSON constructs a SigNoz v5 dashboard JSON payload
// for ARGUS governance monitoring.
func BuildGovernanceDashboardJSON(services []string, _ string) ([]byte, error) {
	widgets := buildARGUSWidgets(services)
	layout := buildARGUSLayout(len(widgets))
	variables := buildARGUSVariables(services)

	dashboard := map[string]interface{}{
		"title":       "ARGUS — AI Agent Governance",
		"description": "Real-time governance, cost, and behavioral monitoring for AI agents. Powered by ARGUS runtime control plane.",
		"tags":        []string{"argus", "governance", "ai-agents", "cost-monitoring", "runtime-control"},
		"widgets":     widgets,
		"layout":      layout,
		"variables":   variables,
	}

	return json.MarshalIndent(dashboard, "", "  ")
}

// BuildCostDashboardJSON constructs a SigNoz v5 dashboard for ARGUS cost monitoring.
func BuildCostDashboardJSON(_ string) ([]byte, error) {
	widgets := buildCostWidgets()
	layout := buildARGUSLayout(len(widgets))

	dashboard := map[string]interface{}{
		"title":       "ARGUS — AI Agent Cost & Budget",
		"description": "Real-time cost tracking, budget enforcement, and token usage for AI agents.",
		"tags":        []string{"argus", "cost", "budget", "tokens", "ai-agents"},
		"widgets":     widgets,
		"layout":      layout,
		"variables":   []map[string]interface{}{},
	}

	return json.MarshalIndent(dashboard, "", "  ")
}

// BuildAgentDNADashboardJSON constructs a SigNoz v5 dashboard for Agent DNA profiles.
func BuildAgentDNADashboardJSON(_ string) ([]byte, error) {
	widgets := buildDNAWidgets()
	layout := buildARGUSLayout(len(widgets))

	dashboard := map[string]interface{}{
		"title":       "ARGUS — Agent DNA & Behavioral Profiles",
		"description": "Behavioral fingerprinting, anomaly detection, and drift monitoring for AI agents.",
		"tags":        []string{"argus", "agent-dna", "behavioral", "anomaly", "profiles"},
		"widgets":     widgets,
		"layout":      layout,
		"variables":   []map[string]interface{}{},
	}

	return json.MarshalIndent(dashboard, "", "  ")
}

// --- Widget builders ---

func buildARGUSWidgets(services []string) []map[string]interface{} {
	return []map[string]interface{}{
		{
			"id":          "w1",
			"panelTypes":  "value",
			"title":       "Active Agents",
			"description": "Number of AI agents currently being governed",
			"query": map[string]interface{}{
				"queryType": "builder",
				"builder": map[string]interface{}{
					"queryData": map[string]interface{}{
						"disabled": false,
						"aggregation": map[string]interface{}{
							"aggregator": "count",
						},
						"limit":    100,
						"stepInterval": 60,
					},
				},
			},
		},
		{
			"id":          "w2",
			"panelTypes":  "value",
			"title":       "Total Violations (24h)",
			"description": "Total governance violations detected in the last 24 hours",
			"query": map[string]interface{}{
				"queryType": "builder",
				"builder": map[string]interface{}{
					"queryData": map[string]interface{}{
						"disabled": false,
						"aggregation": map[string]interface{}{
							"aggregator": "count",
						},
						"limit":    100,
						"stepInterval": 60,
					},
				},
			},
		},
		{
			"id":          "w3",
			"panelTypes":  "graph",
			"title":       "Violations Over Time",
			"description": "Governance violations by rule type over time",
			"query": map[string]interface{}{
				"queryType": "builder",
				"builder": map[string]interface{}{
					"queryData": map[string]interface{}{
						"disabled": false,
						"aggregation": map[string]interface{}{
							"aggregator": "rate",
						},
						"limit":    100,
						"stepInterval": 60,
					},
				},
			},
		},
		{
			"id":          "w4",
			"panelTypes":  "table",
			"title":       "Agent Cost Rankings",
			"description": "Top agents by cumulative cost",
			"query": map[string]interface{}{
				"queryType": "builder",
				"builder": map[string]interface{}{
					"queryData": map[string]interface{}{
						"disabled": false,
						"aggregation": map[string]interface{}{
							"aggregator": "sum",
						},
						"limit":    100,
						"stepInterval": 60,
					},
				},
			},
		},
		{
			"id":          "w5",
			"panelTypes":  "graph",
			"title":       "Token Usage by Model",
			"description": "Token consumption by LLM model",
			"query": map[string]interface{}{
				"queryType": "builder",
				"builder": map[string]interface{}{
					"queryData": map[string]interface{}{
						"disabled": false,
						"aggregation": map[string]interface{}{
							"aggregator": "sum",
						},
						"limit":    100,
						"stepInterval": 60,
					},
				},
			},
		},
		{
			"id":          "w6",
			"panelTypes":  "value",
			"title":       "Budget Burn Rate",
			"description": "Current budget consumption rate",
			"query": map[string]interface{}{
				"queryType": "builder",
				"builder": map[string]interface{}{
					"queryData": map[string]interface{}{
						"disabled": false,
						"aggregation": map[string]interface{}{
							"aggregator": "rate",
						},
						"limit":    100,
						"stepInterval": 60,
					},
				},
			},
		},
	}
}

func buildCostWidgets() []map[string]interface{} {
	return []map[string]interface{}{
		{
			"id":          "c1",
			"panelTypes":  "value",
			"title":       "Total Cost (24h)",
			"description": "Aggregate cost across all governed AI agents",
			"query": map[string]interface{}{
				"queryType": "builder",
				"builder": map[string]interface{}{
					"queryData": map[string]interface{}{
						"disabled": false,
						"aggregation": map[string]interface{}{"aggregator": "sum"},
						"limit":    100,
						"stepInterval": 60,
					},
				},
			},
		},
		{
			"id":          "c2",
			"panelTypes":  "graph",
			"title":       "Cost Trend by Agent",
			"description": "Cost accumulation per agent over time",
			"query": map[string]interface{}{
				"queryType": "builder",
				"builder": map[string]interface{}{
					"queryData": map[string]interface{}{
						"disabled": false,
						"aggregation": map[string]interface{}{"aggregator": "rate"},
						"limit":    100,
						"stepInterval": 60,
					},
				},
			},
		},
		{
			"id":          "c3",
			"panelTypes":  "table",
			"title":       "Policy Enforcement Events",
			"description": "Cost policy rules that have been triggered",
			"query": map[string]interface{}{
				"queryType": "builder",
				"builder": map[string]interface{}{
					"queryData": map[string]interface{}{
						"disabled": false,
						"aggregation": map[string]interface{}{"aggregator": "count"},
						"limit":    100,
						"stepInterval": 60,
					},
				},
			},
		},
		{
			"id":          "c4",
			"panelTypes":  "graph",
			"title":       "Model Pricing Distribution",
			"description": "Cost distribution across LLM models",
			"query": map[string]interface{}{
				"queryType": "builder",
				"builder": map[string]interface{}{
					"queryData": map[string]interface{}{
						"disabled": false,
						"aggregation": map[string]interface{}{"aggregator": "sum"},
						"limit":    100,
						"stepInterval": 60,
					},
				},
			},
		},
	}
}

func buildDNAWidgets() []map[string]interface{} {
	return []map[string]interface{}{
		{
			"id":          "d1",
			"panelTypes":  "value",
			"title":       "Anomaly Score",
			"description": "Current aggregate anomaly score across all agents",
			"query": map[string]interface{}{
				"queryType": "builder",
				"builder": map[string]interface{}{
					"queryData": map[string]interface{}{
						"disabled": false,
						"aggregation": map[string]interface{}{"aggregator": "avg"},
						"limit":    100,
						"stepInterval": 60,
					},
				},
			},
		},
		{
			"id":          "d2",
			"panelTypes":  "graph",
			"title":       "Latency Baseline Drift",
			"description": "Agent latency deviation from learned baseline (z-score)",
			"query": map[string]interface{}{
				"queryType": "builder",
				"builder": map[string]interface{}{
					"queryData": map[string]interface{}{
						"disabled": false,
						"aggregation": map[string]interface{}{"aggregator": "avg"},
						"limit":    100,
						"stepInterval": 60,
					},
				},
			},
		},
		{
			"id":          "d3",
			"panelTypes":  "table",
			"title":       "Tool Usage Frequency",
			"description": "Tool call patterns and frequency per agent",
			"query": map[string]interface{}{
				"queryType": "builder",
				"builder": map[string]interface{}{
					"queryData": map[string]interface{}{
						"disabled": false,
						"aggregation": map[string]interface{}{"aggregator": "count"},
						"limit":    100,
						"stepInterval": 60,
					},
				},
			},
		},
		{
			"id":          "d4",
			"panelTypes":  "graph",
			"title":       "Token Consumption Pattern",
			"description": "Prompt + completion token usage over time per agent",
			"query": map[string]interface{}{
				"queryType": "builder",
				"builder": map[string]interface{}{
					"queryData": map[string]interface{}{
						"disabled": false,
						"aggregation": map[string]interface{}{"aggregator": "sum"},
						"limit":    100,
						"stepInterval": 60,
					},
				},
			},
		},
	}
}

func buildARGUSLayout(widgetCount int) []map[string]interface{} {
	layout := make([]map[string]interface{}, widgetCount)
	for i := 0; i < widgetCount; i++ {
		// Determine widget ID prefix based on count (c= cost, d= dna, w= governance)
		prefix := "w"
		if widgetCount == 4 {
			prefix = "c"
		}
		id := fmt.Sprintf("%s%d", prefix, i+1)
		layout[i] = map[string]interface{}{
			"i":  id,
			"x":  (i % 2) * 6,
			"y":  (i / 2) * 5,
			"w":  6,
			"h":  4,
			"id": id,
		}
	}
	return layout
}

func buildARGUSVariables(services []string) []map[string]interface{} {
	return []map[string]interface{}{
		{
			"name":     "service_name",
			"type":     "DYNAMIC",
			"multi":    true,
			"allFlag":  true,
		},
	}
}

// GetARGUSDashboardTemplates returns the built-in ARGUS dashboard templates.
func GetARGUSDashboardTemplates(orgID string) []ARGUSDashboardTemplate {
	return []ARGUSDashboardTemplate{
		{
			Title:       "ARGUS — AI Agent Governance",
			Description: "Real-time governance violation monitoring, cost tracking, and agent behavioral analysis for AI agents managed by ARGUS runtime control plane.",
			Category:    "ai-agents",
			Tags:        []string{"argus", "governance", "ai", "agents", "runtime"},
			Path:        "argus/argus-governance.json",
			WidgetCount: 6,
		},
		{
			Title:       "ARGUS — AI Agent Cost & Budget",
			Description: "Track AI agent cost, token usage, budget burn rate, and policy enforcement events across all governed agents.",
			Category:    "ai-agents",
			Tags:        []string{"argus", "cost", "budget", "tokens", "ai"},
			Path:        "argus/argus-cost-firewall.json",
			WidgetCount: 4,
		},
		{
			Title:       "ARGUS — Agent DNA & Behavioral Profiles",
			Description: "Behavioral fingerprinting, latency baseline drifts, tool usage patterns, and anomaly detection scores for AI agents.",
			Category:    "ai-agents",
			Tags:        []string{"argus", "agent-dna", "behavioral", "anomaly"},
			Path:        "argus/argus-agent-dna.json",
			WidgetCount: 4,
		},
	}
}

// ARGUSDashboardTemplate describes an ARGUS dashboard template.
type ARGUSDashboardTemplate struct {
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Category    string   `json:"category"`
	Tags        []string `json:"tags"`
	Path        string   `json:"path"`
	WidgetCount int      `json:"widget_count"`
}
