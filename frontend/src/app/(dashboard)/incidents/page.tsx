'use client'
import { Siren, Bell, AlertTriangle, Shield, Activity } from 'lucide-react'

export default function Page() {
  return (
    <div className="p-6 space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight"><span className="gradient-text">Incident Center</span></h1><p className="text-sm text-gray-500 mt-0.5">Track and manage runtime incidents across all agents</p></div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/80 backdrop-blur-xl border border-black/[0.04] shadow-sm">
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" /><span className="text-xs text-orange-600 font-medium">Monitoring</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 stagger-children">
        {[
          { label: 'Open Incidents', value: '0', icon: AlertTriangle, gradient: 'from-red-100 to-rose-50' },
          { label: 'Resolved Today', value: '0', icon: Shield, gradient: 'from-orange-100 to-amber-50' },
          { label: 'Active Alerts', value: '0', icon: Bell, gradient: 'from-amber-100 to-orange-50' },
        ].map((s) => (
          <div key={s.label} className="bg-white/80 backdrop-blur-2xl rounded-3xl border border-black/[0.04] p-5 shadow-sm hover:shadow-xl hover:bg-white/95 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">{s.label}</span>
              <div className={`w-9 h-9 rounded-2xl bg-gradient-to-br ${s.gradient} border border-black/[0.04] flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                <s.icon className="w-4 h-4 text-gray-500" />
              </div>
            </div>
            <p className="text-3xl font-bold text-[#1d1d1f]">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-white/80 backdrop-blur-2xl rounded-3xl border border-black/[0.04] p-16 text-center shadow-sm">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-100 to-purple-50 border border-indigo-200 flex items-center justify-center mx-auto mb-4">
          <Siren className="w-8 h-8 text-indigo-600" />
        </div>
        <p className="text-base font-medium text-gray-500">No incidents to display</p>
        <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto leading-relaxed">Incidents will appear here when governance rules are triggered or anomalies are detected in agent behavior.</p>
      </div>
    </div>
  )
}
