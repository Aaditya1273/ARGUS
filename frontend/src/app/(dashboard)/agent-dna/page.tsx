'use client'

import { useEffect, useState } from 'react'
import { Dna } from 'lucide-react'

interface DNAProfile {
  agent_id: string; anomaly_score: number; drift_detected: boolean
  baseline_cost_per_run: number; baseline_latency_ms: number
  avg_cost: number; avg_latency: number; p95_latency: number
  tool_usage_distribution: Record<string, number>
  last_updated: string; run_count: number
}

export default function AgentDNAPage() {
  const [profiles, setProfiles] = useState<DNAProfile[]>([])
  const [selected, setSelected] = useState<DNAProfile | null>(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/argus/dna/profiles')
        if (r.ok) { const d = await r.json(); setProfiles(d); if (d.length) setSelected(d[0]) }
      } finally { setLoading(false) }
    }
    load(); const t = setInterval(load, 30000); return () => clearInterval(t)
  }, [])

  const scoreColor = (s: number) => s > 0.7 ? 'text-red-600' : s > 0.4 ? 'text-orange-600' : 'text-green-600'
  const scoreBar   = (s: number) => s > 0.7 ? 'bg-red-500' : s > 0.4 ? 'bg-orange-500' : 'bg-green-500'

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-40">
      <div className="w-6 h-6 rounded-full border-2 border-orange-600 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Agent DNA</h1>
        <p className="text-sm text-gray-500 mt-1">Behavioral baselines, drift detection &amp; anomaly scoring.</p>
      </div>

      {profiles.length === 0 ? (
        <div className="card p-12 text-center">
          <Dna className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No agent profiles yet.</p>
          <p className="text-gray-400 text-xs mt-1">Connect Claude via MCP to generate behavioral data.</p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-5">
          {/* List */}
          <div className="col-span-4 card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Profiles ({profiles.length})</h2>
            </div>
            {profiles.map(p => (
              <button key={p.agent_id} onClick={() => setSelected(p)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${selected?.agent_id === p.agent_id ? 'bg-orange-50 border-l-2 border-l-orange-500' : ''}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-mono text-gray-700 truncate">{p.agent_id.slice(0, 16)}…</span>
                  {p.drift_detected && <span className="pill pill-orange text-[10px]">Drift</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500">Score</span>
                  <div className="flex-1 progress-track h-1.5">
                    <div className={`h-full rounded-full ${scoreBar(p.anomaly_score)}`} style={{ width: `${p.anomaly_score * 100}%` }} />
                  </div>
                  <span className={`text-[10px] font-semibold ${scoreColor(p.anomaly_score)}`}>{(p.anomaly_score * 100).toFixed(0)}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Detail */}
          <div className="col-span-8 space-y-4">
            {selected ? (
              <>
                <div className="card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-mono text-sm font-semibold text-gray-800">{selected.agent_id}</h3>
                    {selected.drift_detected && (
                      <span className="pill pill-orange">⚠ Behavioral Drift</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { l: 'Avg Cost / Run', v: `$${selected.avg_cost.toFixed(4)}`, sub: `baseline $${selected.baseline_cost_per_run.toFixed(4)}` },
                      { l: 'Avg Latency',   v: `${selected.avg_latency}ms`, sub: `p95 ${selected.p95_latency}ms` },
                      { l: 'Runs',          v: selected.run_count.toLocaleString(), sub: `baseline ${selected.baseline_latency_ms}ms` },
                    ].map(m => (
                      <div key={m.l} className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500">{m.l}</p>
                        <p className="text-xl font-bold text-gray-900 mt-0.5">{m.v}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{m.sub}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Tool Usage Distribution</h3>
                  {Object.keys(selected.tool_usage_distribution).length === 0 ? (
                    <p className="text-sm text-gray-400">No tool data yet</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(selected.tool_usage_distribution).sort(([,a],[,b]) => b - a).map(([tool, count]) => {
                        const total = Object.values(selected.tool_usage_distribution).reduce((a,b) => a+b, 0)
                        const pct = (count / total) * 100
                        return (
                          <div key={tool} className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 w-36 truncate font-mono">{tool}</span>
                            <div className="flex-1 progress-track">
                              <div className="progress-fill" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 w-10 text-right">{pct.toFixed(0)}%</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="card p-5 flex items-center gap-5">
                  {/* Donut anomaly score */}
                  <div className="relative w-20 h-20 flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#f0f0f0" strokeWidth="4" />
                      <circle cx="18" cy="18" r="14" fill="none"
                        stroke={selected.anomaly_score > 0.7 ? '#ef4444' : selected.anomaly_score > 0.4 ? '#ea580c' : '#22c55e'}
                        strokeWidth="4"
                        strokeDasharray={`${selected.anomaly_score * 87.96} 87.96`}
                        strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-bold text-gray-900">{(selected.anomaly_score * 100).toFixed(0)}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Anomaly Score</p>
                    <p className={`text-sm font-medium mt-0.5 ${scoreColor(selected.anomaly_score)}`}>
                      {selected.anomaly_score > 0.7 ? 'High Risk' : selected.anomaly_score > 0.4 ? 'Elevated' : 'Normal'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 max-w-xs">
                      {selected.drift_detected ? 'Behavioral drift detected.' : 'Agent behavior within normal parameters.'}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="card p-12 text-center text-sm text-gray-400">Select a profile to view details</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
