package appserver

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/mux"
	"github.com/SigNoz/signoz/pkg/query-service/argus"
	"github.com/SigNoz/signoz/pkg/query-service/argus/cost"
	"github.com/SigNoz/signoz/pkg/query-service/argus/dna"
	"github.com/SigNoz/signoz/pkg/query-service/argus/replay"
	"github.com/SigNoz/signoz/pkg/query-service/argus/state"
)

func NewServer(addr string) *http.Server {
	costFirewall := argus.NewCostFirewall(100.0)
	costTracker := cost.NewCostTracker()
	policyEngine := cost.NewPolicyEngine(slog.Default(), costTracker)

	traceStore := replay.NewMemoryTraceStore()
	llmClient := &replay.NoopLLMClient{}
	replayEngine := replay.NewReplayEngine(traceStore, llmClient)
	differ := replay.NewDiffer()

	dnaProfiler := dna.NewProfiler()
	dnaDetector := dna.NewAnomalyDetector()

	wsHub := state.GetHub()
	agentTracker := state.GetTracker(wsHub)
	agentHub := state.GetAgentHub()

	if os.Getenv("ARGUS_DEMO_MODE") != "" {
		agentTracker.UpsertAgent(&state.AgentState{
			AgentID: "sales-bot-01", Status: state.StatusRunning,
			CurrentCost: 0.05, CurrentTokens: 1200, LatencyMs: 150, LastTool: "search",
		})
		agentTracker.UpsertAgent(&state.AgentState{
			AgentID: "support-bot-x", Status: state.StatusBlocked,
			CurrentCost: 5.12, CurrentTokens: 8500, LatencyMs: 3400, LastTool: "database_query",
		})
		dnaDetector.SeedBaseline(&dna.HealthyBaseline{
			AgentID: "sales-bot", MeanLatencyMs: 1000.0, LatencyStdDev: 200.0,
			MeanCost: 0.02, CostStdDev: 0.005, MeanTokens: 500.0, TokensStdDev: 50.0,
			ExpectedTools: map[string]bool{"search": true, "calculator": true},
		})
	}

	r := mux.NewRouter()
	api := r.PathPrefix("/api/v1").Subrouter()

	api.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	}).Methods("GET")

	api.HandleFunc("/argus/cost_firewall", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"budget": costFirewall.BudgetLimit, "burn": costFirewall.CurrentBurn, "status": "active",
		})
	}).Methods("GET")

	api.HandleFunc("/argus/cost/metrics", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(costTracker.GetMetrics())
	}).Methods("GET")

	api.HandleFunc("/argus/cost/policies", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(policyEngine.GetPolicies())
	}).Methods("GET")

	api.HandleFunc("/argus/cost/policies", func(w http.ResponseWriter, r *http.Request) {
		var pol cost.CostPolicy
		if err := json.NewDecoder(r.Body).Decode(&pol); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		policyEngine.AddPolicy(r.Context(), pol)
		w.WriteHeader(http.StatusCreated)
	}).Methods("POST")

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

	api.HandleFunc("/argus/agent_dna", func(w http.ResponseWriter, r *http.Request) {
		fp := dnaProfiler.GenerateFingerprint("trace-xyz", "sales-bot",
			[]string{"search", "unapproved_tool"}, []string{"gpt-4"}, 2500, 1500, 0.09)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"fingerprint": fp, "report": dnaDetector.Evaluate(fp),
		})
	}).Methods("GET")

	api.HandleFunc("/argus/ws", func(w http.ResponseWriter, r *http.Request) {
		state.ServeWs(w, r)
	})

	api.HandleFunc("/argus/agent-ws", func(w http.ResponseWriter, r *http.Request) {
		state.ServeAgentWs(w, r)
	})

	api.HandleFunc("/argus/agents", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(agentTracker.GetAllAgents())
	}).Methods("GET")

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
			w.WriteHeader(http.StatusOK)
		}).Methods("POST")
	}

	return &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
}
