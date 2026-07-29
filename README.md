<div align="center">
<img width="1672" height="941" alt="signoz" src="https://github.com/user-attachments/assets/bbaade90-0c39-4862-ba23-4126051ebe2f" />

# ARGUS: AI Agent Runtime Governance

> The autonomous runtime control plane that observes, governs, and enforces policies on your AI agents in real time.


</div>
[![Go](https://img.shields.io/badge/Go-1.22+-00ADD8?logo=go)](https://go.dev)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![MCP](https://img.shields.io/badge/MCP-2024--11--05-orange)](https://modelcontextprotocol.io)
[![OAuth 2.1](https://img.shields.io/badge/OAuth-2.1%20%2B%20PKCE-ea580c)](https://oauth.net/2.1/)
[![SigNoz](https://img.shields.io/badge/SigNoz-Cloud-orange)](https://signoz.io)

---

## What ARGUS Does

ARGUS sits between **Claude** (or any MCP client) and your codebase. Every tool call Claude makes — reading files, searching code, running commands — is intercepted, metered against a budget, evaluated by 9 governance plugins, and streamed live to your dashboard.

When a rule fires (budget exceeded, token explosion, infinite loop), ARGUS blocks the connection automatically.

---

## Architecture 

```
Claude Web / Claude Desktop / Cursor / VS Code
         │
         │  OAuth 2.1 + PKCE  (Claude Web)
         │  SSE config         (Desktop / Cursor)
         ▼
┌─────────────────────────────────────────┐
│  ARGUS Backend  :8080  (Go)             │
│                                         │
│  OAuth 2.1 AS  /.well-known/*           │
│  MCP Server    /api/v1/mcp              │
│  MCP Bearer    /api/v1/mcp/bearer       │
│  WebSocket     /api/v1/argus/ws         │
│  REST API      /api/v1/argus/*          │
│                                         │
│  Governance Engine  (9 plugins)         │
│  Cost Firewall  (per-session budget)    │
│  Agent DNA  (Z-score anomaly)           │
│  Prompt Replay  (real OpenAI call)      │
│  OTel → SigNoz Cloud                    │
└─────────────────────────────────────────┘
         │
         │  WebSocket (live streaming)
         ▼
┌─────────────────────────────────────────┐
│  ARGUS Dashboard  :3000  (Next.js)      │
│                                         │
│  Cost Firewall  — live burn chart       │
│  Mission Control — kill/pause agents    │
│  Governance  — 9 rule plugins           │
│  Agent DNA  — behavioral fingerprints   │
│  Plugins  — one-click Connect button    │
│  Replay  — re-run with real OpenAI      │
└─────────────────────────────────────────┘
```

---

## Quickstart

### 1 — Prerequisites

- Go 1.22+
- Node.js 20+
- SigNoz Cloud account (free tier works) — [signoz.io](https://signoz.io)
- OpenAI API key (for Prompt Replay)

### 2 — Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
# SigNoz Cloud (from signoz.io → Settings → Ingestion Settings)
OTEL_EXPORTER_OTLP_ENDPOINT="https://ingest.in2.signoz.cloud"
OTEL_EXPORTER_OTLP_HEADERS="signoz-ingestion-key=YOUR_KEY"

# OpenAI — enables real Prompt Replay
ARGUS_LLM_API_KEY="sk-..."

# Optional: change the public URL if deploying (default: http://localhost:8080)
# ARGUS_PUBLIC_BASE="https://argus.yourcompany.com"

# Optional: per-session budget limit in dollars (default: $100)
# ARGUS_BUDGET_LIMIT="50"
```

### 3 Start the backend

```bash
go run cmd/argus-server/main.go
```

Expected output:
```
INFO ARGUS: SigNoz Cloud credentials loaded  endpoint=https://ingest.in2.signoz.cloud
INFO ARGUS: OAuth 2.1 discovery base         public_base=http://localhost:8080
INFO argus: MCP server initialized           endpoint=/api/v1/mcp
INFO ARGUS server starting                   addr=:8080
```

### 4 — Start the dashboard

```bash
cd frontend && npm install && npm run dev
```

Open **http://localhost:3000**

### 5 — Connect Claude

Go to **http://localhost:3000/plugins** → click **"Add to Claude Web"**

This opens `claude.ai` with the connector already filled in. Click **Add**. Claude redirects you to the ARGUS consent page where you pick a budget ($5 / $10 / $25 / $50) and approve. Done — Claude is now governed by ARGUS.

---

## Connect Options (all real, no config files needed for Claude Web)

| Client | Method | How |
|--------|--------|-----|
| **Claude Web** | OAuth 2.1 + PKCE | Click "Add to Claude Web" on the Plugins page |
| **Claude Desktop** | SSE | Add config file (shown on Plugins page) |
| **Claude Code** | HTTP | `claude mcp add --transport http argus http://localhost:8080/api/v1/mcp` |
| **Cursor** | SSE | Click "Cursor" chip on Plugins page — opens install prompt |
| **VS Code** | SSE | Click "VS Code" chip on Plugins page |

---

## Dashboard Pages

| Page | What it shows |
|------|--------------|
| **Cost Firewall** | Live burn rate, daily cost chart, budget donut, enforced policies |
| **Mission Control** | Live agent table — kill / pause / resume any agent in real time |
| **Governance** | All 9 detection plugins with severity and auto-action |
| **Agent DNA** | Behavioral fingerprints, anomaly scores, tool usage distribution |
| **Plugins** | One-click connect for all MCP clients, live tool call stream |
| **Replay** | Reconstruct past trace, modify prompt, call real OpenAI, compare diff |

---

## MCP Tools Available to Claude

| Tool | Cost | What it does |
|------|------|-------------|
| `read_file` | $0.001 | Read any file in the project |
| `search_code` | $0.002 | Ripgrep search across codebase |
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

## Governance Plugins (9 active)

| Plugin | Severity | Action |
|--------|----------|--------|
| Infinite Tool Loop Detection | CRITICAL | KILL_RUN |
| Token Explosion Prevention | CRITICAL | KILL_RUN |
| Budget Exceeded | CRITICAL | KILL_RUN |
| Latency Spike Detection | HIGH | TRIGGER_FALLBACK |
| Agent Stuck | HIGH | ALERT |
| Retry Storm | MEDIUM | CIRCUIT_BREAKER |
| Repeated Prompt | MEDIUM | ALERT |
| Prompt Recursion | HIGH | KILL_RUN |
| Tool Timeout | HIGH | ALERT |

---

## OAuth 2.1 Flow (Claude Web)

```
Claude Web
  1. GET /api/v1/mcp                              → 401 WWW-Authenticate: Bearer resource_metadata=...
  2. GET /.well-known/oauth-protected-resource    → {resource, authorization_servers}
  3. GET /.well-known/oauth-authorization-server  → {authorize, token, register endpoints}
  4. POST /register                               → {client_id: rmt_client_...}
  5. GET /authorize?client_id=...&code_challenge= → 302 → localhost:3000/connect?request=...
  6. User approves on /connect, picks budget      → POST /api/v1/argus/oauth/approve
  7. POST /token (code + PKCE verifier)           → {access_token: rmt_at_...}
  8. POST /api/v1/mcp/bearer  Authorization: Bearer rmt_at_...  → real tool calls
```

---

## Python SDK (demo agent)

```bash
cd argus-sdk && pip install -e .
```

```python
import argus

argus.init(
    agent_id="my-sales-agent",
    telemetry_endpoint="http://localhost:4318",
    control_plane_url="ws://localhost:8080/api/v1/argus/agent-ws",
)

@argus.enforce
def my_agent_loop():
    # ARGUS intercepts every call, checks for kill/pause signals
    ...
```

---

## Verification

Run the full 20-check real verification:

```bash
go run cmd/argus-server/main.go &
python3 demo/verify.py
```

All 20 checks verify: OAuth flow end-to-end, real MCP tool calls, governance rules, SigNoz connectivity, agent tracking, no fake/mocked responses.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.22, gorilla/mux, Gorilla WebSocket |
| Frontend | Next.js 15, React 19, Tailwind CSS |
| Observability | OpenTelemetry, SigNoz Cloud |
| MCP | Model Context Protocol 2024-11-05, OAuth 2.1 + PKCE |
| LLM (replay) | OpenAI gpt-4o-mini via ARGUS_LLM_API_KEY |
| Auth | OAuth 2.1 Authorization Server (in-process), PKCE S256 |

---

## SigNoz Cloud Integration — Proof

### Server startup log (real credentials loaded)

```
INFO ARGUS: SigNoz Cloud credentials loaded  endpoint=https://ingest.in2.signoz.cloud  key_length=36
INFO ARGUS: OTel TracerProvider started → SigNoz Cloud  endpoint=https://ingest.in2.signoz.cloud
INFO ARGUS: OAuth 2.1 discovery base  public_base=http://localhost:8080
INFO argus: MCP server initialized  endpoint=/api/v1/mcp
INFO ARGUS server starting  addr=:8080  org_id=default
```

### Real MCP tool calls logged (each emits an OTel span)

```
INFO argus oauth: Claude Web session activated  session_id=claude-web-DpRr3vJ6jKfP  budget=10  client="Claude Web"
INFO argus mcp: tool call cost tracked  agent=claude-web-DpRr3vJ6jKfP  tool=argus_cost_status  cost=0.001  total_burn=0.003  budget=100
INFO argus mcp: tool call cost tracked  agent=claude-web-DpRr3vJ6jKfP  tool=read_file          cost=0.001  total_burn=0.004  budget=100
INFO argus mcp: tool call cost tracked  agent=claude-web-DpRr3vJ6jKfP  tool=search_code         cost=0.002  total_burn=0.006  budget=100
INFO argus mcp: tool call cost tracked  agent=claude-web-DpRr3vJ6jKfP  tool=list_directory      cost=0.001  total_burn=0.007  budget=100
INFO argus mcp: tool call cost tracked  agent=claude-web-DpRr3vJ6jKfP  tool=argus_list_agents   cost=0.001  total_burn=0.008  budget=100
```

### What ships to SigNoz

Every event above triggers a real OpenTelemetry span exported via OTLP HTTP to `https://ingest.in2.signoz.cloud`.

| Span Name | Trigger | Attributes |
|---|---|---|
| `mcp.tool_call` | Every Claude tool call | `mcp.session_id`, `mcp.tool`, `argus.tool.cost_usd`, `argus.total_burn_usd` |
| `argus.session.connect` | Claude Web OAuth approval | `argus.session_id`, `argus.client_name`, `argus.budget_limit_usd` |
| `argus.governance.violation` | Governance rule fires | `argus.rule`, `argus.severity`, `argus.action`, `argus.reason` |
| `argus.budget.exceeded` | Budget limit hit | `argus.session_id`, `argus.total_burn_usd`, `argus.budget_limit_usd` |

All spans carry `service.name = argus-control-plane` and `deployment.environment = production`.

### View in SigNoz Cloud

1. Open **https://app.in2.signoz.cloud**
2. Go to **Traces**
3. Filter: `service.name = argus-control-plane`
4. You will see `mcp.tool_call` spans — one per Claude tool call — with cost and session attributes

The Settings page at **http://localhost:3000/settings** also shows the live SigNoz connection status and links directly to the trace explorer.

### How it works (code path)

```
Claude Web calls POST /api/v1/mcp/bearer
  → appserver.go cost callback
      → telemetry.RecordMCPToolCall()          ← real OTel span
          → sdktrace.BatchSpanProcessor
              → otlptracehttp.Exporter
                  → https://ingest.in2.signoz.cloud  ← lands in SigNoz
```

Source: `pkg/query-service/argus/telemetry/tracer.go`
Bootstrapped in: `cmd/argus-server/main.go → initTracer()`

---

## Dashboard Tabs — What Each Does & Why It Matters

### 💰 Cost Firewall

**What it does**
- Shows a live burn rate chart — real cost data updated every 5 minutes from actual MCP tool calls
- Displays Current Burn Rate, Daily Total, Blocked Requests, and Active Policies in stat cards
- The orange highlight card shows the live `$x.xx/hr` burn rate across all connected agents
- Budget donut shows percentage of the $100 global limit consumed
- Enforced Policies list shows which cost rules are actively blocking

**User benefit**
- You never get surprised by a $500 OpenAI bill. ARGUS cuts the connection the moment an agent hits its budget.
- Engineers can set a $5 limit for dev, $25 for staging, $100 for prod — per session.
- The chart makes it obvious when an agent went rogue (sudden spike = runaway loop).

**Data source**: `GET /api/v1/argus/stats` — real burn from the cost firewall accumulator, not mocked.

---

### 🎯 Mission Control

**What it does**
- Shows every connected agent (Claude Web, Claude Desktop, demo agent) in a live table
- Columns: Agent ID, Status (RUNNING/PAUSED/BLOCKED/DEAD), Cost, Tokens, Latency, Last Tool
- Kill, Pause, Resume buttons send real commands via WebSocket to the agent
- Live indicator turns green when the WebSocket is connected, red when reconnecting
- Stats bar shows Total Agents, Healthy, Blocked, Live Cost, Incidents, Active Policies

**User benefit**
- You can stop a runaway Claude mid-task without touching Claude's UI.
- One click kills a session that's spending $10 analyzing the wrong directory.
- The live WebSocket stream means you see new agents appear within 1 second of connection.

**Data source**: `GET /api/v1/argus/agents` + WebSocket `ws://localhost:8080/api/v1/argus/ws`

---

### 🧬 Agent DNA

**What it does**
- Builds a behavioral fingerprint for every agent: avg cost per run, avg latency, p95 latency, tool usage distribution
- Computes an anomaly score (0–100) using Z-score deviation from the baseline
- Shows a donut chart of the anomaly score — green (normal), orange (elevated), red (high risk)
- Shows "Drift Detected" badge when an agent's behavior deviates significantly from its historical baseline
- Tool Usage Distribution bar chart shows which tools the agent calls most

**User benefit**
- Catch agents behaving unusually before they cause damage. If `search_code` suddenly runs 100x more than normal, the DNA score spikes and you see it here.
- Useful for compliance: proves agent behavior is consistent and predictable over time.
- No configuration needed — baselines are built automatically from real MCP session data.

**Data source**: `GET /api/v1/argus/dna/profiles` — derived from real MCP session telemetry.

---

### 🚨 Incidents

**What it does**
- Shows all agents currently in BLOCKED or DEAD status — these are active incidents
- Stat cards: Open Incidents, Healthy Agents, Critical Rules active
- Table shows agent ID, status pill, cost at time of incident, latency, last tool called, timestamp
- Auto-refreshes every 8 seconds

**User benefit**
- Single pane of glass for on-call engineers. If something breaks at 2am, this is the first tab you open.
- Immediately see which agent triggered the problem and what it was doing (last tool + cost).
- Distinguishes BLOCKED (budget/governance) from DEAD (killed manually or crashed).

**Data source**: Filtered from `GET /api/v1/argus/agents` — only BLOCKED and DEAD states.

---

### 📋 Policies

**What it does**
- Lists all active cost enforcement policies with their name, metric, threshold, operator, and action
- New Policy form: set a name, dollar threshold, and action (KILL_RUN / ALERT / CIRCUIT_BREAKER / TRIGGER_FALLBACK)
- Policies are stored in the backend policy engine and evaluated on every tool call

**User benefit**
- Define budget guardrails without writing code: "Block any agent spending over $10" → one form submit.
- Different actions for different thresholds: ALERT at $5, KILL_RUN at $20.
- Policies survive server restarts (persisted in memory, designed to be wired to a DB).

**Data source**: `GET/POST /api/v1/argus/cost/policies`

---

### ⚖️ Governance

**What it does**
- Shows all 9 active detection plugins with severity level and automatic action
- Each rule runs on every MCP tool call and evaluates the agent's behavior in real time
- When a rule fires, ARGUS emits an OTel span event to SigNoz and executes the recovery action

**The 9 plugins:**

| Plugin | What it detects | Why it matters |
|--------|----------------|----------------|
| Infinite Tool Loop | Same tool called >5x in a row | Claude stuck calling `read_file` forever — burning tokens and money |
| Token Explosion | Single call uses >10k tokens | Accidental "summarize the entire internet" prompt |
| Budget Exceeded | Session cost > limit | Last line of defence before billing surprise |
| Latency Spike | Response time >5x baseline | Agent calling an unresponsive service in a loop |
| Agent Stuck | No progress for >2 minutes | Deadlock or infinite wait |
| Retry Storm | Same operation retried >10x | Network blip causing exponential retry cascade |
| Repeated Prompt | Same prompt sent >3x | Memory leak — agent forgot its previous answer |
| Prompt Recursion | Prompt contains its own output | Self-referential loop that explodes context |
| Tool Timeout | Tool call exceeds 30s | External API timeout causing agent to hang |

**User benefit**
- Zero configuration needed — all 9 rules are on by default.
- Each rule has a severity (CRITICAL / HIGH / MEDIUM) and an automatic action (KILL_RUN, ALERT, etc.).
- Violations appear in SigNoz as `argus.governance.violation` spans with full context.

**Data source**: `GET /api/v1/argus/governance/rules`

---

### 🔌 Plugins

**What it does**
- **Connect tab**: One-click "Add to Claude Web" button — opens `claude.ai` with the ARGUS MCP server pre-filled. User just clicks Add.
- **5 client chips**: claude.ai (open pre-filled), Claude Code (copy CLI command), Cursor (deep link), VS Code (deep link), JSON (copy config)
- Shows the MCP endpoint URL with a copy button
- Explains the full OAuth 2.1 flow in a code block
- **Claude Desktop tab**: Shows the config file path and JSON to paste
- **All clients tab**: CLI commands and JSON configs for every supported client
- **Active MCP Sessions table**: Every connected Claude session — OAuth sessions tagged with "OAuth" pill
- **Live Tool Call Stream**: Real-time feed of every tool Claude calls — tool name, cost, latency, cumulative burn bar

**User benefit**
- No manual URL typing. One button opens Claude with everything pre-filled.
- The live stream is the "wow moment" — watch Claude's tool calls appear in real time as it works.
- Supports every MCP client: Claude Web, Claude Desktop, Claude Code CLI, Cursor, VS Code.
- Budget bar in the stream turns red when Claude approaches the limit — you see the firewall trigger.

**Data source**: OAuth 2.1 flow via `/register`, `/authorize`, `/token` + WebSocket + `GET /api/v1/mcp/sessions`

---

### ⏪ Replay

**What it does**
- Enter a Trace ID (a session ID from Mission Control or the stream)
- Optionally write a new prompt to test against
- Select a model (gpt-3.5-turbo, gpt-4o, gpt-4o-mini, claude-3-5-sonnet)
- Click Run Replay — ARGUS reconstructs the original trace and calls the real OpenAI API with your new prompt
- Shows a side-by-side diff: Original Response vs New Response
- Metrics: Latency delta, Cost delta, Semantic diff

**User benefit**
- Debug why an agent gave a wrong answer: replay the exact same context with a fixed prompt.
- Compare models: "Does gpt-4o-mini give the same answer as gpt-4o for half the cost?"
- Prompt engineering without re-running the entire agent workflow.
- Requires `ARGUS_LLM_API_KEY` or `OPENAI_API_KEY` in `.env.local` for real LLM calls.

**Data source**: `GET /api/v1/argus/replay/{trace_id}` + `POST /api/v1/argus/replay/execute`

---

### ⚙️ Settings

**What it does**
- Shows SigNoz Cloud connection status in real time (green = connected, red = not configured)
- Displays the endpoint, region, and key size to verify credentials loaded correctly
- Shows the OTel exporter config YAML you can paste into your own agents to send spans to the same SigNoz instance
- Links directly to `https://app.in2.signoz.cloud` for the trace explorer
- Shows all ARGUS URLs (backend, dashboard, MCP endpoint, OAuth discovery) with copy buttons

**User benefit**
- Instant verification that SigNoz is connected without opening a terminal.
- Copy the OTel config and paste into any other service to add it to the same observability backend.
- All connection strings in one place — no digging through `.env.local` files.

**Data source**: `GET /api/v1/argus/signoz/health` + `GET /api/v1/argus/signoz/config`
