'use client'

import { useEffect, useState } from 'react'
import { Shield, AlertTriangle } from 'lucide-react'

interface Rule { name: string; plugin: string; severity: string; action: string; enabled: boolean }

const SEV: Record<string, string> = {
  CRITICAL: 'pill-red', HIGH: 'pill-orange', MEDIUM: 'bg-yellow-50 text-yellow-700', LOW: 'pill-gray',
}

export default function GovernancePage() {
  const [rules, setRules]   = useState<Rule[]>([])
  const [count, setCount]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr]       = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/argus/governance/rules')
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const d = await r.json()
        setRules(d.rules ?? []); setCount(d.count ?? 0)
      } catch (e: any) { setErr(e.message) }
      finally { setLoading(false) }
    }
    load(); const t = setInterval(load, 15000); return () => clearInterval(t)
  }, [])

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fadeIn">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Governance</h1>
          <p className="text-sm text-gray-500 mt-1">Runtime enforcement rules — 9 plugins active</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-xs font-medium text-green-700">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          {count} rules loaded
        </div>
      </div>

      {err && (
        <div className="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Failed to load: {err}. Is the backend running?
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 rounded-full border-2 border-orange-600 border-t-transparent animate-spin" />
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-orange-600" />
              <h2 className="text-sm font-semibold text-gray-800">Active Detection Plugins</h2>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rule Name</th><th>Plugin</th><th>Severity</th><th>Auto Action</th><th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium text-gray-800">{r.name}</td>
                    <td className="font-mono text-xs text-orange-600">{r.plugin}</td>
                    <td><span className={`pill ${SEV[r.severity] ?? 'pill-gray'}`}>{r.severity}</span></td>
                    <td className="font-mono text-xs text-gray-600">{r.action}</td>
                    <td className="text-center">
                      <span className={`pill ${r.enabled ? 'pill-green' : 'pill-gray'}`}>
                        <span className={`pill-dot ${r.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                        {r.enabled ? 'Active' : 'Off'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card p-5 mt-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">How it works</p>
            <p className="text-sm text-gray-600 leading-relaxed">
              Every MCP tool call is evaluated against all active plugins. When a rule fires, the recovery action executes automatically
              and a governance violation span event is emitted to SigNoz. Connect Claude at{' '}
              <code className="text-orange-600 bg-orange-50 px-1 rounded">https://argus-production-0c2d.up.railway.app/api/v1/mcp</code> to see live violations.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
