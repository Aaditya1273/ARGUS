'use client'

import { useEffect, useState, useCallback } from 'react'

interface AgentState {
  agent_id: string
  status: 'RUNNING' | 'PAUSED' | 'BLOCKED' | 'DEAD'
  current_cost: number
  current_tokens: number
  latency_ms: number
  last_tool: string
}

interface SystemStats {
  total_agents: number
  healthy: number
  blocked: number
  total_cost: number
  active_incidents: number
  active_policies: number
}

const STATUS_COLORS: Record<AgentState['status'], string> = {
  RUNNING: 'bg-orange-500',
  PAUSED: 'bg-amber-400',
  BLOCKED: 'bg-red-500',
  DEAD: 'bg-gray-600',
}

const STATUS_TEXT: Record<AgentState['status'], string> = {
  RUNNING: 'text-orange-600',
  PAUSED: 'text-amber-600',
  BLOCKED: 'text-red-600',
  DEAD: 'text-gray-500',
}

export default function MissionControlPage() {
  const [agents, setAgents] = useState<AgentState[]>([])
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [connected, setConnected] = useState(false)

  const PROXY_BASE = '/api/argus'

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`${PROXY_BASE}/agents`)
      if (res.ok) setAgents(await res.json())
    } catch {}
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${PROXY_BASE}/stats`)
      if (res.ok) setStats(await res.json())
    } catch {}
  }, [])

  useEffect(() => {
    fetchAgents()
    fetchStats()

    let ws: WebSocket
    let retryDelay = 1000

    const connect = () => {
      // Connect WebSocket directly to the Go backend at port 8080
      ws = new WebSocket(`ws://127.0.0.1:8080/api/v1/argus/ws`)
      ws.onopen = () => { setConnected(true); retryDelay = 1000 }
      ws.onclose = () => {
        setConnected(false)
        setTimeout(connect, retryDelay)
        retryDelay = Math.min(retryDelay * 2, 30000)
      }
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          // Handle AGENTS_UPDATE from the Go backend
          if (msg.type === 'AGENTS_UPDATE' && Array.isArray(msg.agents)) {
            setAgents(msg.agents)
          }
          // Handle MCP_TOOL_CALL events -> update stats
          if (msg.type === 'MCP_TOOL_CALL' && msg.total !== undefined) {
            setStats((prev) => prev ? { ...prev, total_cost: msg.total } : prev)
          }
          // Handle agent_state from older format
          if (msg.type === 'agent_state' && msg.data) {
            setAgents((prev) => {
              const idx = prev.findIndex((a) => a.agent_id === msg.data.agent_id)
              if (idx === -1) return [...prev, msg.data]
              const next = [...prev]
              next[idx] = msg.data
              return next
            })
          }
        } catch {}
      }
    }

    connect()
    return () => { ws?.close() }
  }, [fetchAgents, fetchStats])

  const agentAction = async (agentId: string, action: string) => {
    await fetch(`${PROXY_BASE}/agents/${agentId}/${action}`, { method: 'POST' })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Mission Control</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real-time AI agent oversight &amp; enforcement</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-orange-400 animate-pulse' : 'bg-red-500'}`} />
          <span className={connected ? 'text-orange-600' : 'text-red-600'}>
            {connected ? 'Live' : 'Reconnecting'}
          </span>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Agents', value: stats.total_agents, color: 'text-gray-900' },
            { label: 'Healthy', value: stats.healthy, color: 'text-orange-600' },
            { label: 'Blocked', value: stats.blocked, color: 'text-red-600' },
            { label: 'Live Cost', value: `$${stats.total_cost.toFixed(2)}`, color: 'text-amber-600' },
            { label: 'Incidents', value: stats.active_incidents, color: 'text-red-600' },
            { label: 'Policies', value: stats.active_policies, color: 'text-indigo-600' },
          ].map((s) => (
            <div key={s.label} className="bg-white shadow-sm border border-gray-200 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-medium text-gray-600">Live Agents</h2>
        </div>
        {agents.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-600 text-sm">No agents reporting</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <th className="text-left px-4 py-2">Agent ID</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Cost</th>
                <th className="text-right px-4 py-2">Tokens</th>
                <th className="text-right px-4 py-2">Latency</th>
                <th className="text-left px-4 py-2">Last Tool</th>
                <th className="text-right px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.agent_id} className="border-b border-gray-200/50 hover:bg-gray-100/30 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{agent.agent_id.slice(0, 12)}…</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${STATUS_TEXT[agent.status]}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[agent.status]}`} />
                      {agent.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-amber-600 font-mono text-xs">${agent.current_cost.toFixed(4)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500 font-mono text-xs">{agent.current_tokens.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500 font-mono text-xs">{agent.latency_ms}ms</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs truncate max-w-32">{agent.last_tool || '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {agent.status === 'RUNNING' && (
                        <button onClick={() => agentAction(agent.agent_id, 'pause')}
                          className="px-2 py-0.5 text-xs bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded hover:bg-amber-500/20 transition-colors">
                          Pause
                        </button>
                      )}
                      {agent.status === 'PAUSED' && (
                        <button onClick={() => agentAction(agent.agent_id, 'resume')}
                          className="px-2 py-0.5 text-xs bg-orange-500/10 text-orange-600 border border-orange-500/20 rounded hover:bg-orange-500/20 transition-colors">
                          Resume
                        </button>
                      )}
                      <button onClick={() => agentAction(agent.agent_id, 'kill')}
                        className="px-2 py-0.5 text-xs bg-red-500/10 text-red-600 border border-red-500/20 rounded hover:bg-red-500/20 transition-colors">
                        Kill
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
