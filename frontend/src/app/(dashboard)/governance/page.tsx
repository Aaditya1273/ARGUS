'use client'
import { useEffect, useState } from 'react'
import { Scale, Shield, Activity, AlertTriangle, Info } from 'lucide-react'

interface GovernanceRule { name: string; plugin: string; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'; action: string; enabled: boolean }

const SEV: Record<string, { badge: string }> = {
  CRITICAL: { badge: 'bg-red-50 text-red-600 border-red-200' },
  HIGH:     { badge: 'bg-orange-50 text-orange-600 border-orange-200' },
  MEDIUM:   { badge: 'bg-amber-50 text-amber-600 border-amber-200' },
  LOW:      { badge: 'bg-gray-50 text-gray-500 border-gray-200' },
}
const ACT: Record<string, string> = { KILL_RUN: 'text-red-500', TRIGGER_FALLBACK: 'text-amber-500', CIRCUIT_BREAKER: 'text-orange-500', ALERT: 'text-indigo-500', REDUCE_CONTEXT: 'text-blue-500' }

export default function GovernancePage() {
  const [rules, setRules] = useState<GovernanceRule[]>([]); const [count, setCount] = useState(0); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const load = async () => {
      try { const res = await fetch('/api/argus/governance/rules'); if (!res.ok) throw Error(`HTTP ${res.status}`); const data = await res.json(); setRules(data.rules ?? []); setCount(data.count ?? 0); setError(null) } catch (e) { setError(e instanceof Error ? e.message : 'Failed') } finally { setLoading(false) }
    }
    load(); const t = setInterval(load, 15000); return () => clearInterval(t)
  }, [])

  return (
    <div className="p-6 space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight"><span className="gradient-text">Governance</span></h1><p className="text-sm text-gray-500 mt-0.5">Runtime enforcement rules — {count} plugins active</p></div>
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-white/80 backdrop-blur-xl border border-black/[0.04] px-3 py-1.5 rounded-2xl shadow-sm">
          <Shield className="w-3.5 h-3.5 text-orange-500" />{count} rules loaded
        </div>
      </div>
      {error && <div className="bg-red-50 border border-red-200 rounded-3xl p-4 shadow-sm"><div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /><p className="text-sm text-red-600">{error}</p></div></div>}
      {loading ? <div className="flex items-center justify-center h-40"><div className="flex items-center gap-3 text-gray-500"><Scale className="w-5 h-5 animate-pulse" /><span className="text-sm">Loading governance rules...</span></div></div> : (
        <div className="bg-white/80 backdrop-blur-2xl rounded-3xl border border-black/[0.04] overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-black/[0.04] flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-500" /><h2 className="text-sm font-medium text-[#1d1d1f]">Active Detection Plugins</h2></div>
          {rules.length === 0 ? <div className="px-5 py-12 text-center text-gray-500 text-sm">No rules loaded</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm glass-table">
                <thead><tr className="text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-medium">Rule Name</th><th className="text-left px-5 py-3 font-medium">Plugin</th><th className="text-left px-5 py-3 font-medium">Severity</th><th className="text-left px-5 py-3 font-medium">Auto Action</th><th className="text-center px-5 py-3 font-medium">Status</th>
                </tr></thead>
                <tbody>
                  {rules.map((rule, i) => (
                    <tr key={i} className="transition-colors duration-150 hover:bg-black/[0.01]">
                      <td className="px-5 py-3.5 text-[#1d1d1f] font-medium text-xs">{rule.name}</td>
                      <td className="px-5 py-3.5 font-mono text-xs text-indigo-600">{rule.plugin}</td>
                      <td className="px-5 py-3.5"><span className={`text-xs font-medium px-2.5 py-1 rounded-2xl border ${SEV[rule.severity]?.badge || SEV.LOW.badge}`}>{rule.severity}</span></td>
                      <td className={`px-5 py-3.5 font-mono text-xs ${ACT[rule.action] || 'text-gray-500'}`}>{rule.action}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${rule.enabled ? 'text-orange-600' : 'text-gray-500'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${rule.enabled ? 'bg-orange-500 animate-pulse' : 'bg-gray-400'}`} />
                          {rule.enabled ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      <div className="bg-white/80 backdrop-blur-2xl rounded-3xl border border-black/[0.04] p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-50 border border-indigo-200 flex items-center justify-center flex-shrink-0"><Info className="w-4 h-4 text-indigo-500" /></div>
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">How it works</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Every MCP tool call is evaluated against all active plugins. When a rule fires, the corresponding recovery action executes automatically. Connect Claude Desktop via <code className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-xl">http://localhost:8080/api/v1/mcp</code> to see live violations.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
