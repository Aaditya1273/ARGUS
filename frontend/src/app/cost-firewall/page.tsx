'use client'

import { useEffect, useState } from 'react'

interface Policy {
  id: string
  name: string
  type: 'BUDGET_CAP' | 'RATE_LIMIT' | 'TOOL_BAN' | 'CIRCUIT_BREAKER'
  threshold: number
  current: number
  unit: string
  action: 'WARN' | 'PAUSE' | 'KILL'
  triggered_count: number
  last_triggered?: string
}

interface BurnEvent {
  agent_id: string
  timestamp: string
  cost: number
  tokens: number
  model: string
  action_taken?: string
}

export default function CostFirewallPage() {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [events, setEvents] = useState<BurnEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [pRes, eRes] = await Promise.all([
          fetch('/api/argus/policies'),
          fetch('/api/argus/cost/events'),
        ])
        if (pRes.ok) setPolicies(await pRes.json())
        if (eRes.ok) setEvents(await eRes.json())
      } catch (e) {
        setError('Failed to load cost firewall data')
      } finally {
        setLoading(false)
      }
    }
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [])

  const ACTION_COLORS = {
    WARN: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    PAUSE: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    KILL: 'text-red-400 bg-red-500/10 border-red-500/20',
  }

  const TYPE_LABELS = {
    BUDGET_CAP: 'Budget Cap',
    RATE_LIMIT: 'Rate Limit',
    TOOL_BAN: 'Tool Ban',
    CIRCUIT_BREAKER: 'Circuit Breaker',
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Cost Firewall</h1>
        <p className="text-sm text-gray-500 mt-0.5">Real-time budget enforcement and spend controls</p>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Active Policies */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-300">Active Policies</h2>
          <span className="text-xs text-gray-600">{policies.length} policies</span>
        </div>
        {policies.length === 0 ? (
          <div className="px-4 py-10 text-center text-gray-600 text-sm">No policies configured</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {policies.map((p) => {
              const pct = Math.min((p.current / p.threshold) * 100, 100)
              return (
                <div key={p.id} className="px-4 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-white">{p.name}</span>
                      <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded">{TYPE_LABELS[p.type]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded border ${ACTION_COLORS[p.action]}`}>{p.action}</span>
                      <span className="text-xs text-gray-500">{p.triggered_count}x triggered</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 font-mono whitespace-nowrap">
                      {p.current.toFixed(2)} / {p.threshold} {p.unit}
                    </span>
                    <span className="text-xs text-gray-600">{pct.toFixed(0)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Recent Burn Events */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-medium text-gray-300">Recent Cost Events</h2>
        </div>
        {events.length === 0 ? (
          <div className="px-4 py-10 text-center text-gray-600 text-sm">No events recorded</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
                <th className="text-left px-4 py-2">Time</th>
                <th className="text-left px-4 py-2">Agent</th>
                <th className="text-left px-4 py-2">Model</th>
                <th className="text-right px-4 py-2">Cost</th>
                <th className="text-right px-4 py-2">Tokens</th>
                <th className="text-left px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e, i) => (
                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                  <td className="px-4 py-2 text-xs text-gray-500">{new Date(e.timestamp).toLocaleTimeString()}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-400">{e.agent_id.slice(0, 10)}…</td>
                  <td className="px-4 py-2 text-xs text-gray-400">{e.model}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-amber-400">${e.cost.toFixed(4)}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-gray-400">{e.tokens.toLocaleString()}</td>
                  <td className="px-4 py-2">
                    {e.action_taken ? (
                      <span className="text-xs text-red-400">{e.action_taken}</span>
                    ) : (
                      <span className="text-xs text-gray-700">—</span>
                    )}
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
