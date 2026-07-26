'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Shield, Activity, CheckCircle } from 'lucide-react'

interface Agent {
  agent_id: string; status: string; current_cost: number
  latency_ms: number; last_tool: string; updated_at: string
}

export default function IncidentsPage() {
  const [agents, setAgents]   = useState<Agent[]>([])
  const [rules,  setRules]    = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [ar, rr] = await Promise.all([
          fetch('/api/argus/agents').then(r => r.json()),
          fetch('/api/argus/governance/rules').then(r => r.json()),
        ])
        setAgents(Array.isArray(ar) ? ar : [])
        setRules(rr.rules ?? [])
      } finally { setLoading(false) }
    }
    load()
    const t = setInterval(load, 8000)
    return () => clearInterval(t)
  }, [])

  const incidents = agents.filter(a => a.status === 'BLOCKED' || a.status === 'DEAD')
  const open    = incidents.length
  const healthy = agents.filter(a => a.status === 'RUNNING').length
  const critical = rules.filter(r => r.severity === 'CRITICAL' && r.enabled).length

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Incident Center</h1>
        <p className="text-sm text-gray-500 mt-1">Track and manage runtime incidents across all agents.</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { l: 'Open Incidents', v: open,     icon: AlertTriangle, hi: open > 0 },
          { l: 'Healthy Agents', v: healthy,  icon: CheckCircle,   hi: false },
          { l: 'Critical Rules', v: critical, icon: Shield,        hi: false },
        ].map(s => (
          <div key={s.l} className="stat-card flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.hi ? 'bg-red-50' : 'bg-orange-50'}`}>
              <s.icon className={`w-5 h-5 ${s.hi ? 'text-red-600' : 'text-orange-600'}`} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">{s.l}</p>
              <p className={`text-2xl font-bold ${s.hi ? 'text-red-600' : 'text-gray-900'}`}>{s.v}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Activity className="w-4 h-4 text-orange-600" />
          <h2 className="text-sm font-semibold text-gray-800">
            {open > 0 ? `${open} Active Incident${open !== 1 ? 's' : ''}` : 'No Active Incidents'}
          </h2>
        </div>

        {loading ? (
          <div className="py-10 flex justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
          </div>
        ) : incidents.length === 0 ? (
          <div className="py-14 text-center">
            <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">All agents healthy</p>
            <p className="text-xs text-gray-400 mt-1">
              Incidents appear here when governance rules fire or agents exceed budget.
              Connect Claude via the Plugins page to start monitoring.
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Agent</th><th>Status</th><th>Cost</th><th>Latency</th><th>Last Tool</th><th>Updated</th></tr>
            </thead>
            <tbody>
              {incidents.map(a => (
                <tr key={a.agent_id}>
                  <td className="font-mono text-xs text-gray-700">{a.agent_id.slice(0,22)}…</td>
                  <td>
                    <span className={`pill ${a.status === 'BLOCKED' ? 'pill-orange' : 'pill-red'}`}>
                      <span className={`pill-dot ${a.status === 'BLOCKED' ? 'bg-orange-500' : 'bg-red-500'}`} />
                      {a.status}
                    </span>
                  </td>
                  <td className="font-mono text-xs text-orange-600">${(a.current_cost??0).toFixed(4)}</td>
                  <td className="text-xs text-gray-500">{a.latency_ms}ms</td>
                  <td className="text-xs text-gray-400">{a.last_tool||'—'}</td>
                  <td className="text-xs text-gray-400">{a.updated_at ? new Date(a.updated_at).toLocaleTimeString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
