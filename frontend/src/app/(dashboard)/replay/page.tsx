'use client'

import { useState } from 'react'
import { Play, AlertTriangle } from 'lucide-react'

interface Diff {
  original_response: string; new_response: string
  response_diff: string; latency_delta_ms: number; cost_delta: number
}

export default function ReplayPage() {
  const [traceId, setTraceId]   = useState('')
  const [prompt, setPrompt]     = useState('')
  const [model, setModel]       = useState('gpt-3.5-turbo')
  const [result, setResult]     = useState<Diff | null>(null)
  const [loading, setLoading]   = useState(false)
  const [err, setErr]           = useState<string | null>(null)

  const run = async () => {
    if (!traceId.trim()) { setErr('Trace ID required'); return }
    setLoading(true); setErr(null); setResult(null)
    try {
      const tr = await fetch(`http://127.0.0.1:8080/api/v1/argus/replay/${encodeURIComponent(traceId)}`)
      if (!tr.ok) { setErr('Trace not found. Run a session first.'); return }
      const ex = await fetch('http://127.0.0.1:8080/api/v1/argus/replay/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trace_id: traceId, new_prompt: prompt, model }),
      })
      if (!ex.ok) { setErr('Replay failed'); return }
      setResult(await ex.json())
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Prompt Replay</h1>
        <p className="text-sm text-gray-500 mt-1">Reconstruct a past trace and re-run with a modified prompt.</p>
      </div>

      <div className="card p-6 space-y-4 mb-6">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Trace ID</label>
          <input value={traceId} onChange={e => setTraceId(e.target.value)}
            placeholder="e.g. mcp-1 or any session ID captured by ARGUS"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">New Prompt</label>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
            placeholder="Leave blank to use original prompt"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all resize-none" />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Model</label>
            <select value={model} onChange={e => setModel(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20">
              {['gpt-3.5-turbo','gpt-4o','gpt-4o-mini','claude-3-5-sonnet'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <button onClick={run} disabled={loading}
            className="btn-orange mt-5 disabled:opacity-50">
            <Play className="w-4 h-4" />
            {loading ? 'Running…' : 'Run Replay'}
          </button>
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 text-sm mb-6">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />{err}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { l: 'Latency Δ', v: `${result.latency_delta_ms}ms`, warn: result.latency_delta_ms > 0 },
              { l: 'Cost Δ',    v: `$${(result.cost_delta ?? 0).toFixed(4)}`, warn: result.cost_delta > 0 },
              { l: 'Semantic Δ', v: result.response_diff || 'Minor', warn: false },
            ].map(m => (
              <div key={m.l} className="stat-card text-center">
                <p className="text-xs text-gray-500 mb-1">{m.l}</p>
                <p className={`text-xl font-bold ${m.warn ? 'text-orange-600' : 'text-gray-900'}`}>{m.v}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-4">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Original Response</p>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">{result.original_response || '(empty)'}</pre>
            </div>
            <div className="card p-4" style={{ borderLeftColor: '#ea580c', borderLeftWidth: 3 }}>
              <p className="text-[11px] font-semibold text-orange-600 uppercase tracking-widest mb-2">New Response</p>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">{result.new_response || '(empty)'}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
