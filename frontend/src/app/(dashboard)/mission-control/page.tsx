'use client'

import { useEffect, useState, useCallback } from 'react'
import { Activity, Pause, Play, X, Wifi, WifiOff } from 'lucide-react'

interface Agent {
  agent_id: string
  status: 'RUNNING' | 'PAUSED' | 'BLOCKED' | 'DEAD'
  current_cost: number
  current_tokens: number
  latency_ms: number
  last_tool: string
}
interface Stats {
  total_agents: number; healthy: number; blocked: number
  total_cost: number;   active_incidents: number; active_policies: number
}

const STATUS: Record<Agent['status'], { dot: string; text: string; pill: string }> = {
  RUNNING: { dot: 'bg-green-500',  text: 'text-green-700',  pill: 'pill-green' },
  PAUSED:  { dot: 'bg-yellow-500', text: 'text-yellow-700', pill: 'pill-orange' },
  BLOCKED: { dot: 'bg-red-500',    text: 'text-red-700',    pill: 'pill-red' },
  DEAD:    { dot: 'bg-gray-400',   text: 'text-gray-500',   pill: 'pill-gray' },
}

export default function MissionControlPage() {
  const [agents, setAgents]     = useState<Agent[]>([])
  const [stats, setStats]       = useState<Stats | null>(null)
  const [ws, setWs]             = useState(false)
  const [lastEvent, setLastEvent] = useState('')

  const fetchAgents = useCallback(async () => {
    try { const r = await fetch('/api/argus/agents'); if (r.ok) setAgents(await r.json()) } catch {}
  }, [])
  const fetchStats = useCallback(async () => {
    try { const r = await fetch('/api/argus/stats'); if (r.ok) setStats(await r.json()) } catch {}
  }, [])

  useEffect(() => {
    fetchAgents(); fetchStats()
    const poll = setInterval(() => { fetchAgents(); fetchStats() }, 5000)
    let retry = 1000, socket: WebSocket
    const connect = () => {
      socket = new WebSocket('wss://argus-production-d368.up.railway.app/api/v1/argus/ws')
      socket.onopen  = () => { setWs(true); retry = 1000 }
      socket.onclose = () => { setWs(false); setTimeout(connect, retry); retry = Math.min(retry * 2, 30000) }
      socket.onmessage = (e) => {
        try {
          const m = JSON.parse(e.data)
          if (m.type === 'AGENTS_UPDATE') setAgents(m.agents ?? [])
          if (m.type === 'MCP_TOOL_CALL') { setLastEvent(`${m.tool}  $${m.total?.toFixed(4)}`); setStats(p => p ? { ...p, total_cost: m.total } : p) }
        } catch {}
      }
    }
    connect()
    return () => { clearInterval(poll); socket?.close() }
  }, [fetchAgents, fetchStats])

  const action = async (id: string, act: string) => {
    await fetch(`/api/argus/agents/${id}/${act}`, { method: 'POST' })
    setTimeout(fetchAgents, 300)
  }

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mission Control</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time AI agent oversight &amp; enforcement.</p>
        </div>
        <div className="flex items-center gap-3">
          {lastEvent && (
            <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-full font-mono">
              {lastEvent}
            </span>
          )}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
            ws ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'
          }`}>
            {ws ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {ws ? 'Live' : 'Reconnecting…'}
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-6 gap-3 mb-6">
          {[
            { l: 'Total Agents', v: stats.total_agents, hi: false },
            { l: 'Healthy',      v: stats.healthy,          hi: false },
            { l: 'Blocked',      v: stats.blocked,          hi: stats.blocked > 0 },
            { l: 'Live Cost',    v: `$${(stats.total_cost ?? 0).toFixed(2)}`, hi: false },
            { l: 'Incidents',    v: stats.active_incidents,  hi: stats.active_incidents > 0 },
            { l: 'Policies',     v: stats.active_policies,   hi: false },
          ].map(s => (
            <div key={s.l} className="stat-card text-center">
              <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">{s.l}</p>
              <p className={`text-2xl font-bold mt-1 ${s.hi ? 'text-orange-600' : 'text-gray-900'}`}>{s.v}</p>
            </div>
          ))}
        </div>
      )}

      {/* Agents table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-orange-600" />
            <h2 className="text-sm font-semibold text-gray-800">Live Agents</h2>
          </div>
          <span className="text-xs text-gray-400">{agents.length} registered</span>
        </div>

        {agents.length === 0 ? (
          <div className="py-16 text-center">
            <Activity className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No agents reporting yet.</p>
            <p className="text-xs text-gray-400 mt-1">Connect Claude via MCP or run the demo agent.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {['Agent ID', 'Status', 'Cost', 'Tokens', 'Latency', 'Last Tool', 'Actions'].map(h => (
                  <th key={h} className={h === 'Actions' ? 'text-right' : ''}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map(a => {
                const s = STATUS[a.status] ?? STATUS.DEAD
                return (
                  <tr key={a.agent_id}>
                    <td className="font-mono text-xs text-gray-600">{a.agent_id.slice(0, 20)}…</td>
                    <td>
                      <span className={`pill ${s.pill}`}>
                        <span className={`pill-dot ${s.dot}`} />
                        {a.status}
                      </span>
                    </td>
                    <td className="font-mono text-xs font-semibold text-orange-600">${(a.current_cost ?? 0).toFixed(4)}</td>
                    <td className="text-xs text-gray-500">{(a.current_tokens ?? 0).toLocaleString()}</td>
                    <td className="text-xs text-gray-500">{a.latency_ms}ms</td>
                    <td className="text-xs text-gray-400 max-w-[120px] truncate">{a.last_tool || '—'}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {a.status === 'RUNNING' && (
                          <button onClick={() => action(a.agent_id, 'pause')}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100 transition-colors">
                            <Pause className="w-3 h-3" /> Pause
                          </button>
                        )}
                        {a.status === 'PAUSED' && (
                          <button onClick={() => action(a.agent_id, 'resume')}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors">
                            <Play className="w-3 h-3" /> Resume
                          </button>
                        )}
                        {a.status !== 'DEAD' && (
                          <button onClick={() => action(a.agent_id, 'kill')}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors">
                            <X className="w-3 h-3" /> Kill
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
