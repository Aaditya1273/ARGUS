'use client'
import { useEffect, useState, useCallback } from 'react'
import { Shield, TrendingUp, DollarSign, Activity, AlertTriangle, BarChart3, Radio, Play, Pause, Skull } from 'lucide-react'

interface AgentState { agent_id: string; status: 'RUNNING' | 'PAUSED' | 'BLOCKED' | 'DEAD'; current_cost: number; current_tokens: number; latency_ms: number; last_tool: string }
interface SystemStats { total_agents: number; healthy: number; blocked: number; total_cost: number; active_incidents: number; active_policies: number }

const SC: Record<string, { color: string; bg: string; dot: string; label: string }> = {
  RUNNING: { color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500', label: 'Running' },
  PAUSED:  { color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500', label: 'Paused' },
  BLOCKED: { color: 'text-red-600', bg: 'bg-red-50 border-red-200', dot: 'bg-red-500', label: 'Blocked' },
  DEAD:    { color: 'text-gray-500', bg: 'bg-gray-50 border-gray-200', dot: 'bg-gray-400', label: 'Dead' },
}

export default function MissionControlPage() {
  const [agents, setAgents] = useState<AgentState[]>([])
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [connected, setConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState('')

  const fetchAgents = useCallback(async () => {
    try { const res = await fetch('/api/argus/agents'); if (res.ok) setAgents(Array.isArray(await res.json()) ? await res.json() : []) } catch {}
  }, [])
  const fetchStats = useCallback(async () => {
    try { const res = await fetch('/api/argus/stats'); if (res.ok) setStats(await res.json()) } catch {}
  }, [])

  useEffect(() => {
    fetchAgents(); fetchStats()
    const poll = setInterval(() => { fetchAgents(); fetchStats() }, 5000)
    let ws: WebSocket; let retry = 1000
    const connect = () => {
      ws = new WebSocket('ws://127.0.0.1:8080/api/v1/argus/ws')
      ws.onopen = () => { setConnected(true); retry = 1000 }
      ws.onclose = () => { setConnected(false); setTimeout(connect, retry); retry = Math.min(retry * 2, 30000) }
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'AGENTS_UPDATE' && Array.isArray(msg.agents)) setAgents(msg.agents)
          if (msg.type === 'MCP_TOOL_CALL') { setLastEvent(`Claude called: ${msg.tool} ($${msg.total?.toFixed(4)})`); setStats((p) => p ? { ...p, total_cost: msg.total } : p) }
          if (msg.type === 'MCP_EVENT') setLastEvent(`MCP: ${msg.event}`)
        } catch {}
      }
    }
    connect()
    return () => { clearInterval(poll); ws?.close() }
  }, [fetchAgents, fetchStats])

  const agentAction = async (id: string, action: string) => { await fetch(`/api/argus/agents/${id}/${action}`, { method: 'POST' }); setTimeout(fetchAgents, 300) }

  return (
    <div className="p-6 space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight"><span className="gradient-text">Mission Control</span></h1>
          <p className="text-sm text-gray-500 mt-0.5">Real-time AI agent oversight &amp; enforcement</p>
        </div>
        <div className="flex items-center gap-4">
          {lastEvent && <span className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-2xl font-mono backdrop-blur-sm"><Radio className="w-3 h-3 inline mr-1.5" />{lastEvent}</span>}
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-white/80 backdrop-blur-xl border border-black/[0.04] shadow-sm">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-orange-500 animate-pulse' : 'bg-red-500'}`} />
            <span className={`text-xs font-medium ${connected ? 'text-orange-600' : 'text-red-600'}`}>{connected ? 'Live' : 'Reconnecting…'}</span>
          </div>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 stagger-children">
          {[
            { label: 'Total Agents', value: stats.total_agents, color: 'text-[#1d1d1f]', icon: Activity, gradient: 'from-indigo-100 to-purple-50' },
            { label: 'Healthy', value: stats.healthy, color: 'text-orange-600', icon: Shield, gradient: 'from-orange-100 to-amber-50' },
            { label: 'Blocked', value: stats.blocked, color: 'text-red-600', icon: AlertTriangle, gradient: 'from-red-100 to-rose-50' },
            { label: 'Live Cost', value: `$${(stats.total_cost ?? 0).toFixed(4)}`, color: 'text-amber-600', icon: DollarSign, gradient: 'from-amber-100 to-orange-50' },
            { label: 'Incidents', value: stats.active_incidents, color: 'text-red-600', icon: TrendingUp, gradient: 'from-red-100 to-pink-50' },
            { label: 'Policies', value: stats.active_policies, color: 'text-indigo-600', icon: BarChart3, gradient: 'from-indigo-100 to-purple-50' },
          ].map((s) => (
            <div key={s.label} className="bg-white/80 backdrop-blur-2xl rounded-3xl border border-black/[0.04] p-4 shadow-sm hover:shadow-xl hover:bg-white/95 transition-all duration-300 group">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">{s.label}</p>
                <div className={`w-8 h-8 rounded-2xl bg-gradient-to-br ${s.gradient} border border-black/[0.04] flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                  <s.icon className="w-4 h-4 text-gray-500" />
                </div>
              </div>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white/80 backdrop-blur-2xl rounded-3xl border border-black/[0.04] overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-black/[0.04] flex items-center justify-between">
          <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-500" /><h2 className="text-sm font-medium text-[#1d1d1f]">Live Agents</h2></div>
          <span className="text-xs text-gray-500 bg-black/[0.02] px-2 py-1 rounded-xl">{agents.length} registered</span>
        </div>
        {agents.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="w-12 h-12 rounded-3xl bg-gradient-to-br from-indigo-100 to-purple-50 border border-black/[0.04] flex items-center justify-center mx-auto mb-4"><Activity className="w-6 h-6 text-gray-400" /></div>
            <p className="text-sm text-gray-500">No agents reporting yet.</p>
            <p className="text-xs text-gray-400 mt-1">Connect Claude via MCP or run the demo agent.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm glass-table">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-medium">Agent ID</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-right px-5 py-3 font-medium">Cost</th>
                  <th className="text-right px-5 py-3 font-medium">Tokens</th>
                  <th className="text-right px-5 py-3 font-medium">Latency</th>
                  <th className="text-left px-5 py-3 font-medium">Last Tool</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => {
                  const sc = SC[a.status]
                  return (
                    <tr key={a.agent_id} className="transition-colors duration-150">
                      <td className="px-5 py-3 font-mono text-xs text-gray-600">{a.agent_id}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-2xl border ${sc.bg} ${sc.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot} animate-pulse`} />{sc.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-amber-600 font-mono text-xs font-medium">${(a.current_cost ?? 0).toFixed(4)}</td>
                      <td className="px-5 py-3 text-right text-gray-500 font-mono text-xs">{(a.current_tokens ?? 0).toLocaleString()}</td>
                      <td className="px-5 py-3 text-right text-gray-500 font-mono text-xs">{a.latency_ms}ms</td>
                      <td className="px-5 py-3 text-gray-500 text-xs truncate max-w-32">{a.last_tool || '—'}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {a.status === 'RUNNING' && <button onClick={() => agentAction(a.agent_id, 'pause')} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-2xl hover:bg-amber-100 transition-all duration-200"><Pause className="w-3 h-3" /> Pause</button>}
                          {a.status === 'PAUSED' && <button onClick={() => agentAction(a.agent_id, 'resume')} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded-2xl hover:bg-orange-100 transition-all duration-200"><Play className="w-3 h-3" /> Resume</button>}
                          {a.status !== 'DEAD' && <button onClick={() => agentAction(a.agent_id, 'kill')} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-2xl hover:bg-red-100 transition-all duration-200"><Skull className="w-3 h-3" /> Kill</button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
