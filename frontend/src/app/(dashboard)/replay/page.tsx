'use client'
import { useState } from 'react'
import { PlayCircle, Clock, DollarSign, Activity, AlertTriangle, ArrowRight, RotateCcw, Terminal } from 'lucide-react'

interface DiffResult { trace_id: string; original_prompt: string; new_prompt: string; original_response: string; new_response: string; response_diff: string; latency_delta_ms: number; cost_delta: number }

export default function ReplayPage() {
  const [traceId, setTraceId] = useState(''); const [newPrompt, setNewPrompt] = useState(''); const [model, setModel] = useState('gpt-3.5-turbo'); const [result, setResult] = useState<DiffResult | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null)

  const handleReplay = async () => {
    if (!traceId.trim()) { setError('Trace ID is required'); return }
    setLoading(true); setError(null); setResult(null)
    try {
      const traceRes = await fetch(`http://127.0.0.1:8080/api/v1/argus/replay/${encodeURIComponent(traceId)}`)
      if (!traceRes.ok) { setError('Trace not found. Make sure the trace ID was captured by ARGUS during an MCP session.'); return }
      const execRes = await fetch('http://127.0.0.1:8080/api/v1/argus/replay/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trace_id: traceId, new_prompt: newPrompt, model }) })
      if (!execRes.ok) { setError('Replay execution failed'); return }
      setResult(await execRes.json())
    } catch (e) { setError(e instanceof Error ? e.message : 'Network error — is the backend running on :8080?') } finally { setLoading(false) }
  }

  return (
    <div className="p-6 space-y-6 animate-fadeIn">
      <div><h1 className="text-2xl font-bold tracking-tight"><span className="gradient-text">Prompt Replay</span></h1><p className="text-sm text-gray-500 mt-0.5">Reconstruct a past trace and re-run with a modified prompt</p></div>
      <div className="bg-white/80 backdrop-blur-2xl rounded-3xl border border-black/[0.04] p-6 space-y-4 shadow-sm">
        <div><label className="block text-xs font-medium text-gray-500 mb-1.5">Trace ID</label><input value={traceId} onChange={(e) => setTraceId(e.target.value)} placeholder="e.g. mcp-1 or any trace ID captured by ARGUS" className="glass-input w-full px-4 py-3 text-sm" /></div>
        <div><label className="block text-xs font-medium text-gray-500 mb-1.5">New Prompt (leave blank to use original)</label><textarea value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} rows={3} placeholder="You are a concise assistant. Summarize the codebase in 3 bullet points." className="glass-input w-full px-4 py-3 text-sm resize-none" /></div>
        <div className="flex items-center gap-3">
          <div className="flex-1"><label className="block text-xs font-medium text-gray-500 mb-1.5">Model</label>
            <select value={model} onChange={(e) => setModel(e.target.value)} className="glass-select w-full px-3 py-3 text-sm">
              <option value="gpt-3.5-turbo">gpt-3.5-turbo</option><option value="gpt-4o">gpt-4o</option><option value="gpt-4o-mini">gpt-4o-mini</option><option value="claude-3-5-sonnet">claude-3-5-sonnet</option>
            </select>
          </div>
          <div className="pt-5">
            <button onClick={handleReplay} disabled={loading} className="px-5 py-3 text-sm font-semibold rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-gray-900 hover:from-indigo-500 hover:to-purple-500 transition-all duration-300 shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              {loading ? <><RotateCcw className="w-4 h-4 animate-spin" /> Replaying…</> : <><PlayCircle className="w-4 h-4" /> Run Replay</>}
            </button>
          </div>
        </div>
      </div>
      {error && <div className="bg-red-50 border border-red-200 rounded-3xl p-4 shadow-sm"><div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /><p className="text-sm text-red-600">{error}</p></div></div>}
      {result && <div className="space-y-4 animate-slideUp">
        <div className="grid grid-cols-3 gap-4 stagger-children">
          {[
            { label: 'Latency Δ', value: `${result.latency_delta_ms}ms`, icon: Clock, gradient: result.latency_delta_ms > 0 ? 'from-red-100 to-rose-50' : 'from-orange-100 to-amber-50' },
            { label: 'Cost Δ', value: `$${(result.cost_delta ?? 0).toFixed(4)}`, icon: DollarSign, gradient: result.cost_delta > 0 ? 'from-red-100 to-rose-50' : 'from-orange-100 to-amber-50' },
            { label: 'Semantic Δ', value: result.response_diff || 'Minor', icon: Activity, gradient: 'from-indigo-100 to-purple-50' },
          ].map((m) => (
            <div key={m.label} className="bg-white/80 backdrop-blur-2xl rounded-3xl border border-black/[0.04] p-5 shadow-sm hover:shadow-xl transition-all duration-300 group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">{m.label}</span>
                <div className={`w-8 h-8 rounded-2xl bg-gradient-to-br ${m.gradient} border border-black/[0.04] flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}><m.icon className="w-4 h-4 text-gray-500" /></div>
              </div>
              <p className={`text-lg font-bold mt-1 ${m.label === 'Latency Δ' ? (result.latency_delta_ms > 0 ? 'text-red-500' : 'text-orange-500') : m.label === 'Cost Δ' ? (result.cost_delta > 0 ? 'text-red-500' : 'text-orange-500') : 'text-indigo-500'}`}>{m.value}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/80 backdrop-blur-2xl rounded-3xl border border-black/[0.04] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-3 uppercase tracking-wider"><Terminal className="w-3.5 h-3.5" />Original Response</div>
            <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed">{result.original_response || '(empty)'}</pre>
          </div>
          <div className="bg-white/80 backdrop-blur-2xl rounded-3xl border border-orange-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium text-orange-600 mb-3 uppercase tracking-wider"><ArrowRight className="w-3.5 h-3.5" />New Response</div>
            <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed">{result.new_response || '(empty)'}</pre>
          </div>
        </div>
      </div>}
    </div>
  )
}
