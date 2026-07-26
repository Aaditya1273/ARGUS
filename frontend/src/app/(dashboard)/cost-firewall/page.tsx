'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Shield, TrendingUp, AlertTriangle, DollarSign, Activity } from 'lucide-react'

interface Stats {
  total_cost: number
  current_burn_rate: number
  daily_total: number
  blocked_requests: number
  active_policies: number
  active_policies_list: { name: string; limit: string; action: string; status: string }[]
  chart_data: number[]
  chart_labels: string[]
}

// Tiny sparkline — pure SVG, no deps
function Sparkline({ data, color = '#ea580c', height = 64 }: { data: number[]; color?: string; height?: number }) {
  if (!data || data.length < 2) return <div style={{ height }} className="flex items-center justify-center text-xs text-gray-400">No data</div>
  const max = Math.max(...data, 0.001)
  const w = 400, h = height
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h * 0.85) - h * 0.05}`)
  const area = `M${pts.join('L')}L${w},${h}L0,${h}Z`
  const line = `M${pts.join('L')}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".18" />
          <stop offset="100%" stopColor={color} stopOpacity=".01" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sg)" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function CostFirewallPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [err, setErr]     = useState(false)

  useEffect(() => {
    const load = () => fetch('/api/argus/stats').then(r => r.json()).then(setStats).catch(() => setErr(true))
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [])

  const burn = stats?.total_cost ?? 0
  const blocked = stats?.blocked_requests ?? 0
  const policies = stats?.active_policies ?? 0
  const policyList = stats?.active_policies_list ?? []

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fadeIn">

      {/* Page header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cost Firewall</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor agent burn rates and enforce budget boundaries in real-time.</p>
        </div>
        <Link href="/policies" className="btn-orange gap-1.5 inline-flex items-center">
          <Plus className="w-4 h-4" />
          New Policy
        </Link>
      </div>

      {err && (
        <div className="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Backend offline — start the Go server on :8080
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {/* Orange highlight card */}
        <div className="stat-card orange">
          <p className="text-sm text-orange-100 font-medium mb-1">Current Burn Rate</p>
          <p className="text-3xl font-bold tracking-tight">${burn.toFixed(2)}<span className="text-lg font-normal text-orange-200">/hr</span></p>
          <p className="text-xs text-orange-200 mt-2">Active across all agents</p>
        </div>
        {[
          { label: 'Daily Total',      value: `$${(stats?.daily_total ?? 0).toFixed(2)}`, icon: DollarSign },
          { label: 'Blocked Requests', value: String(blocked),                            icon: AlertTriangle },
          { label: 'Active Policies',  value: String(policies),                           icon: Shield },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <p className="text-xs text-gray-500 font-medium mb-1">{s.label}</p>
            <p className="text-3xl font-bold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Chart + Firewall Status */}
      <div className="grid grid-cols-3 gap-5 mb-5">
        <div className="col-span-2 card p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Cost Trajectory</h2>
          {stats?.chart_data ? (
            <div>
              <Sparkline data={stats.chart_data} />
              <div className="flex justify-between mt-2">
                {(stats.chart_labels ?? []).filter((_, i, a) => i % Math.floor(a.length / 7) === 0).map(l => (
                  <span key={l} className="text-[11px] text-gray-400">{l}</span>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-24 flex items-center justify-center text-sm text-gray-400">Loading…</div>
          )}
        </div>

        <div className="card p-6 flex flex-col gap-4">
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Firewall Status</p>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-orange-600" />
              <span className="text-base font-bold text-gray-900">Active Enforcement</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">MCP interceptions are enabled.</p>
            <Link href="/incidents" className="btn-orange mt-4 text-xs py-1.5 px-4 inline-flex">View Logs</Link>
          </div>
          <hr className="border-gray-100" />
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">Enforced Policies</p>
            {policyList.length === 0
              ? <p className="text-xs text-gray-400">No active policies.</p>
              : policyList.slice(0, 3).map(p => (
                <div key={p.name} className="flex items-center justify-between py-1">
                  <span className="text-xs text-gray-600 truncate">{p.name}</span>
                  <span className="pill pill-orange text-[10px]">{p.action}</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* Budget usage + Active session */}
      <div className="grid grid-cols-2 gap-5">
        <div className="card p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Budget Usage</h3>
            <span className="text-xs text-gray-400">Daily Global</span>
          </div>
          {/* Donut */}
          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f0f0f0" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#ea580c" strokeWidth="3"
                  strokeDasharray={`${Math.min((burn / 100) * 100, 100)} 100`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-bold text-gray-900">{((burn / 100) * 100).toFixed(0)}%</span>
                <span className="text-[10px] text-gray-500">Consumed</span>
              </div>
            </div>
            <div className="space-y-2 text-xs">
              <div><span className="text-gray-500">Used</span><span className="ml-2 font-semibold text-gray-900">${burn.toFixed(2)}</span></div>
              <div><span className="text-gray-500">Limit</span><span className="ml-2 font-semibold text-gray-900">$100.00</span></div>
              <div><span className="text-gray-500">Remaining</span><span className="ml-2 font-semibold text-gray-900">${(100 - burn).toFixed(2)}</span></div>
            </div>
          </div>
        </div>

        <div className="card p-6" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', border: 'none' }}>
          <h3 className="text-sm font-semibold text-white mb-3">Active Agent Session</h3>
          <p className="text-xs text-gray-400 mb-4">Connect Claude to ARGUS MCP to see live session data.</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
            <span className="text-xs text-orange-300">Watching for connections…</span>
          </div>
        </div>
      </div>

    </div>
  )
}
