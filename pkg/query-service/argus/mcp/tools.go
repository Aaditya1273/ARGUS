package mcp

// DefaultTools returns the built-in MCP tools that Claude can call through ARGUS.
// Each tool has a cost weight used by the ARGUS cost firewall to track spend.
func DefaultTools() []Tool {
	return []Tool{
		{
			Name:        "read_file",
			Description: "Read the contents of a file at the given path. Use this when you need to inspect source code, configuration files, or documentation.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]any{
					"path": map[string]any{
						"type":        "string",
						"description": "Absolute or relative path to the file to read",
					},
				},
				Required: []string{"path"},
			},
		},
		{
			Name:        "search_code",
			Description: "Search the codebase for a pattern using ripgrep. Supports regex patterns, file globs, and case-insensitive search.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]any{
					"pattern": map[string]any{
						"type":        "string",
						"description": "Search pattern (regex supported)",
					},
					"glob": map[string]any{
						"type":        "string",
						"description": "Optional file glob filter, e.g. '*.go' or '*.ts'",
					},
					"case_sensitive": map[string]any{
						"type":        "boolean",
						"description": "Whether the search is case sensitive (default: false)",
					},
				},
				Required: []string{"pattern"},
			},
		},
		{
			Name:        "list_directory",
			Description: "List files and directories in a given path. Returns file names, sizes, and modification times.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]any{
					"path": map[string]any{
						"type":        "string",
						"description": "Path to the directory to list",
					},
				},
				Required: []string{"path"},
			},
		},
		{
			Name:        "analyze_codebase",
			Description: "Perform a high-level analysis of the codebase structure. Returns project language breakdown, directory tree, and key metrics.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]any{
					"root_dir": map[string]any{
						"type":        "string",
						"description": "Root directory to analyze (default: current project)",
					},
					"depth": map[string]any{
						"type":        "number",
						"description": "Directory tree depth (default: 3, max: 6)",
					},
				},
			},
		},
		{
			Name:        "run_command",
			Description: "Execute a shell command and return its output. Use for building, testing, and running scripts.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]any{
					"command": map[string]any{
						"type":        "string",
						"description": "Shell command to execute",
					},
					"timeout_seconds": map[string]any{
						"type":        "number",
						"description": "Timeout in seconds (default: 30, max: 120)",
					},
				},
				Required: []string{"command"},
			},
		},
		{
			Name:        "signoz_query_traces",
			Description: "Query SigNoz trace data for a given trace ID or search traces by service name and time range.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]any{
					"trace_id": map[string]any{
						"type":        "string",
						"description": "Trace ID to look up",
					},
					"service_name": map[string]any{
						"type":        "string",
						"description": "Service name to filter by",
					},
					"time_range_hours": map[string]any{
						"type":        "number",
						"description": "Time range in hours to search back (default: 1)",
					},
				},
			},
		},
		{
			Name:        "signoz_get_services",
			Description: "List all services monitored by SigNoz along with their key metrics (error rate, latency, request count).",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]any{},
			},
		},
		{
			Name:        "signoz_list_alerts",
			Description: "List all active alert rules in SigNoz with their current status, severity, and configuration.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]any{},
			},
		},
		{
			Name:        "signoz_create_dashboard",
			Description: "Create a new SigNoz dashboard from a template. Supports governance, cost, and agent-DNA dashboard types.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]any{
					"dashboard_type": map[string]any{
						"type":        "string",
						"description": "Dashboard type: 'governance', 'cost', or 'dna'",
						"enum":        []string{"governance", "cost", "dna"},
					},
					"title": map[string]any{
						"type":        "string",
						"description": "Optional custom title for the dashboard",
					},
				},
				Required: []string{"dashboard_type"},
			},
		},
		{
			Name:        "argus_list_agents",
			Description: "List all AI agents currently being tracked by ARGUS with their status, cost, and metrics.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]any{},
			},
		},
		{
			Name:        "argus_agent_dna",
			Description: "Get the behavioral DNA fingerprint and anomaly report for a specific agent trace.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]any{
					"trace_id": map[string]any{
						"type":        "string",
						"description": "Trace ID to analyze",
					},
					"agent_id": map[string]any{
						"type":        "string",
						"description": "Optional agent ID for baseline context",
					},
				},
				Required: []string{"trace_id"},
			},
		},
		{
			Name:        "argus_cost_status",
			Description: "Get the current ARGUS cost firewall status, budget usage, and policy enforcement state.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]any{},
			},
		},
	}
}

// ToolCost returns the cost weight for a tool (in fractional tokens/cents).
// Used by the cost firewall to track and limit agent spend.
func ToolCost(toolName string) float64 {
	costs := map[string]float64{
		"read_file":            0.001,
		"search_code":          0.002,
		"list_directory":       0.001,
		"analyze_codebase":     0.005,
		"run_command":          0.003,
		"signoz_query_traces":  0.002,
		"signoz_get_services":  0.001,
		"signoz_list_alerts":   0.001,
		"signoz_create_dashboard": 0.005,
		"argus_list_agents":    0.001,
		"argus_agent_dna":      0.002,
		"argus_cost_status":    0.001,
	}
	if cost, ok := costs[toolName]; ok {
		return cost
	}
	return 0.002 // default cost for unknown tools
}
