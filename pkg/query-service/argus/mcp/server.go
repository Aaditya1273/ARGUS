package mcp

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"os"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/mux"
)

// MCPTransport defines how the MCP server communicates.
type MCPTransport string

const (
	TransportHTTP  MCPTransport = "http"  // HTTP with SSE for Claude Desktop remote
	TransportStdio MCPTransport = "stdio" // stdio for local Claude CLI
)

// MCPServerHTTP wraps the core MCPServer with an HTTP transport layer.
// It serves:
//   - GET /mcp  -> SSE stream for Claude Desktop
//   - POST /mcp -> JSON-RPC messages over the SSE stream
//   - GET /mcp/sessions -> list active sessions
//   - POST /mcp/sessions/{id}/approve -> approve a connection
//   - POST /mcp/sessions/{id}/block -> block a connection
//   - POST /mcp/sessions/{id}/budget -> set budget for a session
type MCPServerHTTP struct {
	core          *MCPServer
	logger        *slog.Logger
	mu            sync.Mutex
	sseClients    map[string]chan string // SSE clientID -> message channel
	nextClientID  int
	authToken     string // optional bearer token for MCP auth
	approvalFn    func(clientID string) bool // approval callback
}

// NewMCPServerHTTP creates an MCP HTTP server that wraps the core protocol handler.
func NewMCPServerHTTP(logger *slog.Logger, projectRoot string) *MCPServerHTTP {
	return &MCPServerHTTP{
		core:       NewMCPServer(logger, projectRoot),
		logger:     logger,
		sseClients: make(map[string]chan string),
	}
}

// SetAuthToken sets a bearer token required for MCP connections.
func (s *MCPServerHTTP) SetAuthToken(token string) {
	s.authToken = token
}

// SetApprovalFn sets a function that determines if an MCP client is approved to connect.
func (s *MCPServerHTTP) SetApprovalFn(fn func(clientID string) bool) {
	s.approvalFn = fn
}

// Core returns the underlying MCPServer for direct access.
func (s *MCPServerHTTP) Core() *MCPServer {
	return s.core
}

// RegisterRoutes mounts the MCP server routes on the given router.
func (s *MCPServerHTTP) RegisterRoutes(r *mux.Router) {
	// SSE endpoint for Claude Desktop (GET establishes connection, POST sends messages)
	r.HandleFunc("/mcp", s.handleSSE).Methods("GET")
	r.HandleFunc("/mcp", s.handleMCPMessage).Methods("POST")

	// Session management endpoints for the ARGUS UI
	r.HandleFunc("/mcp/sessions", s.handleListSessions).Methods("GET")
	r.HandleFunc("/mcp/sessions/{id}/approve", s.handleApproveSession).Methods("POST")
	r.HandleFunc("/mcp/sessions/{id}/block", s.handleBlockSession).Methods("POST")
	r.HandleFunc("/mcp/sessions/{id}/budget", s.handleSetBudget).Methods("POST")

	// Permission check endpoint (Claude -> ARGUS -> approve)
	r.HandleFunc("/mcp/permission", s.handlePermissionRequest).Methods("POST")
}

// ---------- Handler Implementations ----------

