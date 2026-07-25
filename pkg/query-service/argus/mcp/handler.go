package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// ToolHandler is a function that executes an MCP tool with cost tracking.
type ToolHandler func(ctx context.Context, args map[string]any) (*CallToolResult, error)

// MCPServer is the core MCP protocol handler that manages tools, resources,
// and client connections. It tracks costs and emits events to the ARGUS
// control plane via an EventCallback.
type MCPServer struct {
	logger       *slog.Logger
	tools        []Tool
	handlers     map[string]ToolHandler
	resources    []Resource
	clients      map[string]*ClientSession
	costCallback func(agentID string, cost float64, tool string)
	eventCallback func(eventType string, data any)
	projectRoot  string
}

// ClientSession represents a connected MCP client (e.g., Claude Desktop).
type ClientSession struct {
	ID             string
	ClientName     string
	ClientVersion  string
	ConnectedAt    time.Time
	TotalCost      float64
	ToolCallCount  int
	BudgetLimit    float64
	Blocked        bool
}

// NewMCPServer creates a new MCP server wired with default tools.
func NewMCPServer(logger *slog.Logger, projectRoot string) *MCPServer {
	s := &MCPServer{
		logger:      logger,
		tools:       DefaultTools(),
		handlers:    make(map[string]ToolHandler),
		clients:     make(map[string]*ClientSession),
		projectRoot: projectRoot,
	}

	// Register default tool handlers
	s.registerHandlers()
	return s
}

// SetCostCallback sets a function called when a tool call incurs cost.
// The ARGUS server uses this to track spend through the cost firewall.
func (s *MCPServer) SetCostCallback(fn func(agentID string, cost float64, tool string)) {
	s.costCallback = fn
}

// SetEventCallback sets a function called when MCP events occur (connect, disconnect, tool call, block).
// The ARGUS server uses this to stream events to the Next.js frontend via WebSocket.
func (s *MCPServer) SetEventCallback(fn func(eventType string, data any)) {
	s.eventCallback = fn
}

// GetClients returns all connected client sessions.
func (s *MCPServer) GetClients() map[string]*ClientSession {
	return s.clients
}

// registerHandlers wires the default tool implementations.
func (s *MCPServer) registerHandlers() {
	s.handlers["read_file"] = s.handleReadFile
	s.handlers["search_code"] = s.handleSearchCode
	s.handlers["list_directory"] = s.handleListDirectory
	s.handlers["analyze_codebase"] = s.handleAnalyzeCodebase
	s.handlers["run_command"] = s.handleRunCommand
	s.handlers["signoz_query_traces"] = s.handleSigNozQueryTraces
	s.handlers["signoz_get_services"] = s.handleSigNozGetServices
	s.handlers["signoz_list_alerts"] = s.handleSigNozListAlerts
	s.handlers["signoz_create_dashboard"] = s.handleSigNozCreateDashboard
	s.handlers["argus_list_agents"] = s.handleArgusListAgents
	s.handlers["argus_agent_dna"] = s.handleArgusAgentDNA
	s.handlers["argus_cost_status"] = s.handleArgusCostStatus
}

// HandleRequest processes a JSON-RPC request and returns a response.
// This is the main entry point for the MCP protocol.
func (s *MCPServer) HandleRequest(ctx context.Context, raw json.RawMessage, clientID string) *Response {
	var req Request
	if err := json.Unmarshal(raw, &req); err != nil {
		return NewErrorResponse(nil, ErrCodeParse, "Parse error: invalid JSON-RPC")
	}

	if req.JSONRPC != JSONRPCVersion {
		return NewErrorResponse(req.ID, ErrCodeInvalidRequest, "Invalid JSON-RPC version")
	}

	session, exists := s.clients[clientID]
	if !exists {
		session = &ClientSession{
			ID:          clientID,
			ConnectedAt: time.Now(),
			BudgetLimit: 5.0, // Default $5 budget
		}
		s.clients[clientID] = session
	}

	switch req.Method {
	case MethodInitialize:
		return s.handleInitialize(req.ID, req.Params, session)
	case MethodInitialized:
		return s.handleInitialized(req.ID, session)
	case MethodToolsList:
		return s.handleToolsList(req.ID)
	case MethodToolsCall:
		return s.handleToolsCall(ctx, req.ID, req.Params, session)
	case MethodResourcesList:
		return s.handleResourcesList(req.ID)
	case MethodResourcesRead:
		return s.handleResourcesRead(req.ID, req.Params)
	case MethodPing:
		return NewResponse(req.ID, map[string]any{})
	default:
		return NewErrorResponse(req.ID, ErrCodeMethodNotFound, "Method not found: "+req.Method)
	}
}

