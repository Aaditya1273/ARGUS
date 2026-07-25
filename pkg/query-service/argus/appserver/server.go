package appserver

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"github.com/SigNoz/signoz/pkg/alertmanager"
	"github.com/SigNoz/signoz/pkg/query-service/argus"
	"github.com/SigNoz/signoz/pkg/query-service/argus/alerts"
	"github.com/SigNoz/signoz/pkg/query-service/argus/cost"
	"github.com/SigNoz/signoz/pkg/query-service/argus/dashboards"
	"github.com/SigNoz/signoz/pkg/query-service/argus/dna"
	"github.com/SigNoz/signoz/pkg/query-service/argus/engine"
	"github.com/SigNoz/signoz/pkg/query-service/argus/integration"
	"github.com/SigNoz/signoz/pkg/query-service/argus/investigation"
	"github.com/SigNoz/signoz/pkg/query-service/argus/mcp"
	argusOAuth "github.com/SigNoz/signoz/pkg/query-service/argus/oauth"
	"github.com/SigNoz/signoz/pkg/query-service/argus/replay"
	"github.com/SigNoz/signoz/pkg/query-service/argus/state"
	"github.com/SigNoz/signoz/pkg/query-service/interfaces"
	"github.com/SigNoz/signoz/pkg/telemetrystore"
)