func (s *MCPServerHTTP) handleSSE(w http.ResponseWriter, r *http.Request) {
	// Check auth if configured
	if s.authToken != "" && r.Header.Get("Authorization") != "Bearer "+s.authToken {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// For Claude Web: a GET with no auth triggers discovery.
	// Return 401 with WWW-Authenticate so Claude Web knows to start OAuth flow.
	// Claude Web will then read /.well-known/oauth-authorization-server.
	if r.Header.Get("Authorization") == "" && s.authToken == "" {
		// Only do this if the request looks like an unauthenticated probe
		// (no session_id query param = fresh connection attempt, not SSE stream)
		if r.URL.Query().Get("session_id") == "" {
			publicBase := "http://localhost:8080"
			if v := r.Header.Get("X-Forwarded-Host"); v != "" {
				scheme := "https"
				if r.Header.Get("X-Forwarded-Proto") != "" {
					scheme = r.Header.Get("X-Forwarded-Proto")
				}
				publicBase = scheme + "://" + v
			}
			w.Header().Set("WWW-Authenticate", `Bearer resource_metadata="`+publicBase+`/.well-known/oauth-protected-resource"`)
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Expose-Headers", "WWW-Authenticate")
			http.Error(w, `{"error":"unauthorized","error_description":"Connect via OAuth 2.1 or add Bearer token"}`, http.StatusUnauthorized)
			return
		}
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	// Generate a unique client ID for this SSE connection
	s.mu.Lock()
	s.nextClientID++
	clientID := fmt.Sprintf("mcp-%d", s.nextClientID)
	msgCh := make(chan string, 64)
	s.sseClients[clientID] = msgCh
	s.mu.Unlock()

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Send the client their session ID and endpoint info
	fmt.Fprintf(w, "event: endpoint\ndata: {\"sessionId\":\"%s\",\"endpoint\":\"/mcp\"}\n\n", clientID)
	flusher.Flush()

	s.logger.InfoContext(r.Context(), "mcp: sse client connected",
		slog.String("client_id", clientID),
		slog.String("remote", r.RemoteAddr),
	)

	// Register this client as an MCP session
	coreClient := &ClientSession{
		ID:          clientID,
		ConnectedAt: time.Now(),
		BudgetLimit: 5.0,
	}
	s.core.clients[clientID] = coreClient

	s.core.emitEvent("mcp_client_connecting", map[string]any{
		"client_id": clientID,
		"time":      coreClient.ConnectedAt,
		"needs_approval": s.approvalFn != nil,
	})

	// Wait for approval if needed
	if s.approvalFn != nil {
		approved := false
		for i := 0; i < 300; i++ { // 30 second timeout
			if s.approvalFn(clientID) {
				approved = true
				break
			}
			time.Sleep(100 * time.Millisecond)
		}
		if !approved {
			fmt.Fprintf(w, "event: error\ndata: {\"error\":\"Connection not approved\",\"code\":\"approval_timeout\"}\n\n")
			flusher.Flush()
			s.mu.Lock()
			delete(s.sseClients, clientID)
			delete(s.core.clients, clientID)
			s.mu.Unlock()
			return
		}
		fmt.Fprintf(w, "event: approved\ndata: {\"sessionId\":\"%s\",\"message\":\"Connection approved by ARGUS\"}\n\n", clientID)
		flusher.Flush()

		s.core.emitEvent("mcp_client_approved", map[string]any{
			"client_id": clientID,
		})
	}

	// Start keepalive goroutine
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				s.mu.Lock()
				if ch, ok := s.sseClients[clientID]; ok {
					select {
					case ch <- ": keepalive":
					default:
					}
				}
				s.mu.Unlock()
			case <-ctx.Done():
				return
			}
		}
	}()

	// Read events from the channel and send them via SSE
	for {
		select {
		case msg, ok := <-msgCh:
			if !ok {
				return
			}
			if msg == ": keepalive" {
				fmt.Fprintf(w, ": keepalive\n\n")
			} else {
				fmt.Fprintf(w, "event: message\ndata: %s\n\n", msg)
			}
			flusher.Flush()
		case <-r.Context().Done():
			s.mu.Lock()
			delete(s.sseClients, clientID)
			s.mu.Unlock()
			s.core.emitEvent("mcp_client_disconnected", map[string]any{
				"client_id": clientID,
			})
			return
		}
	}
}

