'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Terminal, FileText, Search, FolderOpen, BarChart3, Activity, Cpu, Bell, Globe, Braces, Code, DollarSign, Copy, Check, ExternalLink, Plug, AlertTriangle } from 'lucide-react'

// ─── Constants ───────────────────────────────────────────────────────────────
const MCP_URL    = 'https://argus-production-d368.up.railway.app/api/v1/mcp'
const CARD_NAME  = 'argus'
const claudeLink = `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=${encodeURIComponent(CARD_NAME)}&connectorUrl=${encodeURIComponent(MCP_URL)}`
const cursorLink = `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(CARD_NAME)}&config=${typeof window !== 'undefined' ? btoa(JSON.stringify({ url: MCP_URL })) : ''}`
const vscodeLink = `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: CARD_NAME, type: 'http', url: MCP_URL }))}`
const claudeCode = `claude mcp add --transport http ${CARD_NAME} ${MCP_URL}`
const desktopCfg = JSON.stringify({ mcpServers: { [CARD_NAME]: { url: MCP_URL } } }, null, 2)
const cursorCfg  = JSON.stringify({ mcpServers: { [CARD_NAME]: { url: MCP_URL, transport: 'sse' } } }, null, 2)
const vscodeCfg  = JSON.stringify({ servers: { [CARD_NAME]: { type: 'sse', url: MCP_URL } } }, null, 2)
const genericCfg = JSON.stringify({ mcpServers: { [CARD_NAME]: { type: 'http', url: MCP_URL } } }, null, 2)

// ─── Tool decorators ──────────────────────────────────────────────────────────
const ICONS: Record<string, React.ElementType> = {
  read_file: FileText, search_code: Search, list_directory: FolderOpen, analyze_codebase: BarChart3,
  run_command: Terminal, signoz_get_services: Globe, signoz_list_alerts: Bell,
  signoz_query_traces: Braces, argus_list_agents: Activity, argus_agent_dna: Cpu, argus_cost_status: DollarSign,
}
const TOOL_COLOR: Record<string, string> = {
  read_file: 'bg-blue-50 text-blue-700 border-blue-200', search_code: 'bg-purple-50 text-purple-700 border-purple-200',
  list_directory: 'bg-cyan-50 text-cyan-700 border-cyan-200', analyze_codebase: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  run_command: 'bg-orange-50 text-orange-700 border-orange-200', signoz_get_services: 'bg-green-50 text-green-700 border-green-200',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function CopyBtn({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [c, setC] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setC(true); setTimeout(() => setC(false), 1500) }}
      className="btn-ghost text-xs px-3 py-1.5">
      {c ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
      {c ? 'Copied!' : label}
    </button>
  )
}

