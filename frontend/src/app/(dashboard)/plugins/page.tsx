'use client'

import { useEffect, useState, useRef } from 'react'
import {
  Puzzle, ExternalLink, DollarSign, MousePointerClick, RefreshCw,
  Terminal, FileText, Search, FolderOpen, BarChart3, Activity,
  Cpu, Bell, Globe, Braces, Code, ShieldAlert, Zap, Clock,
  Ban, CheckCircle, Copy, Check,
} from 'lucide-react'

interface MCPSession {
  id: string
  client_name: string
  client_version: string
  connected_at: string
  total_cost: number
  tool_calls: number
  budget_limit: number
  blocked: boolean
}

interface ToolCallEvent {
  type: string
  agent_id: string
  agent_name?: string
  tool: string
  tool_index: number
  cost: number
  total: number
  budget: number
  tokens: number
  latency_ms: number
  timestamp: string
}

const TOOL_ICONS: Record<string, React.ElementType> = {
  read_file: FileText, search_code: Search, list_directory: FolderOpen,
  analyze_codebase: BarChart3, run_command: Terminal, signoz_get_services: Globe,
  signoz_list_alerts: Bell, signoz_query_traces: Braces, signoz_create_dashboard: BarChart3,
  argus_list_agents: Activity, argus_agent_dna: Cpu, argus_cost_status: DollarSign,
}