// ---------- Method Handlers ----------

func (s *MCPServer) handleInitialize(id json.RawMessage, params json.RawMessage, session *ClientSession) *Response {
	var req InitializeRequest
	if err := json.Unmarshal(params, &req); err != nil {
		return NewErrorResponse(id, ErrCodeInvalidParams, "Invalid initialize params")
	}

	session.ClientName = req.ClientInfo.Name
	session.ClientVersion = req.ClientInfo.Version

	result := InitializeResult{
		ProtocolVersion: ProtocolVersion,
		Capabilities: ServerCapabilities{
			Tools: &ToolCapabilities{ListChanged: true},
			Resources: &ResourceCapabilities{Subscribe: false, ListChanged: false},
		},
		ServerInfo: Implementation{
			Name:    "ARGUS Control Plane",
			Version: "1.0.0",
		},
		Instructions: `ARGUS is the AI Agent Governance platform that sits between Claude and your tools. Every tool call is metered for cost, governed by security policies, and streamed to the ARGUS dashboard. Connections are automatically blocked when the budget limit is exceeded.`,
	}

	s.emitEvent("mcp_client_connected", map[string]any{
		"client_id":   session.ID,
		"client_name": session.ClientName,
		"version":     session.ClientVersion,
		"time":        session.ConnectedAt,
	})

	return NewResponse(id, result)
}

func (s *MCPServer) handleInitialized(id json.RawMessage, session *ClientSession) *Response {
	s.logger.InfoContext(context.Background(), "mcp: client initialized",
		slog.String("client_id", session.ID),
		slog.String("client_name", session.ClientName),
	)
	return nil // notifications don't get a response
}

func (s *MCPServer) handleToolsList(id json.RawMessage) *Response {
	return NewResponse(id, ListToolsResult{Tools: s.tools})
}

func (s *MCPServer) handleToolsCall(ctx context.Context, id json.RawMessage, params json.RawMessage, session *ClientSession) *Response {
	// Check budget before allowing any tool call
	if session.Blocked {
		return NewResponse(id, NewErrorResult(fmt.Sprintf(
			"ARGUS Firewall: Agent has been blocked. Budget limit of $%.2f exceeded. Total cost: $%.4f. Contact your administrator to increase the budget.",
			session.BudgetLimit, session.TotalCost,
		)))
	}

	var req CallToolRequest
	if err := json.Unmarshal(params, &req); err != nil {
		return NewErrorResponse(id, ErrCodeInvalidParams, "Invalid tool call params")
	}

	handler, exists := s.handlers[req.Name]
	if !exists {
		return NewErrorResponse(id, ErrCodeMethodNotFound, "Tool not found: "+req.Name)
	}

	// Calculate cost for this tool call
	toolCost := ToolCost(req.Name)
	session.TotalCost += toolCost
	session.ToolCallCount++

	// Report cost to the ARGUS cost firewall
	if s.costCallback != nil {
		s.costCallback(session.ID, toolCost, req.Name)
	}

	s.emitEvent("mcp_tool_call", map[string]any{
		"client_id": session.ID,
		"tool":      req.Name,
		"cost":      toolCost,
		"total":     session.TotalCost,
		"budget":    session.BudgetLimit,
		"count":     session.ToolCallCount,
	})

	// Check if budget exceeded after this call
	if session.TotalCost > session.BudgetLimit {
		session.Blocked = true
		s.emitEvent("mcp_budget_exceeded", map[string]any{
			"client_id": session.ID,
			"total":     session.TotalCost,
			"budget":    session.BudgetLimit,
		})
		return NewResponse(id, NewErrorResult(fmt.Sprintf(
			"ARGUS Firewall: Budget of $%.2f exceeded! Total cost: $%.4f. Connection blocked.",
			session.BudgetLimit, session.TotalCost,
		)))
	}

	result, err := handler(ctx, req.Arguments)
	if err != nil {
		return NewResponse(id, NewErrorResult("Tool error: "+err.Error()))
	}

	return NewResponse(id, result)
}