function CodeBox({ code }: { code: string }) {
  return (
    <div className="relative group code-block text-[12px]">
      <pre className="pr-16 whitespace-pre-wrap">{code}</pre>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => navigator.clipboard.writeText(code)}
          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 transition-colors">
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Connect chips ────────────────────────────────────────────────────────────
function Chips() {
  const [done, setDone] = useState<string | null>(null)
  const cp = (k: string, t: string) => () => { navigator.clipboard.writeText(t); setDone(k); setTimeout(() => setDone(x => x === k ? null : x), 1500) }
  const go = (href: string) => () => window.open(href, '_blank', 'noopener')
  const chips = [
    { k: 'cai', l: 'claude.ai',   t: 'Opens Add Connector pre-filled', g: 'open' as const, a: go(claudeLink) },
    { k: 'cc',  l: 'Claude Code', t: 'Copy claude mcp add command',    g: 'copy' as const, a: cp('cc', claudeCode) },
    { k: 'cur', l: 'Cursor',      t: "Open Cursor's install prompt",   g: 'open' as const, a: () => { window.location.href = cursorLink } },
    { k: 'vsc', l: 'VS Code',     t: "Open VS Code's install prompt",  g: 'open' as const, a: () => { window.location.href = vscodeLink } },
    { k: 'jsn', l: 'JSON',        t: 'Copy mcpServers JSON',           g: 'copy' as const, a: cp('jsn', genericCfg) },
  ]
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Add to Your Agent</p>
      <div className="grid grid-cols-5 gap-2">
        {chips.map(c => (
          <button key={c.k} onClick={c.a} title={c.t}
            className={`flex flex-col items-center justify-center gap-2 py-4 px-2 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
              done === c.k ? 'border-green-300 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700'
            }`}>
            {done === c.k ? <Check className="w-4 h-4" /> : c.g === 'open' ? <ExternalLink className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {c.l}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-gray-400 mt-2">Arrow opens that app prefilled · rest copy an install command</p>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
interface Session { id: string; client_name: string; client_version: string; total_cost: number; tool_calls: number; budget_limit: number; blocked: boolean }
interface ToolCall { tool: string; tool_index: number; cost: number; total: number; budget: number; latency_ms: number; agent_id: string }

export default function PluginsPage() {
  const [sessions, setSessions]  = useState<Session[]>([])
  const [calls, setCalls]        = useState<ToolCall[]>([])
  const [live, setLive]          = useState(false)
  const [cost, setCost]          = useState(0)
  const [n, setN]                = useState(0)
  const [blocked, setBlocked]    = useState(false)
  const [tab, setTab]            = useState<'connect' | 'desktop' | 'all'>('connect')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let ws: WebSocket, delay = 1000
    const conn = () => {
      ws = new WebSocket('wss://argus-production-d368.up.railway.app/api/v1/argus/ws')
      ws.onopen  = () => { setLive(true); delay = 1000 }
      ws.onclose = () => { setLive(false); setTimeout(conn, delay); delay = Math.min(delay * 2, 30000) }
      ws.onmessage = (e) => {
        try {
          const m = JSON.parse(e.data)
          if (m.type === 'MCP_TOOL_CALL') { setCalls(p => [m, ...p].slice(0, 100)); setCost(m.total); setN(p => p + 1) }
          if (m.type === 'MCP_EVENT') {
            if (m.event === 'mcp_budget_exceeded') setBlocked(true)
            if (m.event === 'mcp_client_connected') { setBlocked(false); setCost(0); setN(0); setCalls([]) }
          }
        } catch {}
      }
    }
    conn()
    const poll = () => fetch('/api/argus/mcp/sessions').then(r => r.json()).then(d => setSessions(d.sessions ?? [])).catch(() => {})
    poll(); const t = setInterval(poll, 5000)
    return () => { ws?.close(); clearInterval(t) }
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [calls])

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fadeIn">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plugins</h1>
          <p className="text-sm text-gray-500 mt-1">Connect Claude to ARGUS — every tool call is governed, metered, and streamed live</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
          live ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-green-500' : 'bg-red-500'}`} />
          {live ? 'Streaming Live' : 'Reconnecting…'}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { l: 'STATUS',     v: blocked ? 'Blocked' : n > 0 ? 'Active' : 'Idle', hi: blocked },
          { l: 'TOOL CALLS', v: String(n), hi: false },
          { l: 'TOTAL COST', v: `$${cost.toFixed(4)}`, hi: blocked },
          { l: 'BLOCKED',    v: String(sessions.filter(s => s.blocked).length), hi: sessions.some(s => s.blocked) },
        ].map(s => (
          <div key={s.l} className="stat-card">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">{s.l}</p>
            <p className={`text-2xl font-bold ${s.hi ? 'text-orange-600' : 'text-gray-900'}`}>{s.v}</p>
          </div>
        ))}
      </div>

      {blocked && (
        <div className="mb-6 flex items-center gap-3 px-5 py-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold">ARGUS Firewall: Budget Exceeded</p>
            <p className="text-xs text-red-500">Claude blocked after ${cost.toFixed(2)} in tool calls.</p>
          </div>
        </div>
      )}

      {/* Main card */}
      <div className="card overflow-hidden mb-5">
        {/* Tab bar */}
        <div className="border-b border-gray-100 flex bg-gray-50">
          {([
            { id: 'connect', label: 'Connect', sub: 'One click' },
            { id: 'desktop', label: 'Claude Desktop', sub: 'Config file' },
            { id: 'all',     label: 'All clients', sub: 'CLI + JSON' },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-6 py-3.5 text-sm font-medium flex flex-col items-start border-b-2 transition-colors ${
                tab === t.id ? 'border-orange-500 text-orange-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}>
              <span>{t.label}</span>
              <span className="text-[10px] text-gray-400 font-normal">{t.sub}</span>
            </button>
          ))}
        </div>

        <div className="p-7 space-y-6">
          {tab === 'connect' && (
            <>
              {/* URL bar */}
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <span className="text-xs font-medium text-gray-500 flex-shrink-0">MCP Endpoint</span>
                <code className="flex-1 text-sm text-orange-600 font-mono truncate">{MCP_URL}</code>
                <CopyBtn text={MCP_URL} />
              </div>

              {/* Big Add to Claude button */}
              <div className="text-center space-y-2">
                <a href={claudeLink} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-8 py-4 rounded-full btn-orange text-base shadow-lg shadow-orange-500/20 hover:scale-105 transition-all">
                  <ExternalLink className="w-5 h-5" />
                  Add to Claude Web
                  <span className="text-sm font-normal text-orange-200">claude.ai opens pre-filled</span>
                </a>
                <p className="text-xs text-gray-400">
                  Opens claude.ai → Integrations → Add Custom Connector — already filled in. Just click <b className="text-gray-500">Add</b>.
                </p>
              </div>

              <hr className="border-gray-100" />
              <Chips />

              {/* OAuth flow explanation */}
              <div className="code-block space-y-1">
                <p className="text-gray-500 text-[11px] font-semibold uppercase tracking-widest mb-2">How Claude Web connects (OAuth 2.1)</p>
                {[
                  ['1.', 'Claude Web reads', '/.well-known/oauth-authorization-server'],
                  ['2.', 'Claude registers →', 'POST /register → client_id'],
                  ['3.', 'You are redirected to', '/connect to approve + set budget'],
                  ['4.', 'ARGUS issues', 'rmt_at_… Bearer token via PKCE S256'],
                  ['5.', 'Every tool call →', 'POST /api/v1/mcp/bearer  Authorization: Bearer rmt_at_…'],
                ].map(([n, a, b]) => (
                  <p key={n} className="text-[12px]">
                    <span className="text-gray-600">{n} </span>
                    <span className="text-gray-400">{a} </span>
                    <span className="text-orange-400">{b}</span>
                  </p>
                ))}
              </div>
            </>
          )}

          {tab === 'desktop' && (
            <>
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-1">Claude Desktop</h2>
                <p className="text-sm text-gray-500">Add to your <code className="text-orange-600">claude_desktop_config.json</code>. Connects via SSE — no OAuth needed.</p>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs text-gray-500">Linux: <code className="text-gray-600">~/.config/Claude/claude_desktop_config.json</code></p>
                </div>
                <CodeBox code={desktopCfg} />
              </div>
              <p className="text-xs text-gray-400">macOS: <code>~/Library/Application Support/Claude/claude_desktop_config.json</code></p>
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-orange-50 border border-orange-200">
                <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-orange-700">Fully quit Claude Desktop then reopen. The <b>argus</b> server appears in the tool picker.</p>
              </div>
            </>
          )}

          {tab === 'all' && (
            <div className="space-y-5">
              {[
                { l: 'Claude Code (CLI)', code: claudeCode, note: 'Run in your terminal' },
                { l: 'Cursor (.cursor/mcp.json)', code: cursorCfg, note: 'Or use the Cursor button' },
                { l: 'VS Code (.vscode/mcp.json)', code: vscodeCfg, note: 'Or use the VS Code button' },
                { l: 'Generic JSON', code: genericCfg, note: 'Any MCP client' },
              ].map(item => (
                <div key={item.l} className="space-y-1.5">
                  <div className="flex justify-between">
                    <p className="text-xs font-semibold text-gray-600">{item.l}</p>
                    <p className="text-xs text-gray-400">{item.note}</p>
                  </div>
                  <CodeBox code={item.code} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sessions */}
      {sessions.length > 0 && (
        <div className="card overflow-hidden mb-5">
          <div className="px-5 py-3.5 border-b border-gray-100 flex justify-between">
            <div className="flex items-center gap-2">
              <Plug className="w-4 h-4 text-orange-600" />
              <h3 className="text-sm font-semibold text-gray-800">Active MCP Sessions</h3>
            </div>
            <span className="text-xs text-gray-400">{sessions.length} total</span>
          </div>
          <table className="data-table">
            <thead><tr><th>Client</th><th>Session</th><th className="text-right">Cost</th><th className="text-right">Calls</th><th className="text-right">Budget</th><th className="text-center">Status</th></tr></thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id}>
                  <td className="font-medium text-gray-800">
                    {s.client_name || <span className="text-gray-400 italic">Unknown</span>}
                    {s.client_version === 'claude-web' && <span className="ml-2 pill pill-orange text-[10px]">OAuth</span>}
                  </td>
                  <td className="font-mono text-xs text-gray-400">{s.id.slice(0, 18)}…</td>
                  <td className="text-right font-mono text-xs font-semibold text-orange-600">${(s.total_cost ?? 0).toFixed(4)}</td>
                  <td className="text-right text-xs text-gray-500">{s.tool_calls}</td>
                  <td className="text-right text-xs text-gray-500">${(s.budget_limit ?? 0).toFixed(0)}</td>
                  <td className="text-center">
                    <span className={`pill ${s.blocked ? 'pill-red' : 'pill-green'}`}>
                      <span className={`pill-dot ${s.blocked ? 'bg-red-500' : 'bg-green-500'}`} />
                      {s.blocked ? 'Blocked' : 'Live'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stream */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-800">Live Tool Call Stream</h3>
            {n > 0 && !blocked && (
              <span className="pill pill-green text-[10px]"><span className="pill-dot bg-green-500" />Live</span>
            )}
          </div>
          <span className="text-xs text-gray-400">{calls.length} events</span>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {calls.length === 0 ? (
            <div className="py-12 text-center">
              <Terminal className="w-7 h-7 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No tool calls yet</p>
              <p className="text-xs text-gray-300 mt-1">Connect Claude to see live streaming here</p>
            </div>
          ) : (
            <div>
              {calls.map((c, i) => {
                const Icon = ICONS[c.tool] || Code
                const cls  = TOOL_COLOR[c.tool] || 'bg-gray-100 text-gray-600 border-gray-200'
                return (
                  <div key={i} className="px-5 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-gray-400 font-mono w-6">#{c.tool_index}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
                          <Icon className="w-3 h-3" />{c.tool}
                        </span>
                        <span className="text-xs text-gray-400 truncate max-w-[120px]">{c.agent_id?.slice(0, 16)}…</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">{c.latency_ms}ms</span>
                        <span className="text-xs font-mono font-semibold text-orange-600">+${c.cost?.toFixed(4)}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 progress-track h-1.5">
                        <div className={`h-full rounded-full transition-all ${(c.total ?? 0) >= (c.budget ?? 5) ? 'bg-red-500' : 'bg-orange-500'}`}
                          style={{ width: `${Math.min(((c.total ?? 0) / (c.budget || 5)) * 100, 100)}%` }} />
                      </div>
                      <span className="text-[11px] font-mono text-gray-400 w-14 text-right">${c.total?.toFixed(4)}</span>
                    </div>
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
