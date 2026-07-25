'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface DNAProfile {
  agent_id: string
  baseline_cost_per_run: number
  baseline_latency_ms: number
  baseline_token_usage: number
  tool_usage_distribution: Record<string, number>
  anomaly_score: number
  drift_detected: boolean
  last_updated: string
  run_count: number
  avg_cost: number
  avg_latency: number
  p95_latency: number
}

export default function AgentDNAPage() {
  const [profiles, setProfiles] = useState<DNAProfile[]>([])
  const [selected, setSelected] = useState<DNAProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/argus/dna/profiles')
        if (res.ok) {
          const data = await res.json()
          setProfiles(data)
          if (data.length > 0) setSelected(data[0])
        }
      } finally {
        setLoading(false)
      }
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

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
        <h1 className="text-2xl font-bold text-white tracking-tight">Agent DNA</h1>
        <p className="text-sm text-gray-500 mt-0.5">Behavioral baselines, drift detection & anomaly scoring</p>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Agent list */}
        <div className="col-span-4 bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="text-sm font-medium text-gray-300">Profiles ({profiles.length})</h2>
          </div>
          {profiles.length === 0 ? (
            <p className="px-4 py-8 text-center text-gray-600 text-sm">No profiles yet</p>
          ) : (
            <div className="divide-y divide-gray-800">
              {profiles.map((p) => (
                <button
                  key={p.agent_id}
                  onClick={() => setSelected(p)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-800/50 transition-colors ${selected?.agent_id === p.agent_id ? 'bg-gray-800' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-gray-300">{p.agent_id.slice(0, 14)}…</span>
                    {p.drift_detected && (
                      <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded">Drift</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-gray-600">Score:</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-1">
                      <div
                        className={`h-1 rounded-full ${p.anomaly_score > 0.7 ? 'bg-red-500' : p.anomaly_score > 0.4 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                        style={{ width: `${p.anomaly_score * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{(p.anomaly_score * 100).toFixed(0)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="col-span-8 space-y-4">
          {selected ? (
            <>
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-white font-mono">{selected.agent_id}</h3>
                  <div className="flex items-center gap-2">
                    {selected.drift_detected && (
                      <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded">
                        ⚠ Behavioral Drift
                      </span>
                    )}
                    <span className="text-xs text-gray-600">Updated {new Date(selected.last_updated).toLocaleTimeString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Avg Cost / Run', value: `$${selected.avg_cost.toFixed(4)}`, sub: `baseline $${selected.baseline_cost_per_run.toFixed(4)}` },
                    { label: 'Avg Latency', value: `${selected.avg_latency}ms`, sub: `p95 ${selected.p95_latency}ms` },
                    { label: 'Runs', value: selected.run_count.toLocaleString(), sub: `baseline tokens ${selected.baseline_token_usage.toLocaleString()}` },
                  ].map((m) => (
                    <div key={m.label} className="bg-gray-800/50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">{m.label}</p>
                      <p className="text-xl font-bold text-white mt-0.5">{m.value}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{m.sub}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tool usage */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Tool Usage Distribution</h3>
                {Object.keys(selected.tool_usage_distribution).length === 0 ? (
                  <p className="text-sm text-gray-600">No tool data yet</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(selected.tool_usage_distribution)
                      .sort(([, a], [, b]) => b - a)
                      .map(([tool, count]) => {
                        const total = Object.values(selected.tool_usage_distribution).reduce((a, b) => a + b, 0)
                        const pct = (count / total) * 100
                        return (
                          <div key={tool} className="flex items-center gap-3">
                            <span className="text-xs text-gray-400 w-36 truncate font-mono">{tool}</span>
                            <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 w-12 text-right">{pct.toFixed(0)}%</span>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>

              {/* Anomaly score */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Anomaly Score</h3>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 relative flex items-center justify-center">
                    <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#1f2937" strokeWidth="10" />
                      <circle
                        cx="50" cy="50" r="40" fill="none"
                        stroke={selected.anomaly_score > 0.7 ? '#ef4444' : selected.anomaly_score > 0.4 ? '#f59e0b' : '#10b981'}
                        strokeWidth="10"
                        strokeDasharray={`${selected.anomaly_score * 251.2} 251.2`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute text-xl font-bold text-white">
                      {(selected.anomaly_score * 100).toFixed(0)}
                    </span>
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${selected.anomaly_score > 0.7 ? 'text-red-400' : selected.anomaly_score > 0.4 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {selected.anomaly_score > 0.7 ? 'High Risk' : selected.anomaly_score > 0.4 ? 'Elevated' : 'Normal'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 max-w-48">
                      {selected.drift_detected
                        ? 'Behavioral drift detected — agent deviating from established baseline.'
                        : 'Agent behavior within normal parameters.'}
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center text-gray-600 text-sm">
              Select an agent profile to view details
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