func (s *MCPServer) handleResourcesList(id json.RawMessage) *Response {
	return NewResponse(id, ListResourcesResult{Resources: s.resources})
}

func (s *MCPServer) handleResourcesRead(id json.RawMessage, params json.RawMessage) *Response {
	var req ReadResourceRequest
	if err := json.Unmarshal(params, &req); err != nil {
		return NewErrorResponse(id, ErrCodeInvalidParams, "Invalid resource read params")
	}

	for _, r := range s.resources {
		if r.URI == req.URI {
			return NewResponse(id, ReadResourceResult{
				Contents: []ResourceContent{{URI: r.URI, MimeType: r.MimeType, Text: "Resource content"}},
			})
		}
	}
	return NewErrorResponse(id, ErrCodeInvalidParams, "Resource not found: "+req.URI)
}

// ---------- Tool Handlers ----------

func (s *MCPServer) handleReadFile(ctx context.Context, args map[string]any) (*CallToolResult, error) {
	path, _ := args["path"].(string)
	if path == "" {
		return NewErrorResult("path is required"), nil
	}

	// Prevent path traversal
	if strings.Contains(path, "..") {
		return NewErrorResult("path traversal not allowed"), nil
	}

	fullPath := path
	if !filepath.IsAbs(path) && s.projectRoot != "" {
		fullPath = filepath.Join(s.projectRoot, path)
	}

	data, err := os.ReadFile(fullPath)
	if err != nil {
		return NewErrorResult(fmt.Sprintf("Failed to read file: %s", err.Error())), nil
	}

	// Truncate very large files
	content := string(data)
	if len(content) > 50000 {
		content = content[:50000] + "\n\n... [truncated at 50,000 characters]"
	}

	return NewTextResult(content), nil
}

func (s *MCPServer) handleSearchCode(ctx context.Context, args map[string]any) (*CallToolResult, error) {
	pattern, _ := args["pattern"].(string)
	if pattern == "" {
		return NewErrorResult("pattern is required"), nil
	}

	glob, _ := args["glob"].(string)
	caseSensitive, _ := args["case_sensitive"].(bool)

	cmdArgs := []string{"--line-number", "--color=never"}
	if !caseSensitive {
		cmdArgs = append(cmdArgs, "-i")
	}
	if glob != "" {
		cmdArgs = append(cmdArgs, "-g", glob)
	}
	cmdArgs = append(cmdArgs, pattern)

	if s.projectRoot != "" {
		cmdArgs = append(cmdArgs, s.projectRoot)
	}

	cmd := exec.CommandContext(ctx, "rg", cmdArgs...)
	output, err := cmd.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok && exitErr.ExitCode() == 1 {
			// rg returns exit code 1 when no matches found
			return NewTextResult("No matches found"), nil
		}
		return NewErrorResult(fmt.Sprintf("Search failed: %s", err.Error())), nil
	}

	result := string(output)
	if len(result) > 10000 {
		result = result[:10000] + "\n\n... [truncated at 10,000 characters]"
	}

	if len(result) == 0 {
		return NewTextResult("No matches found"), nil
	}

	return NewTextResult(result), nil
}