const TOOL_COLORS: Record<string, string> = {
  read_file: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  search_code: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  list_directory: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  analyze_codebase: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  run_command: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  signoz_get_services: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="p-1.5 rounded hover:bg-gray-200 transition-colors text-gray-500 hover:text-gray-600">
      {copied ? <Check className="w-3.5 h-3.5 text-orange-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

const MCP_ENDPOINT = 'http://localhost:8080/api/v1/mcp'
const DESKTOP_CONFIG = JSON.stringify({ mcpServers: { argus: { url: MCP_ENDPOINT } } }, null, 2)
const BEARER_ENDPOINT = 'http://localhost:8080/api/v1/mcp/bearer'

export default function PluginsPage() {
  const [sessions, setSessions]         = useState<MCPSession[]>([])
  const [toolCalls, setToolCalls]       = useState<ToolCallEvent[]>([])
  const [connected, setConnected]       = useState(false)
  const [liveCost, setLiveCost]         = useState(0)
  const [liveCalls, setLiveCalls]       = useState(0)
  const [budgetExceeded, setBudgetExceeded] = useState(false)
  const [activeTab, setActiveTab]       = useState<'web' | 'desktop' | 'cursor'>('web')
  const callsEndRef = useRef<HTMLDivElement>(null)

  // WebSocket for live streaming
  useEffect(() => {
    let ws: WebSocket, retryDelay = 1000
    const connect = () => {
      ws = new WebSocket('ws://127.0.0.1:8080/api/v1/argus/ws')
      ws.onopen  = () => { setConnected(true); retryDelay = 1000 }
      ws.onclose = () => { setConnected(false); setTimeout(connect, retryDelay); retryDelay = Math.min(retryDelay * 2, 30000) }
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'MCP_TOOL_CALL') {
            setToolCalls(prev => [msg, ...prev].slice(0, 100))
            setLiveCost(msg.total)
            setLiveCalls(prev => prev + 1)
          }
          if (msg.type === 'MCP_EVENT') {
            if (msg.event === 'mcp_budget_exceeded') setBudgetExceeded(true)
            if (msg.event === 'mcp_client_connected') {
              setBudgetExceeded(false)
              setLiveCost(0)
              setLiveCalls(0)
              setToolCalls([])
            }
          }
        } catch {}
      }
    }
    connect()

    // Poll sessions every 5s
    const fetchSessions = () =>
      fetch('/api/argus/mcp/sessions').then(r => r.json()).then(d => setSessions(d.sessions ?? [])).catch(() => {})
    fetchSessions()
    const poll = setInterval(fetchSessions, 5000)

    return () => { ws?.close(); clearInterval(poll) }
  }, [])

  useEffect(() => { callsEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [toolCalls])

  const activeSessions = sessions.filter(s => s.client_name && !s.blocked)
  const blockedSessions = sessions.filter(s => s.blocked)

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Plugins</h1>
          <p className="text-sm text-gray-500 mt-0.5">Connect Claude to ARGUS — every tool call is governed, metered, and streamed live</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white shadow-sm border border-gray-200">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-orange-400 animate-pulse' : 'bg-red-500'}`} />
          <span className={`text-xs font-medium ${connected ? 'text-orange-600' : 'text-red-600'}`}>
            {connected ? 'Live' : 'Reconnecting'}
          </span>
        </div>
      </div>

      {/* Live stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Status',       value: budgetExceeded ? 'Blocked' : activeSessions.length > 0 ? 'Active' : 'Idle',
            color: budgetExceeded ? 'text-red-600' : activeSessions.length > 0 ? 'text-orange-600' : 'text-gray-500' },
          { label: 'Live Sessions', value: String(activeSessions.length),       color: 'text-gray-900' },
          { label: 'Tool Calls',   value: String(liveCalls),                    color: 'text-gray-900' },
          { label: 'Total Cost',   value: `$${liveCost.toFixed(4)}`,            color: budgetExceeded ? 'text-red-600' : 'text-amber-600' },
          { label: 'Blocked',      value: String(blockedSessions.length),       color: blockedSessions.length > 0 ? 'text-red-600' : 'text-gray-500' },
        ].map(s => (
          <div key={s.label} className="bg-white shadow-sm border border-gray-200 rounded-lg px-4 py-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {budgetExceeded && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <ShieldAlert className="w-6 h-6 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-base font-bold text-red-600">ARGUS Firewall: Budget Exceeded</p>
            <p className="text-sm text-red-600/80">Claude was blocked after ${liveCost.toFixed(2)} in tool calls.</p>
          </div>
        </div>
      )}

      {/* Connection options tabs */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
        {/* Tab bar */}
        <div className="border-b border-gray-200 flex">
          {([
            { id: 'web',     label: 'Claude Web (claude.ai)', badge: 'OAuth 2.1' },
            { id: 'desktop', label: 'Claude Desktop',          badge: 'Config' },
            { id: 'cursor',  label: 'Cursor / VS Code',        badge: 'Config' },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3.5 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-600'
              }`}>
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                tab.badge === 'OAuth 2.1' ? 'bg-indigo-500/20 text-indigo-600' : 'bg-gray-100 text-gray-500'
              }`}>{tab.badge}</span>
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* ── Claude Web ───────────────────────────────────────── */}
          {activeTab === 'web' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Connect Claude Web via OAuth 2.1</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Claude Web (<a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">claude.ai</a>) supports
                  remote MCP servers. When you add the ARGUS endpoint, Claude will redirect here for you to approve access and set a budget.
                  Every tool call then comes through ARGUS — governed, metered, live.
                </p>
              </div>

              {/* Step-by-step */}
              <div className="space-y-3">
                {[
                  { n: '1', title: 'Open Claude Web settings',
                    body: 'Go to claude.ai → Settings → Integrations → Add MCP Server' },
                  { n: '2', title: 'Enter the ARGUS MCP endpoint',
                    body: <div className="flex items-center gap-2 mt-1.5">
                      <code className="flex-1 bg-gray-50 border border-gray-300 rounded px-3 py-1.5 text-xs text-indigo-600 font-mono">{MCP_ENDPOINT}</code>
                      <CopyButton text={MCP_ENDPOINT} />
                    </div> },
                  { n: '3', title: 'You are redirected here',
                    body: 'Claude Web sends you to this approval page. Choose a budget and click Approve.' },
                  { n: '4', title: 'Claude gets a Bearer token',
                    body: 'ARGUS issues a real OAuth 2.1 access token. Every subsequent tool call carries it — no Desktop app required.' },
                  { n: '5', title: 'Watch it live',
                    body: 'Switch to Mission Control. You will see the session appear, cost tick up, and governance rules fire in real time.' },
                ].map(step => (
                  <div key={step.n} className="flex gap-4">
                    <div className="w-7 h-7 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-indigo-600">{step.n}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700">{step.title}</p>
                      {typeof step.body === 'string'
                        ? <p className="text-xs text-gray-500 mt-0.5">{step.body}</p>
                        : step.body}
                    </div>
                  </div>
                ))}
              </div>

              {/* What happens technically */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-1.5 text-xs font-mono">
                <p className="text-gray-600"># Claude Web discovers OAuth via</p>
                <p className="text-gray-500">GET /.well-known/oauth-authorization-server</p>
                <p className="text-gray-600 mt-2"># Registers itself (DCR)</p>
                <p className="text-gray-500">POST /register → client_id</p>
                <p className="text-gray-600 mt-2"># Starts auth flow → you approve here → code</p>
                <p className="text-gray-500">GET /authorize → /connect?request=... → POST /api/v1/argus/oauth/approve</p>
                <p className="text-gray-600 mt-2"># Exchanges code for Bearer token</p>
                <p className="text-gray-500">POST /token (PKCE S256) → rmt_at_...</p>
                <p className="text-gray-600 mt-2"># Real tool calls with auth</p>
                <p className="text-orange-600">POST /api/v1/mcp/bearer  Authorization: Bearer rmt_at_...</p>
              </div>
            </div>
          )}

          {/* ── Claude Desktop ────────────────────────────────────── */}
          {activeTab === 'desktop' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Connect Claude Desktop</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Add this to your <code className="text-indigo-600">claude_desktop_config.json</code>. Claude Desktop connects via SSE —
                  no OAuth needed, sessions appear in Mission Control automatically.
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                    Linux: <code className="text-gray-500 font-mono">~/.config/Claude/claude_desktop_config.json</code>
                  </p>
                  <CopyButton text={DESKTOP_CONFIG} />
                </div>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-600 overflow-x-auto">
                  {DESKTOP_CONFIG}
                </pre>
              </div>
              <p className="text-xs text-gray-600">macOS path: <code className="text-gray-500">~/Library/Application Support/Claude/claude_desktop_config.json</code></p>
              <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
                <Zap className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-600/80">
                  Fully quit Claude Desktop (Cmd+Q / tray → Quit) then reopen. The <strong>argus</strong> server will appear in the tool picker.
                </p>
              </div>
            </div>
          )}

          {/* ── Cursor / VS Code ──────────────────────────────────── */}
          {activeTab === 'cursor' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Connect Cursor or VS Code</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Both Cursor and VS Code Copilot support remote MCP servers via HTTP SSE.
                  Add the ARGUS endpoint in your workspace settings.
                </p>
              </div>
              <div className="space-y-4">
                {[
                  {
                    name: 'Cursor',
                    path: '.cursor/mcp.json',
                    config: JSON.stringify({ mcpServers: { argus: { url: MCP_ENDPOINT, transport: 'sse' } } }, null, 2),
                  },
                  {
                    name: 'VS Code Copilot',
                    path: '.vscode/mcp.json',
                    config: JSON.stringify({ servers: { argus: { type: 'sse', url: MCP_ENDPOINT } } }, null, 2),
                  },
                ].map(item => (
                  <div key={item.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs text-gray-500 font-semibold">{item.name} — <code className="text-gray-500">{item.path}</code></p>
                      <CopyButton text={item.config} />
                    </div>
                    <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 overflow-x-auto">{item.config}</pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active sessions */}
      {sessions.length > 0 && (
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">Active MCP Sessions</h3>
            <span className="text-xs text-gray-600">{sessions.length} total</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <th className="text-left px-5 py-2">Client</th>
                <th className="text-left px-5 py-2">Session ID</th>
                <th className="text-right px-5 py-2">Cost</th>
                <th className="text-right px-5 py-2">Calls</th>
                <th className="text-right px-5 py-2">Budget</th>
                <th className="text-center px-5 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id} className="border-b border-gray-200/50 hover:bg-gray-100/20 transition-colors">
                  <td className="px-5 py-2.5 text-xs text-gray-600 font-medium">
                    {s.client_name || <span className="text-gray-600 italic">Unknown</span>}
                    {s.client_version === 'claude-web' && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-600 border border-indigo-500/20">OAuth</span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 font-mono text-xs text-gray-500">{s.id.slice(0, 20)}…</td>
                  <td className="px-5 py-2.5 text-right font-mono text-xs text-amber-600">${(s.total_cost ?? 0).toFixed(4)}</td>
                  <td className="px-5 py-2.5 text-right text-xs text-gray-500">{s.tool_calls}</td>
                  <td className="px-5 py-2.5 text-right text-xs text-gray-500">${s.budget_limit?.toFixed(0)}</td>
                  <td className="px-5 py-2.5 text-center">
                    <span className={`inline-flex items-center gap-1 text-xs ${s.blocked ? 'text-red-600' : 'text-orange-600'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.blocked ? 'bg-red-400' : 'bg-orange-400 animate-pulse'}`} />
                      {s.blocked ? 'Blocked' : 'Live'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Live tool call stream */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-medium text-gray-900">Live Tool Call Stream</h3>
            {liveCalls > 0 && !budgetExceeded && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                <span className="text-xs text-orange-600">Live</span>
              </span>
            )}
          </div>
          <span className="text-xs text-gray-600">{toolCalls.length} events</span>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {toolCalls.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Terminal className="w-7 h-7 text-gray-700 mx-auto mb-2" />
              <p className="text-sm text-gray-600">No tool calls yet</p>
              <p className="text-xs text-gray-700 mt-1">Connect Claude Web or Desktop to see live streaming</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {toolCalls.map((call, i) => {
                const Icon = TOOL_ICONS[call.tool] || Code
                const color = TOOL_COLORS[call.tool] || 'bg-gray-100 text-gray-500 border-gray-300'
                return (
                  <div key={i} className="px-5 py-3 hover:bg-gray-100/20 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs text-gray-600 font-mono w-6 flex-shrink-0">#{call.tool_index}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${color}`}>
                          <Icon className="w-3 h-3" />{call.tool}
                        </span>
                        <span className="text-xs text-gray-600 truncate">{call.agent_id?.slice(0, 16)}…</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-gray-600">{call.latency_ms}ms</span>
                        <span className="text-xs font-mono text-amber-600">+${call.cost?.toFixed(4)}</span>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1">
                        <div className={`h-full rounded-full ${(call.total ?? 0) >= (call.budget ?? 5) ? 'bg-red-500' : 'bg-amber-500'}`}
                          style={{ width: `${Math.min(((call.total ?? 0) / (call.budget || 5)) * 100, 100)}%` }} />
                      </div>
                      <span className="text-xs font-mono text-gray-600 w-14 text-right">${call.total?.toFixed(4)}</span>
                    </div>
                  </div>
                )
              })}
              <div ref={callsEndRef} />
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