func (s *MCPServerHTTP) handleMCPMessage(w http.ResponseWriter, r *http.Request) {
	// Parse the JSON-RPC request
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, `{"jsonrpc":"2.0","error":{"code":-32700,"message":"Parse error"}}`, http.StatusBadRequest)
		return
	}

	// Get client ID from header or query param
	clientID := r.URL.Query().Get("session_id")
	if clientID == "" {
		clientID = r.Header.Get("X-MCP-Session-ID")
	}
	if clientID == "" {
		clientID = "anonymous"
	}

	// Process the request through the core MCP handler
	response := s.core.HandleRequest(r.Context(), body, clientID)

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if response == nil {
		// Notification - no response expected
		w.WriteHeader(http.StatusAccepted)
		w.Write([]byte(`{}`))
		return
	}

	json.NewEncoder(w).Encode(response)
}

func (s *MCPServerHTTP) handleListSessions(w http.ResponseWriter, r *http.Request) {
	clients := s.core.GetClients()
	sessions := make([]map[string]any, 0, len(clients))
	for _, c := range clients {
		sessions = append(sessions, map[string]any{
			"id":            c.ID,
			"client_name":   c.ClientName,
			"client_version": c.ClientVersion,
			"connected_at":  c.ConnectedAt,
			"total_cost":    c.TotalCost,
			"tool_calls":    c.ToolCallCount,
			"budget_limit":  c.BudgetLimit,
			"blocked":       c.Blocked,
		})
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(map[string]any{"sessions": sessions})
}

func (s *MCPServerHTTP) handleApproveSession(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	client, exists := s.core.clients[id]
	if !exists {
		http.Error(w, `{"error":"session not found"}`, http.StatusNotFound)
		return
	}
	client.Blocked = false
	s.core.emitEvent("mcp_client_approved", map[string]any{
		"client_id": id,
	})
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "approved", "client_id": id})
}

func (s *MCPServerHTTP) handleBlockSession(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	client, exists := s.core.clients[id]
	if !exists {
		http.Error(w, `{"error":"session not found"}`, http.StatusNotFound)
		return
	}
	client.Blocked = true
	s.core.emitEvent("mcp_client_blocked", map[string]any{
		"client_id": id,
	})
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "blocked", "client_id": id})
}

func (s *MCPServerHTTP) handleSetBudget(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	client, exists := s.core.clients[id]
	if !exists {
		http.Error(w, `{"error":"session not found"}`, http.StatusNotFound)
		return
	}
	var req struct {
		Budget float64 `json:"budget"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	client.BudgetLimit = req.Budget
	client.Blocked = false // reset block when budget is increased
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"status": "budget_updated", "budget": req.Budget})
}

func (s *MCPServerHTTP) handlePermissionRequest(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ClientID string `json:"client_id"`
		Action   string `json:"action"` // "allow", "deny"
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}

	client, exists := s.core.clients[req.ClientID]
	if !exists {
		http.Error(w, `{"error":"session not found"}`, http.StatusNotFound)
		return
	}

	switch req.Action {
	case "allow":
		client.Blocked = false
		s.core.emitEvent("mcp_permission_granted", map[string]any{
			"client_id": req.ClientID,
		})
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "allowed"})
	case "deny":
		client.Blocked = true
		s.core.emitEvent("mcp_permission_denied", map[string]any{
			"client_id": req.ClientID,
		})
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "denied"})
	default:
		http.Error(w, `{"error":"action must be 'allow' or 'deny'"}`, http.StatusBadRequest)
	}
}

// ---------- Stdio Transport ----------

// RunStdio runs the MCP server over stdin/stdout for local Claude CLI connections.
// Messages are newline-delimited JSON-RPC 2.0.
func RunStdio(ctx context.Context, logger *slog.Logger, projectRoot string) error {
	core := NewMCPServer(logger, projectRoot)
	scanner := bufio.NewScanner(osStdin())
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		response := core.HandleRequest(ctx, line, "stdio-client")
		if response != nil {
			data, _ := json.Marshal(response)
			fmt.Fprintln(osStdout(), string(data))
		}
	}
	return scanner.Err()
}

// osStdin and osStdout are variables so they can be replaced in tests.
var osStdin = func() io.Reader { return os.Stdin }
var osStdout = func() io.Writer { return os.Stdout }