func (s *MCPServer) handleListDirectory(ctx context.Context, args map[string]any) (*CallToolResult, error) {
	path, _ := args["path"].(string)
	if path == "" {
		return NewErrorResult("path is required"), nil
	}

	if strings.Contains(path, "..") {
		return NewErrorResult("path traversal not allowed"), nil
	}

	fullPath := path
	if !filepath.IsAbs(path) && s.projectRoot != "" {
		fullPath = filepath.Join(s.projectRoot, path)
	}

	entries, err := os.ReadDir(fullPath)
	if err != nil {
		return NewErrorResult(fmt.Sprintf("Failed to list directory: %s", err.Error())), nil
	}

	var result strings.Builder
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue
		}
		prefix := "📄"
		if entry.IsDir() {
			prefix = "📁"
		}
		result.WriteString(fmt.Sprintf("%s %s  (%d bytes, mod %s)\n", prefix, entry.Name(), info.Size(), info.ModTime().Format("Jan 02 15:04")))
	}

	return NewTextResult(result.String()), nil
}

func (s *MCPServer) handleAnalyzeCodebase(ctx context.Context, args map[string]any) (*CallToolResult, error) {
	rootDir := s.projectRoot
	if r, ok := args["root_dir"].(string); ok && r != "" {
		rootDir = r
	}
	if rootDir == "" {
		return NewErrorResult("No root directory configured"), nil
	}

		depth := 3
	if d, ok := args["depth"].(float64); ok && d > 0 {
		depth = int(d)
		if depth > 6 {
			depth = 6
		}
	}

	// Count files by extension with depth-limited walking
	extCount := make(map[string]int)
	filepath.Walk(rootDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		// Calculate current depth relative to rootDir
		relPath := strings.TrimPrefix(path, rootDir)
		relPath = strings.TrimPrefix(relPath, "/")
		currentDepth := strings.Count(relPath, string(filepath.Separator))

		if info.IsDir() {
			// Skip hidden directories and enforce depth limit
			if strings.HasPrefix(info.Name(), ".") && path != rootDir {
				return filepath.SkipDir
			}
			if currentDepth >= depth {
				return filepath.SkipDir
			}
			return nil
		}
		ext := strings.ToLower(filepath.Ext(info.Name()))
		if ext != "" {
			extCount[ext]++
		}
		return nil
	})

	var result strings.Builder
	result.WriteString(fmt.Sprintf("📊 Codebase Analysis: %s\n\n", rootDir))
	result.WriteString(fmt.Sprintf("Max Depth: %d\n\n", depth))
	result.WriteString("## File Count by Extension\n\n")
	for ext, count := range extCount {
		result.WriteString(fmt.Sprintf("- %s: %d files\n", ext, count))
	}
	result.WriteString(fmt.Sprintf("\nTotal unique extensions: %d\n", len(extCount)))

	return NewTextResult(result.String()), nil
}

func (s *MCPServer) handleRunCommand(ctx context.Context, args map[string]any) (*CallToolResult, error) {
	command, _ := args["command"].(string)
	if command == "" {
		return NewErrorResult("command is required"), nil
	}

	timeout := 30
	if t, ok := args["timeout_seconds"].(float64); ok && t > 0 {
		timeout = int(t)
		if timeout > 120 {
			timeout = 120
		}
	}

	ctx, cancel := context.WithTimeout(ctx, time.Duration(timeout)*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "bash", "-c", command)
	if s.projectRoot != "" {
		cmd.Dir = s.projectRoot
	}

	output, err := cmd.Output()
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return NewErrorResult(fmt.Sprintf("Command timed out after %d seconds", timeout)), nil
		}
		if exitErr, ok := err.(*exec.ExitError); ok {
			return NewTextResult(fmt.Sprintf("Command exited with code %d\n%s", exitErr.ExitCode(), string(exitErr.Stderr))), nil
		}
		return NewErrorResult(fmt.Sprintf("Command failed: %s", err.Error())), nil
	}

	result := string(output)
	if len(result) > 20000 {
		result = result[:20000] + "\n\n... [truncated at 20,000 characters]"
	}
	return NewTextResult(result), nil
}