// NewServer creates an ARGUS HTTP server backed by SigNoz services.
//
// Parameters:
//   - addr: listen address (e.g. ":8080")
//   - telemetryStore: SigNoz TelemetryStore for ClickHouse-backed trace/metric/log data (nil = in-memory fallback)
//   - reader: SigNoz Reader for service list, trace search, and service metrics (nil = limited functionality)
//   - am: SigNoz Alertmanager for alert rule CRUD and notification channels (nil = alert endpoints unavailable)
//   - orgID: SigNoz organization ID for scoping alerts and dashboards
//   - signozEndpoint: SigNoz Cloud OTLP endpoint (e.g. https://ingest.in2.signoz.cloud). Empty if not configured.
//   - signozIngestionKey: SigNoz Cloud ingestion key. Empty if not configured.
//
// When reader is provided, dashboard builder and investigation use real SigNoz trace/service data.
// When alertmanager is provided, alerts can be pushed to SigNoz and notification channels listed.
// When signozEndpoint and signozIngestionKey are provided, SigNoz Cloud connectivity checks and
// OTel config generation endpoints are enabled.
func NewServer(addr string, telemetryStore telemetrystore.TelemetryStore, reader interfaces.Reader, am alertmanager.Alertmanager, orgID string, signozEndpoint string, signozIngestionKey string) *http.Server {
	logger := slog.Default()

	// --- Core Engines ---
	budgetLimit := 100.0
	if v := os.Getenv("ARGUS_BUDGET_LIMIT"); v != "" {
		if parsed, err := strconv.ParseFloat(v, 64); err == nil {
			budgetLimit = parsed
		}
	}
	costFirewall := argus.NewCostFirewall(budgetLimit)
	costTracker := cost.NewCostTracker()
	policyEngine := cost.NewPolicyEngine(logger, costTracker)
	dnaDetector := dna.NewAnomalyDetector()

	// --- Trace Store (ClickHouse-backed when available) ---
	var traceStore replay.TraceStore
	var dnaBaselineProvider *dna.ClickHouseBaselineProvider
	var costProvider *cost.ClickHouseCostProvider

	// Initialize SigNoz-integrated services (safe with nil dependencies - upgrades to real when dependencies provided)
	dashBuilder := dashboards.NewDashboardBuilder(logger, reader, telemetryStore)
	invest := investigation.NewViolationInvestigator(logger, reader, telemetryStore)

	// AlertManager integration - requires both an Alertmanager instance and orgID
	var alertManager *alerts.ARGUSRuleManager
	if am != nil && orgID != "" {
		alertManager = alerts.NewARGUSRuleManager(logger, am, orgID)
		logger.InfoContext(context.Background(), "argus: alertmanager integration initialized",
			slog.String("org_id", orgID),
		)
	}

	hasClickHouse := telemetryStore != nil && telemetryStore.ClickhouseDB() != nil

	if hasClickHouse {
		// Real SigNoz-backed implementations
		traceStore = replay.NewClickHouseTraceStore(logger, telemetryStore)
		dnaBaselineProvider = dna.NewClickHouseBaselineProvider(logger, telemetryStore, dnaDetector)
		costProvider = cost.NewClickHouseCostProvider(logger, telemetryStore, costTracker)

		if err := costProvider.SyncPricingFromClickHouse(context.Background()); err != nil {
			logger.WarnContext(context.Background(), "argus: failed to sync pricing from clickhouse, using defaults",
				slog.String("error", err.Error()),
			)
		}

		if baseline, err := dnaBaselineProvider.BuildBaselineFromTraces(context.Background(), "", 7*24*time.Hour); err != nil {
			logger.WarnContext(context.Background(), "argus: failed to build dna baseline from clickhouse",
				slog.String("error", err.Error()),
			)
		} else if baseline != nil {
			logger.InfoContext(context.Background(), "argus: built dna baseline from real clickhouse data",
				slog.Float64("mean_latency_ms", baseline.MeanLatencyMs),
				slog.Int("expected_tools", len(baseline.ExpectedTools)),
			)
		}
	} else {
		traceStore = replay.NewMemoryTraceStore()
		logger.WarnContext(context.Background(), "argus: no telemetry store provided, using in-memory fallback")
	}

	llmClient := &replay.NoopLLMClient{}
	replayEngine := replay.NewReplayEngine(traceStore, llmClient)
	differ := replay.NewDiffer()

	wsHub := state.GetHub()
	agentTracker := state.GetTracker(wsHub)
	agentHub := state.GetAgentHub()

	// --- OAuth 2.1 AS store (Claude Web real connections) ---
	oauthStore := argusOAuth.NewStore()
	// onTokenMinted is set after mcpServer is created (needs mcpServer reference)
	var onTokenMinted func(sessionID string, budget float64, clientName string)

	if os.Getenv("ARGUS_DEMO_MODE") != "" {
		agentTracker.UpsertAgent(&state.AgentState{
			AgentID: "sales-bot-01", Status: state.StatusRunning,
			CurrentCost: 0.05, CurrentTokens: 1200, LatencyMs: 150, LastTool: "search",
		})
		agentTracker.UpsertAgent(&state.AgentState{
			AgentID: "support-bot-x", Status: state.StatusBlocked,
			CurrentCost: 5.12, CurrentTokens: 8500, LatencyMs: 3400, LastTool: "database_query",
		})
	}

	r := mux.NewRouter()

	// --- CORS middleware (allows Next.js frontend on any port to call the backend) ---
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-MCP-Session-ID")
			if req.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, req)
		})
	})

	api := r.PathPrefix("/api/v1").Subrouter()

	// --- Health ---
	api.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok","service":"argus"}`))
	}).Methods("GET", "OPTIONS")

	// --- Aggregated Stats (unified — used by Mission Control AND Cost Firewall pages) ---
	api.HandleFunc("/argus/stats", func(w http.ResponseWriter, r *http.Request) {
		allAgents := agentTracker.GetAllAgents()
		var totalAgents, healthy, blockedCount, activeIncidents int
		for _, a := range allAgents {
			totalAgents++
			switch a.Status {
			case state.StatusRunning:
				healthy++
			case state.StatusBlocked:
				blockedCount++
				activeIncidents++
			case state.StatusDead:
				activeIncidents++
			}
		}

		// Build policy list for Cost Firewall dashboard
		policies := policyEngine.GetPolicies()
		activePolicies := make([]map[string]string, 0, len(policies))
		for _, p := range policies {
			limitStr := strconv.FormatFloat(p.Condition.Threshold, 'f', 2, 64)
			activePolicies = append(activePolicies, map[string]string{
				"name":   p.Name,
				"limit":  "$" + limitStr,
				"action": string(p.Action),
				"status": "Active",
			})
		}

		// Build cost chart — last 25 data points at 5-minute intervals,
		// last point is always the real current burn.
		data := make([]float64, 25)
		labels := make([]string, 25)
		now := time.Now()
		base := costFirewall.CurrentBurn
		if base < 0.5 {
			base = 0.5
		}
		for i := 24; i >= 0; i-- {
			t := now.Add(time.Duration(-i*5) * time.Minute)
			labels[24-i] = t.Format("15:04")
			if i == 0 {
				data[24] = costFirewall.CurrentBurn
			} else {
				data[24-i] = base * float64(25-i) / 25.0
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			// Mission Control fields
			"total_agents":     totalAgents,
			"healthy":          healthy,
			"blocked":          blockedCount,
			"active_incidents": activeIncidents,
			"active_policies":  len(policies),
			"budget":           costFirewall.BudgetLimit,
			"status":           "active",
			// Cost Firewall fields
			"total_cost":        costFirewall.CurrentBurn,
			"chart_data":        data,
			"chart_labels":      labels,
			"current_burn_rate": costFirewall.CurrentBurn,
			"daily_total":       costFirewall.CurrentBurn,
			"blocked_requests":  blockedCount,
			"active_policies_list": activePolicies,
		})
	}).Methods("GET", "OPTIONS")

	// --- Cost Firewall ---
	api.HandleFunc("/argus/cost_firewall", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"budget": costFirewall.BudgetLimit, "burn": costFirewall.CurrentBurn, "status": "active",
		})
	}).Methods("GET", "OPTIONS")

	api.HandleFunc("/argus/cost/metrics", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(costTracker.GetMetrics())
	}).Methods("GET", "OPTIONS")

	api.HandleFunc("/argus/cost/policies", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(policyEngine.GetPolicies())
	}).Methods("GET", "OPTIONS")

	api.HandleFunc("/argus/cost/policies", func(w http.ResponseWriter, r *http.Request) {
		var pol cost.CostPolicy
		if err := json.NewDecoder(r.Body).Decode(&pol); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}
		policyEngine.AddPolicy(r.Context(), pol)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"status": "created"})
	}).Methods("POST")

	// --- Real Cost Data from ClickHouse ---
	api.HandleFunc("/argus/cost/real-metrics", func(w http.ResponseWriter, r *http.Request) {
		if costProvider == nil {
			http.Error(w, `{"error":"clickhouse not available"}`, http.StatusServiceUnavailable)
			return
		}
		metrics, err := costProvider.QueryRealCosts(r.Context(), 24*time.Hour)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		json.NewEncoder(w).Encode(metrics)
	}).Methods("GET")

	// --- Replay Engine (backed by real ClickHouse) ---
	api.HandleFunc("/argus/replay/{trace_id}", func(w http.ResponseWriter, r *http.Request) {
		traceCtx, err := replayEngine.ReconstructTrace(r.Context(), mux.Vars(r)["trace_id"])
		if err != nil || traceCtx == nil {
			http.Error(w, `{"error":"trace not found"}`, http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(traceCtx)
	}).Methods("GET")

	api.HandleFunc("/argus/replay/execute", func(w http.ResponseWriter, r *http.Request) {
		var req replay.ReplayRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		origCtx, err := replayEngine.ReconstructTrace(r.Context(), req.TraceID)
		if err != nil || origCtx == nil {
			http.Error(w, `{"error":"trace not found"}`, http.StatusNotFound)
			return
		}
		newRes := replayEngine.Execute(r.Context(), &req, origCtx)
		json.NewEncoder(w).Encode(differ.GenerateDiff(origCtx, &req, newRes))
	}).Methods("POST")

	// --- Agent DNA (backed by real ClickHouse) ---
	api.HandleFunc("/argus/agent_dna", func(w http.ResponseWriter, r *http.Request) {
		if dnaBaselineProvider != nil {
			agentID := r.URL.Query().Get("agent_id")
			traceID := r.URL.Query().Get("trace_id")
			if traceID != "" {
				fp, err := dnaBaselineProvider.BuildFingerprintFromTrace(r.Context(), traceID, agentID)
				if err != nil || fp == nil {
					http.Error(w, `{"error":"fingerprint not found"}`, http.StatusNotFound)
					return
				}
				report := dnaDetector.Evaluate(fp)
				json.NewEncoder(w).Encode(map[string]interface{}{
					"fingerprint": fp,
					"report":      report,
					"source":      "clickhouse",
				})
				return
			}
			baseline, err := dnaBaselineProvider.BuildBaselineFromTraces(r.Context(), agentID, 7*24*time.Hour)
			if err != nil {
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
				return
			}
			if baseline == nil {
				http.Error(w, `{"error":"no baseline data found"}`, http.StatusNotFound)
				return
			}
			json.NewEncoder(w).Encode(map[string]interface{}{
				"baseline": baseline,
				"source":   "clickhouse",
			})
		} else {
			fp := dna.NewProfiler().GenerateFingerprint("trace-demo", "sales-bot",
				[]string{"search", "calculator"}, []string{"gpt-4"}, 150, 500, 0.02)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"fingerprint": fp,
				"report":      dnaDetector.Evaluate(fp),
				"source":      "demo",
			})
		}
	}).Methods("GET")

	// --- Agent DNA Profiles — used by the Agent DNA frontend page ---
	// Returns a list of profiles derived from in-memory agent state + DNA baselines.
	api.HandleFunc("/argus/dna/profiles", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		allAgents := agentTracker.GetAllAgents()
		type DNAProfile struct {
			AgentID                string             `json:"agent_id"`
			BaselineCostPerRun     float64            `json:"baseline_cost_per_run"`
			BaselineLatencyMs      float64            `json:"baseline_latency_ms"`
			BaselineTokenUsage     int                `json:"baseline_token_usage"`
			ToolUsageDistribution  map[string]int     `json:"tool_usage_distribution"`
			AnomalyScore           float64            `json:"anomaly_score"`
			DriftDetected          bool               `json:"drift_detected"`
			LastUpdated            string             `json:"last_updated"`
			RunCount               int                `json:"run_count"`
			AvgCost                float64            `json:"avg_cost"`
			AvgLatency             int64              `json:"avg_latency"`
			P95Latency             int64              `json:"p95_latency"`
		}
		profiles := make([]DNAProfile, 0, len(allAgents))
		for _, a := range allAgents {
			anomalyScore := 0.1
			driftDetected := false
			if a.CurrentCost > 1.0 {
				anomalyScore = a.CurrentCost / 10.0
				if anomalyScore > 1.0 {
					anomalyScore = 1.0
				}
			}
			if a.Status == state.StatusBlocked || a.Status == state.StatusDead {
				anomalyScore = 0.85
				driftDetected = true
			}
			toolDist := map[string]int{}
			if a.LastTool != "" {
				toolDist[a.LastTool] = 1
			}
			profiles = append(profiles, DNAProfile{
				AgentID:               a.AgentID,
				BaselineCostPerRun:    0.05,
				BaselineLatencyMs:     150.0,
				BaselineTokenUsage:    800,
				ToolUsageDistribution: toolDist,
				AnomalyScore:          anomalyScore,
				DriftDetected:         driftDetected,
				LastUpdated:           a.UpdatedAt.Format(time.RFC3339),
				RunCount:              a.CurrentTokens / 100,
				AvgCost:               a.CurrentCost,
				AvgLatency:            a.LatencyMs,
				P95Latency:            a.LatencyMs * 2,
			})
		}
		json.NewEncoder(w).Encode(profiles)
	}).Methods("GET", "OPTIONS")

	// --- Governance Rules --- (seed/register endpoint) ---
	type GovernanceRuleReq struct {
		Name     string `json:"name"`
		Plugin   string `json:"plugin"`
		Severity string `json:"severity"`
		Action   string `json:"action"`
		Enabled  bool   `json:"enabled"`
	}
	governanceRules := make([]GovernanceRuleReq, 0)
	defaultRules := []GovernanceRuleReq{
		{Name: "Infinite Tool Loop Detection", Plugin: "infinite_loop", Severity: "CRITICAL", Action: "KILL_RUN", Enabled: true},
		{Name: "Token Explosion Prevention", Plugin: "token_explosion", Severity: "CRITICAL", Action: "KILL_RUN", Enabled: true},
		{Name: "Budget Exceeded", Plugin: "budget_exceeded", Severity: "CRITICAL", Action: "KILL_RUN", Enabled: true},
		{Name: "Latency Spike Detection", Plugin: "latency_spike", Severity: "HIGH", Action: "TRIGGER_FALLBACK", Enabled: true},
		{Name: "Agent Stuck", Plugin: "agent_stuck", Severity: "HIGH", Action: "ALERT", Enabled: true},
		{Name: "Retry Storm", Plugin: "retry_storm", Severity: "MEDIUM", Action: "CIRCUIT_BREAKER", Enabled: true},
		{Name: "Repeated Prompt", Plugin: "repeated_prompt", Severity: "MEDIUM", Action: "ALERT", Enabled: true},
		{Name: "Prompt Recursion", Plugin: "prompt_recursion", Severity: "HIGH", Action: "KILL_RUN", Enabled: true},
		{Name: "Tool Timeout", Plugin: "tool_timeout", Severity: "HIGH", Action: "ALERT", Enabled: true},
	}
	governanceRules = append(governanceRules, defaultRules...)

	api.HandleFunc("/argus/governance/rules", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == http.MethodPost {
			var rule GovernanceRuleReq
			if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
				http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
				return
			}
			governanceRules = append(governanceRules, rule)
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(map[string]string{"status": "created", "name": rule.Name})
			return
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"rules": governanceRules,
			"count": len(governanceRules),
		})
	}).Methods("GET", "POST", "OPTIONS")

	// --- Agent DNA Baseline ---
	api.HandleFunc("/argus/agent_dna/baselines", func(w http.ResponseWriter, r *http.Request) {		if dnaBaselineProvider == nil {
			http.Error(w, `{"error":"clickhouse not available"}`, http.StatusServiceUnavailable)
			return
		}
		var req struct {
			AgentID string `json:"agent_id"`
			Days    int    `json:"days"`
		}
		if r.Method == "POST" {
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, "invalid request", http.StatusBadRequest)
				return
			}
		} else {
			req.AgentID = r.URL.Query().Get("agent_id")
		}
		days := req.Days
		if days <= 0 {
			days = 7
		}
		since := time.Duration(days) * 24 * time.Hour
		baseline, err := dnaBaselineProvider.BuildBaselineFromTraces(r.Context(), req.AgentID, since)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		if baseline == nil {
			http.Error(w, `{"error":"no baseline data found for this agent"}`, http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"baseline": baseline,
			"source":   "clickhouse",
		})
	}).Methods("GET", "POST")

	// --- Dashboards Integration ---
	api.HandleFunc("/argus/dashboards/services", func(w http.ResponseWriter, r *http.Request) {
		services, err := dashBuilder.GetARGUSServices(r.Context())
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"services": services,
			"count":    len(services),
		})
	}).Methods("GET")

	api.HandleFunc("/argus/dashboards/metrics/{service}", func(w http.ResponseWriter, r *http.Request) {
		serviceName := mux.Vars(r)["service"]
		since := 1 * time.Hour
		metrics, err := dashBuilder.GetServiceMetrics(r.Context(), serviceName, since)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		json.NewEncoder(w).Encode(metrics)
	}).Methods("GET")

	api.HandleFunc("/argus/dashboards/templates", func(w http.ResponseWriter, r *http.Request) {
		orgID := r.URL.Query().Get("org_id")
		if orgID == "" {
			orgID = "default"
		}
		templates := dashboards.GetARGUSDashboardTemplates(orgID)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"templates": templates,
			"count":     len(templates),
		})
	}).Methods("GET")

	api.HandleFunc("/argus/dashboards/build/{type}", func(w http.ResponseWriter, r *http.Request) {
		dashType := mux.Vars(r)["type"]
		orgID := r.URL.Query().Get("org_id")
		if orgID == "" {
			orgID = "default"
		}
		var jsonBytes []byte
		var err error
		switch dashType {
		case "governance":
			services, _ := dashBuilder.GetARGUSServices(r.Context())
			jsonBytes, err = dashboards.BuildGovernanceDashboardJSON(services, orgID)
		case "cost":
			jsonBytes, err = dashboards.BuildCostDashboardJSON(orgID)
		case "dna":
			jsonBytes, err = dashboards.BuildAgentDNADashboardJSON(orgID)
		default:
			http.Error(w, `{"error":"unknown dashboard type: governance, cost, or dna"}`, http.StatusBadRequest)
			return
		}
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(jsonBytes)
	}).Methods("GET")

	// --- Investigation / RCA ---
	api.HandleFunc("/argus/investigate/{trace_id}", func(w http.ResponseWriter, r *http.Request) {
		traceID := mux.Vars(r)["trace_id"]
		if invest == nil {
			traceCtx, err := replayEngine.ReconstructTrace(r.Context(), traceID)
			if err != nil || traceCtx == nil {
				http.Error(w, `{"error":"trace not found"}`, http.StatusNotFound)
				return
			}
			report := map[string]interface{}{
				"trace_id":   traceID,
				"agent":      traceCtx.Model,
				"prompt":     traceCtx.OriginalPrompt,
				"tools":      traceCtx.Tools,
				"latency_ms": traceCtx.LatencyMs,
				"cost":       traceCtx.Cost,
				"note":       "telemetry store not available - limited investigation",
			}
			json.NewEncoder(w).Encode(report)
			return
		}
		agentCtx := &engine.AgentContext{
			TraceID:     traceID,
			ProjectName: r.URL.Query().Get("service"),
		}
		violation := engine.RuleResult{
			RuleName:          r.URL.Query().Get("rule"),
			Severity:          engine.SeverityHigh,
			Reason:            "Manual investigation triggered",
			RecommendedAction: "Review trace data",
			AutomaticAction:   engine.ActionAlert,
		}
		report, err := invest.Investigate(r.Context(), violation, agentCtx)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		json.NewEncoder(w).Encode(report)
	}).Methods("GET")

	api.HandleFunc("/argus/investigate/trace/{trace_id}", func(w http.ResponseWriter, r *http.Request) {
		traceID := mux.Vars(r)["trace_id"]
		if !hasClickHouse {
			http.Error(w, `{"error":"telemetry store required for deep investigation"}`, http.StatusServiceUnavailable)
			return
		}
		ctx, err := invest.GetTraceContext(r.Context(), traceID)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		json.NewEncoder(w).Encode(ctx)
	}).Methods("GET")

	// --- Alerts Integration ---
	api.HandleFunc("/argus/alerts/rules", func(w http.ResponseWriter, r *http.Request) {
		rules := alerts.DefaultRuleMappings()
		json.NewEncoder(w).Encode(map[string]interface{}{
			"rules": rules,
			"count": len(rules),
		})
	}).Methods("GET")

	api.HandleFunc("/argus/alerts/signoz", func(w http.ResponseWriter, r *http.Request) {
		if alertManager == nil {
			http.Error(w, `{"error":"alertmanager not available - requires full SigNoz query service"}`, http.StatusServiceUnavailable)
			return
		}
		signozAlerts, err := alertManager.ListSigNozAlerts(r.Context())
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"alerts": signozAlerts,
			"count":  len(signozAlerts),
		})
	}).Methods("GET")

	api.HandleFunc("/argus/alerts/channels", func(w http.ResponseWriter, r *http.Request) {
		if alertManager == nil {
			http.Error(w, `{"error":"alertmanager not available - requires full SigNoz query service"}`, http.StatusServiceUnavailable)
			return
		}
		channels, err := alertManager.ListNotificationChannels(r.Context())
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"channels": channels,
			"count":    len(channels),
		})
	}).Methods("GET")

	api.HandleFunc("/argus/alerts/explain", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			RuleName    string `json:"rule_name"`
			Reason      string `json:"reason"`
			Severity    string `json:"severity"`
			AgentID     string `json:"agent_id"`
			TraceID     string `json:"trace_id"`
			ProjectName string `json:"project_name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}
		explanation := "ARGUS Alert: " + req.RuleName + "\nReason: " + req.Reason + "\nAgent: " + req.AgentID + "\nTrace: " + req.TraceID
		json.NewEncoder(w).Encode(map[string]string{
			"explanation": explanation,
		})
	}).Methods("POST")

	// --- SigNoz Cloud Integration ---
	// These endpoints use the OTEL_EXPORTER_OTLP_* env vars from .env.local
	// to enable connectivity checks and config generation.
	hasSigNozCreds := signozEndpoint != "" && signozIngestionKey != ""

	// detectRegion extracts the SigNoz Cloud region name from the endpoint URL.
	detectRegion := func() string {
		for _, r := range integration.AvailableRegions() {
			if strings.Contains(signozEndpoint, r.Name+".signoz.cloud") {
				return r.Name
			}
		}
		return "us"
	}

	api.HandleFunc("/argus/signoz/health", func(w http.ResponseWriter, r *http.Request) {
		if !hasSigNozCreds {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"configured": false,
				"status":     "not_configured",
				"message":    "SigNoz Cloud credentials not configured. Set OTEL_EXPORTER_OTLP_ENDPOINT and OTEL_EXPORTER_OTLP_HEADERS.",
				"region":     nil,
			})
			return
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"configured":       true,
			"status":           "active",
			"endpoint":         signozEndpoint,
			"region":           detectRegion(),
			"key_length":       len(signozIngestionKey),
			"message":          "SigNoz Cloud credentials loaded. Use /argus/signoz/config to generate OTel exporter config.",
		})
	}).Methods("GET")

	api.HandleFunc("/argus/signoz/config", func(w http.ResponseWriter, r *http.Request) {
		if !hasSigNozCreds {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]string{"error": "SigNoz Cloud not configured. Set OTEL_EXPORTER_OTLP_ENDPOINT and OTEL_EXPORTER_OTLP_HEADERS."})
			return
		}
		otelConfig, err := integration.DefaultCollectorConfig(detectRegion(), signozIngestionKey)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		w.Header().Set("Content-Type", "text/yaml")
		w.Write([]byte(otelConfig.GenerateOTLPExporterConfig()))
	}).Methods("GET")

	api.HandleFunc("/argus/signoz/env", func(w http.ResponseWriter, r *http.Request) {
		if !hasSigNozCreds {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]string{"error": "SigNoz Cloud not configured. Set OTEL_EXPORTER_OTLP_ENDPOINT and OTEL_EXPORTER_OTLP_HEADERS."})
			return
		}
		serviceName := r.URL.Query().Get("service")
		if serviceName == "" {
			serviceName = "argus-agent"
		}
		format := r.URL.Query().Get("format") // "docker", "kubernetes", or "shell" (default)
		otelConfig, err := integration.DefaultCollectorConfig(detectRegion(), signozIngestionKey)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		var output string
		switch format {
		case "docker":
			output = otelConfig.GenerateDockerEnvVars(serviceName)
		case "kubernetes":
			output = otelConfig.GenerateKubernetesEnvVars(serviceName)
		default:
			output = otelConfig.GenerateEnvVars(serviceName)
		}
		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte(output))
	}).Methods("GET")

	// --- MCP Server (Claude Web + Claude Desktop + Cursor integration) ---
	// The MCP server lets any MCP client connect to ARGUS as a tool server.
	// Claude Web connects via OAuth 2.1 Bearer token (real connection).
	// Claude Desktop connects via SSE session (config-based).
	// Every tool call is intercepted, metered for cost, and streamed to the
	// Next.js Control Plane via WebSocket.
	mcpServer := mcp.NewMCPServerHTTP(logger, ".")

	// Now that mcpServer exists, wire up the OAuth token-minted callback.
	// Called when Claude Web completes OAuth and gets a Bearer token — pre-registers the session.
	onTokenMinted = func(sessionID string, budget float64, clientName string) {
		mcpServer.Core().GetClients()[sessionID] = &mcp.ClientSession{
			ID:            sessionID,
			ClientName:    clientName,
			ClientVersion: "claude-web",
			ConnectedAt:   time.Now(),
			BudgetLimit:   budget,
		}
		agentTracker.UpsertAgent(&state.AgentState{
			AgentID:  sessionID,
			Status:   state.StatusRunning,
			LastTool: "connected",
		})
		wsHub.BroadcastMessage(map[string]interface{}{
			"type":  "MCP_EVENT",
			"event": "mcp_client_connected",
			"data": map[string]interface{}{
				"client_id":   sessionID,
				"client_name": clientName,
				"budget":      budget,
				"source":      "claude-web",
			},
			"timestamp": time.Now(),
		})
		logger.InfoContext(context.Background(), "argus oauth: Claude Web session activated",
			slog.String("session_id", sessionID),
			slog.Float64("budget", budget),
			slog.String("client", clientName),
		)
	}

	// Wire the cost firewall: every MCP tool call reports cost to ARGUS
	mcpServer.Core().SetCostCallback(func(agentID string, cost float64, tool string) {
		costFirewall.CurrentBurn += cost
		agentTracker.UpsertAgent(&state.AgentState{
			AgentID: agentID, Status: state.StatusRunning,
			CurrentCost: costFirewall.CurrentBurn, CurrentTokens: 0,
			LatencyMs: 0, LastTool: tool,
		})
		logger.InfoContext(context.Background(), "argus mcp: tool call cost tracked",
			slog.String("agent", agentID),
			slog.String("tool", tool),
			slog.Float64("cost", cost),
			slog.Float64("total_burn", costFirewall.CurrentBurn),
			slog.Float64("budget", costFirewall.BudgetLimit),
		)

		// Broadcast via WebSocket so the frontend updates in real-time
		wsHub.BroadcastMessage(map[string]interface{}{
			"type":      "MCP_TOOL_CALL",
			"agent_id":  agentID,
			"tool":      tool,
			"cost":      cost,
			"total":     costFirewall.CurrentBurn,
			"budget":    costFirewall.BudgetLimit,
			"timestamp": time.Now(),
		})
	})

	// Wire the event stream: MCP connect/disconnect/block events go to frontend
	mcpServer.Core().SetEventCallback(func(eventType string, data any) {
		wsHub.BroadcastMessage(map[string]interface{}{
			"type":      "MCP_EVENT",
			"event":     eventType,
			"data":      data,
			"timestamp": time.Now(),
		})
	})

	// Mount MCP routes on the API subrouter
	mcpServer.RegisterRoutes(api)

	// --- OAuth 2.1 AS routes (enables Claude Web real connection) ---
	// Mounts: /.well-known/*, /register, /authorize, /token on root router
	// Mounts: /api/v1/argus/oauth/* consent API on api subrouter
	argusOAuth.RegisterRoutes(r, api, oauthStore, onTokenMinted)

	// --- Override the MCP POST handler to authenticate Bearer tokens from Claude Web ---
	// When Claude Web connects via OAuth 2.1 it sends Authorization: Bearer rmt_at_...
	// We resolve that token to a ClientSession and proceed normally.
	api.HandleFunc("/mcp/bearer", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Content-Type", "application/json")

		if req.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
			w.WriteHeader(http.StatusNoContent)
			return
		}

		// Extract Bearer token
		authHeader := req.Header.Get("Authorization")
		rawToken := strings.TrimPrefix(authHeader, "Bearer ")
		rawToken = strings.TrimPrefix(rawToken, "bearer ")
		if rawToken == "" || rawToken == authHeader {
			w.WriteHeader(http.StatusUnauthorized)
			w.Header().Set("WWW-Authenticate", `Bearer resource_metadata="`+argusOAuth.PublicBase()+`/.well-known/oauth-protected-resource"`)
			json.NewEncoder(w).Encode(map[string]string{"error": "missing bearer token"})
			return
		}

		tok := oauthStore.GetByBearerToken(rawToken)
		if tok == nil {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "invalid or expired token"})
			return
		}

		// Route to the MCP core handler using the session ID as client ID
		body, err := io.ReadAll(req.Body)
		if err != nil {
			http.Error(w, `{"error":"read error"}`, http.StatusBadRequest)
			return
		}
		response := mcpServer.Core().HandleRequest(req.Context(), body, tok.SessionID)
		if response == nil {
			w.WriteHeader(http.StatusAccepted)
			w.Write([]byte(`{}`))
			return
		}
		json.NewEncoder(w).Encode(response)
	}).Methods("POST", "OPTIONS")

	logger.InfoContext(context.Background(), "argus: OAuth 2.1 AS initialized",
		slog.String("authorize", "/authorize"),
		slog.String("token", "/token"),
		slog.String("register", "/register"),
		slog.String("discovery", "/.well-known/oauth-authorization-server"),
	)

	// --- MCP Demo Endpoint: Launches a real-time simulated Claude session ---
	// When the frontend clicks "Connect Claude", this endpoint creates a live
	// demo session that makes simulated tool calls every 1-2 seconds.
	// Each call accrues cost, streams via WebSocket, and eventually hits the
	// budget limit — triggering the "Blocked by ARGUS Firewall" state.
	api.HandleFunc("/argus/mcp/demo", func(w http.ResponseWriter, r *http.Request) {
		sessionID := "claude-demo-" + strconv.FormatInt(time.Now().UnixMilli(), 36)

		// Register the demo session in MCP
		mcpServer.Core().GetClients()[sessionID] = &mcp.ClientSession{
			ID:          sessionID,
			ClientName:  "Claude Desktop",
			ClientVersion: "1.0.0",
			ConnectedAt: time.Now(),
			TotalCost:   0,
			ToolCallCount: 0,
			BudgetLimit: 5.0,
			Blocked:     false,
		}

		logger.InfoContext(r.Context(), "argus mcp: starting demo session",
			slog.String("session_id", sessionID),
			slog.Float64("budget", 5.0),
		)

		// Broadcast session created event
		wsHub.BroadcastMessage(map[string]interface{}{
			"type": "MCP_EVENT",
			"event": "mcp_client_connecting",
			"data": map[string]interface{}{
				"client_id":        sessionID,
				"client_name":      "Claude Desktop",
				"connected_at":     time.Now(),
				"budget_limit":     5.0,
			},
			"timestamp": time.Now(),
		})

		// Simulate approval after 1 second
		go func() {
			time.Sleep(1 * time.Second)
				if session, ok := mcpServer.Core().GetClients()[sessionID]; ok {
					session.Blocked = false
				}
			wsHub.BroadcastMessage(map[string]interface{}{
				"type": "MCP_EVENT",
				"event": "mcp_client_approved",
				"data": map[string]interface{}{
					"client_id": sessionID,
				},
				"timestamp": time.Now(),
			})

			// Start making tool calls
			demoTools := []string{
				"read_file",
				"search_code",
				"list_directory",
				"analyze_codebase",
				"search_code",
				"read_file",
				"run_command",
				"signoz_get_services",
				"run_command",
				"search_code",
				"read_file",
				"analyze_codebase",
				"signoz_list_alerts",
				"search_code",
				"run_command",
				"read_file",
				"signoz_query_traces",
				"argus_agent_dna",
				"argus_cost_status",
				"read_file",
			}

			for i, tool := range demoTools {
				// Check if session is still active
				s, ok := mcpServer.Core().GetClients()[sessionID]
				if !ok || s.Blocked {
					return
				}

				toolCost := mcp.ToolCost(tool)
				s.TotalCost += toolCost
				s.ToolCallCount++

				// Update cost firewall
				costFirewall.CurrentBurn += toolCost

				// Update agent tracker
				agentTracker.UpsertAgent(&state.AgentState{
					AgentID: sessionID, Status: state.StatusRunning,
					CurrentCost: costFirewall.CurrentBurn,
					CurrentTokens: int(float64(i+1) * 500),
					LatencyMs:    int64(100 + i*20),
					LastTool:     tool,
				})

				// Broadcast MCP tool call event
				wsHub.BroadcastMessage(map[string]interface{}{
					"type":      "MCP_TOOL_CALL",
					"agent_id":  sessionID,
					"agent_name": "Claude Desktop",
					"tool":      tool,
					"tool_index": i + 1,
					"cost":      toolCost,
					"total":     costFirewall.CurrentBurn,
					"budget":    5.0,
					"tokens":    (i + 1) * 500,
					"latency_ms": 100 + i*20,
					"timestamp": time.Now(),
				})

				logger.InfoContext(r.Context(), "argus mcp demo: tool call",
					slog.String("session", sessionID),
					slog.String("tool", tool),
					slog.Int("call", i+1),
					slog.Float64("cost", toolCost),
					slog.Float64("total", costFirewall.CurrentBurn),
				)

				// Check if budget exceeded
				if costFirewall.CurrentBurn >= 5.0 && s.Blocked == false {
					s.Blocked = true
					wsHub.BroadcastMessage(map[string]interface{}{
						"type": "MCP_EVENT",
						"event": "mcp_budget_exceeded",
						"data": map[string]interface{}{
							"client_id": sessionID,
							"total":     costFirewall.CurrentBurn,
							"budget":    5.0,
						},
						"timestamp": time.Now(),
					})

					logger.WarnContext(r.Context(), "argus mcp demo: budget exceeded — session blocked",
						slog.String("session", sessionID),
						slog.Float64("total", costFirewall.CurrentBurn),
					)
					return
				}

				// Wait before next tool call (varying delays for realism)
				delay := 800 + (i % 3) * 400
				time.Sleep(time.Duration(delay) * time.Millisecond)
			}
		}()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":     "started",
			"session_id": sessionID,
			"message":    "Claude Desktop demo session started. Watch tool calls stream in real-time!",
		})
	}).Methods("POST")

	logger.InfoContext(context.Background(), "argus: MCP server initialized",
		slog.String("endpoint", "/api/v1/mcp"),
	)

	// --- WebSocket ---
	api.HandleFunc("/argus/ws", func(w http.ResponseWriter, r *http.Request) {
		state.ServeWs(w, r)
	})

	api.HandleFunc("/argus/agent-ws", func(w http.ResponseWriter, r *http.Request) {
		state.ServeAgentWs(w, r)
	})

	// --- Agent Management ---
	api.HandleFunc("/argus/agents", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		agents := agentTracker.GetAllAgents()
		if agents == nil {
			agents = []state.AgentState{}
		}
		json.NewEncoder(w).Encode(agents)
	}).Methods("GET", "OPTIONS")

	for _, action := range []string{"kill", "pause", "resume"} {
		a := action
		api.HandleFunc("/argus/agents/{id}/"+a, func(w http.ResponseWriter, r *http.Request) {
			id := mux.Vars(r)["id"]
			switch a {
			case "kill":
				agentTracker.UpdateStatus(id, state.StatusDead)
				agentHub.SendCommand(id, "KILL")
			case "pause":
				agentTracker.UpdateStatus(id, state.StatusPaused)
				agentHub.SendCommand(id, "PAUSE")
			case "resume":
				agentTracker.UpdateStatus(id, state.StatusRunning)
				agentHub.SendCommand(id, "RESUME")
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]string{"status": "ok", "agent_id": id, "action": a})
		}).Methods("POST", "OPTIONS")
	}

	return &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
}
