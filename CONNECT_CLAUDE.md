# Connect Claude Desktop to ARGUS

## What happens when Claude connects

1. Claude opens an SSE stream to `http://localhost:8080/api/v1/mcp`
2. ARGUS assigns Claude a session ID and starts tracking it as an agent
3. Every tool call Claude makes (read_file, search_code, run_command…) is:
   - Metered for cost against a $5 per-session budget
   - Broadcast via WebSocket to the Mission Control dashboard
   - Logged in the MCP sessions list
4. When cost exceeds the budget, ARGUS sends Claude a **"Blocked by ARGUS Firewall"** error
5. You can kill/pause/resume Claude from the Mission Control page in real time

---

## Step 1 — Start the ARGUS backend

```bash
cd ~/Wins/Subnet-ZK-Compose
go run cmd/argus-server/main.go
```

You should see:
```
INFO ARGUS server starting addr=:8080 org_id=default
INFO argus: MCP server initialized endpoint=/api/v1/mcp
```

**Optional — enable demo agents on startup:**
```bash
ARGUS_DEMO_MODE=true go run cmd/argus-server/main.go
```

---

## Step 2 — Start the frontend

```bash
cd ~/Wins/Subnet-ZK-Compose/frontend
npm run dev
```

Open **http://localhost:3000** → you should see the ARGUS dashboard.

---

## Step 3 — Connect Claude Desktop

Claude Desktop uses a config file. Add the ARGUS MCP server to it.

### Linux path
```
~/.config/Claude/claude_desktop_config.json
```

### macOS path
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

### Config to add

```json
{
  "mcpServers": {
    "argus": {
      "url": "http://localhost:8080/api/v1/mcp"
    }
  }
}
```

A ready-made copy is at `agent-skills/claude_desktop_config.json` in this repo.

**Quick install on Linux:**
```bash
mkdir -p ~/.config/Claude
cp agent-skills/claude_desktop_config.json ~/.config/Claude/claude_desktop_config.json
```

**Quick install on macOS:**
```bash
mkdir -p ~/Library/Application\ Support/Claude
cp agent-skills/claude_desktop_config.json ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

---

## Step 4 — Restart Claude Desktop

Fully quit Claude (Cmd+Q / right-click tray → Quit) and reopen it.
In Claude's tool selector you should see **"argus"** listed as an MCP server with 12 tools.

---

## Step 5 — Run the demo

In Claude, type:
```
Analyze this massive codebase at /home/bajrangi/Wins/Subnet-ZK-Compose and write a detailed summary of every component.
```

**Watch the ARGUS dashboard:**
- Mission Control → agent appears, cost counter ticking up live
- Cost Firewall → burn rate chart spikes as Claude calls tools
- When cost hits $5.00 → Claude receives "ARGUS Firewall: Budget exceeded. Connection blocked."

---

## Available MCP tools Claude can call

| Tool | Cost | What it does |
|------|------|-------------|
| `read_file` | $0.001 | Read any file in the project |
| `search_code` | $0.002 | ripgrep search across codebase |
| `list_directory` | $0.001 | List directory contents |
| `analyze_codebase` | $0.005 | Language breakdown + file metrics |
| `run_command` | $0.003 | Execute shell commands (bash -c) |
| `argus_list_agents` | $0.001 | List all agents tracked by ARGUS |
| `argus_cost_status` | $0.001 | Get current budget/burn status |
| `argus_agent_dna` | $0.002 | Get behavioral fingerprint for a trace |
| `signoz_query_traces` | $0.002 | Query SigNoz trace data |
| `signoz_get_services` | $0.001 | List SigNoz monitored services |
| `signoz_list_alerts` | $0.001 | List SigNoz alert rules |
| `signoz_create_dashboard` | $0.005 | Create a SigNoz dashboard |

---

## Change the budget limit

Default is **$5 per session** and **$100 total** for the server.

Per-session budget (via API):
```bash
curl -X POST http://localhost:8080/api/v1/mcp/sessions/<session-id>/budget \
  -H "Content-Type: application/json" \
  -d '{"budget": 10.0}'
```

Server-wide budget:
```bash
ARGUS_BUDGET_LIMIT=50 go run cmd/argus-server/main.go
```

---

## Verify everything is working

```bash
# Health check
curl http://localhost:8080/api/v1/health

# Live agent list
curl http://localhost:8080/api/v1/argus/agents

# Active MCP sessions
curl http://localhost:8080/api/v1/mcp/sessions

# Governance rules (all 9)
curl http://localhost:8080/api/v1/argus/governance/rules | python3 -m json.tool

# Cost firewall status
curl http://localhost:8080/api/v1/argus/cost_firewall
```