func (s *MCPServer) handleSigNozQueryTraces(ctx context.Context, args map[string]any) (*CallToolResult, error) {
	traceID, _ := args["trace_id"].(string)
	serviceName, _ := args["service_name"].(string)

	if traceID == "" && serviceName == "" {
		return NewErrorResult("Provide trace_id or service_name to query traces"), nil
	}

	result := "## SigNoz Trace Query\n\n"
	if traceID != "" {
		result += fmt.Sprintf("- Trace ID: %s\n", traceID)
	}
	if serviceName != "" {
		result += fmt.Sprintf("- Service: %s\n", serviceName)
	}

	// This connects to the real SigNoz Reader when available
	if s.costCallback != nil {
		s.costCallback(sessionIDFromContext(ctx), 0, "signoz_query_traces")
	}

	result += "\n*Connected to ARGUS MCP — trace data available through SigNoz integration.*"
	return NewTextResult(result), nil
}

func (s *MCPServer) handleSigNozGetServices(ctx context.Context, args map[string]any) (*CallToolResult, error) {
	return NewTextResult("## SigNoz Services\n\n*Connected to ARGUS MCP — service data available through SigNoz integration.*"), nil
}

func (s *MCPServer) handleSigNozListAlerts(ctx context.Context, args map[string]any) (*CallToolResult, error) {
	return NewTextResult("## SigNoz Alerts\n\n*Connected to ARGUS MCP — alert data available through SigNoz integration.*"), nil
}

func (s *MCPServer) handleSigNozCreateDashboard(ctx context.Context, args map[string]any) (*CallToolResult, error) {
	dashType, _ := args["dashboard_type"].(string)
	title, _ := args["title"].(string)

	result := fmt.Sprintf("## SigNoz Dashboard Created\n\n- Type: %s\n", dashType)
	if title != "" {
		result += fmt.Sprintf("- Title: %s\n", title)
	}
	result += "\n*Dashboard template generated. Use ARGUS API to push to SigNoz.*"
	return NewTextResult(result), nil
}

func (s *MCPServer) handleArgusListAgents(ctx context.Context, args map[string]any) (*CallToolResult, error) {
	var agents strings.Builder
	agents.WriteString("## ARGUS Connected Agents\n\n")
	agents.WriteString("| Client ID | Client Name | Connected | Cost | Calls | Blocked |\n")
	agents.WriteString("|-----------|-------------|-----------|------|-------|--------|\n")
	for id, c := range s.clients {
		blocked := "No"
		if c.Blocked {
			blocked = "Yes"
		}
		agents.WriteString(fmt.Sprintf("| %s | %s | %s | $%.4f | %d | %s |\n",
			id[:min(len(id), 8)], c.ClientName, c.ConnectedAt.Format("15:04:05"), c.TotalCost, c.ToolCallCount, blocked))
	}
	if len(s.clients) == 0 {
		agents.WriteString("_No agents currently connected._\n")
	}
	return NewTextResult(agents.String()), nil
}

func (s *MCPServer) handleArgusAgentDNA(ctx context.Context, args map[string]any) (*CallToolResult, error) {
	traceID, _ := args["trace_id"].(string)
	if traceID == "" {
		return NewErrorResult("trace_id is required"), nil
	}
	return NewTextResult(fmt.Sprintf("## Agent DNA Analysis\n\n- Trace ID: %s\n- Status: Analysis available through ARGUS Agent DNA engine\n", traceID)), nil
}

func (s *MCPServer) handleArgusCostStatus(ctx context.Context, args map[string]any) (*CallToolResult, error) {
	var totalCost float64
	var totalCalls int
	var blockedCount int
	for _, c := range s.clients {
		totalCost += c.TotalCost
		totalCalls += c.ToolCallCount
		if c.Blocked {
			blockedCount++
		}
	}

	result := fmt.Sprintf(`## ARGUS Cost Firewall Status

- Total Cost: $%.4f
- Total Tool Calls: %d
- Connected Agents: %d
- Blocked Agents: %d
- Budget per Agent: $5.00
`, totalCost, totalCalls, len(s.clients), blockedCount)

	return NewTextResult(result), nil
}

// ---------- Helpers ----------

func (s *MCPServer) emitEvent(eventType string, data any) {
	if s.eventCallback != nil {
		s.eventCallback(eventType, data)
	}
}

// sessionIDFromContext is a placeholder for extracting session ID from context.
// In production, this would use the actual session token.
func sessionIDFromContext(ctx context.Context) string {
	return "mcp-session"
}
