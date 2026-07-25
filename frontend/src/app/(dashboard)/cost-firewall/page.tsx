'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import { CostChart } from '@/components/Charts/CostChart'
import { Shield, Plus, Upload } from 'lucide-react'

export default function CostFirewall() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/argus/stats')
      .then(res => res.json())
      .then(data => {
        setStats(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching stats:', err)
        setLoading(false)
      })
  }, [])

  if (loading || !stats) {
    return <div className="p-8 text-gray-500">Loading Cost Firewall...</div>
  }

  // Use the real data from the Go backend, default to 0 if not present
  const currentBurn = stats.current_burn_rate || 0
  const dailyTotal = stats.daily_total || 0
  const blockedReqs = stats.blocked_requests || 0
  const activePolicies = stats.active_policies || []

  // Ensure chart data is an array
  const chartData = stats.chart_data || [0,0,0,0,0,0,0]
  const chartLabels = stats.chart_labels || ['MON','TUE','WED','THU','FRI','SAT','SUN']

  // Ensure chartData length matches chartLabels length
  const displayData = chartData.slice(-7)
  const displayLabels = chartLabels.slice(-7)
  
  // Calculate max for bar height scaling
  const maxVal = Math.max(...displayData, 1) // prevent div by zero

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa]">
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Header Row */}
          <div className="flex items-end justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Cost Firewall</h1>
              <p className="text-gray-500 mt-1">Monitor agent burn rates and enforce budget boundaries in real-time.</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-5 py-2.5 bg-[#ea580c] text-white rounded-full text-sm font-medium hover:bg-[#c2410c] transition-colors shadow-sm">
                <Plus className="w-4 h-4" />
                New Policy
              </button>
            </div>
          </div>

          {/* Metric Cards Row */}
          <div className="grid grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-[#f97316] to-[#c2410c] rounded-3xl p-6 text-white shadow-md relative overflow-hidden">
              <p className="text-sm font-medium text-orange-100">Current Burn Rate</p>
              <p className="text-4xl font-bold mt-2">${currentBurn.toFixed(2)}/hr</p>
              <p className="text-xs text-orange-200 mt-4">Active across all agents</p>
            </div>
            
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-500">Daily Total</p>
              <p className="text-4xl font-bold text-gray-900 mt-2">${dailyTotal.toFixed(2)}</p>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-500">Blocked Requests</p>
              <p className="text-4xl font-bold text-gray-900 mt-2">{blockedReqs}</p>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-500">Active Policies</p>
              <p className="text-4xl font-bold text-gray-900 mt-2">{activePolicies.length}</p>
            </div>
          </div>

          {/* Middle Row: Analytics & Reminders/Collaborators */}
          <div className="grid grid-cols-12 gap-6">
            
            {/* Project Analytics -> Cost Trajectory */}
            <div className="col-span-7 bg-white rounded-3xl p-8 shadow-sm border border-gray-100 h-96 flex flex-col">
              <h2 className="text-lg font-bold text-gray-900 mb-6">Cost Trajectory</h2>
              <div className="flex-1 flex items-end justify-between px-4 pb-2">
                {displayData.map((val: number, i: number) => {
                  const heightPercent = (val / maxVal) * 100
                  return (
                    <div key={i} className="flex flex-col items-center gap-4 h-full justify-end w-full">
                      <div 
                        className={`w-12 rounded-t-lg transition-all ${i === displayData.length - 1 ? 'bg-[#ea580c]' : 'bg-[#fdba74]'}`} 
                        style={{ height: `${heightPercent}%`, minHeight: '4px' }}
                      />
                      <span className="text-xs font-bold text-gray-400">
                        {displayLabels[i] || ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="col-span-5 grid grid-rows-2 gap-6 h-96">
              {/* Reminders -> Shield Status */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-center">
                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Firewall Status</p>
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-8 h-8 text-[#ea580c]" />
                  <h3 className="text-xl font-bold text-gray-900">Active Enforcement</h3>
                </div>
                <p className="text-sm text-gray-500 mb-4">MCP interceptions are enabled.</p>
                <button className="self-start px-6 py-2 bg-[#ea580c] text-white rounded-full text-sm font-medium hover:bg-[#c2410c] transition-colors">
                  View Logs
                </button>
              </div>

              {/* Top Collaborators -> Active Policies */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-center overflow-hidden">
                <p className="text-sm font-bold text-gray-900 mb-4">Enforced Policies</p>
                <div className="space-y-3 overflow-y-auto max-h-full pr-2">
                  {activePolicies.length > 0 ? (
                    activePolicies.map((p: any, i: number) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-orange-50 rounded-full flex items-center justify-center border border-orange-100">
                          <span className="text-xs">🛡️</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 leading-tight">{p.name || 'Policy'}</p>
                          <p className="text-xs text-gray-400">Limit: {p.limit} - {p.action}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No active policies.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Row: Gauge & Time Tracker */}
          <div className="grid grid-cols-12 gap-6">
            
            {/* Project Progress Gauge -> Budget Usage */}
            <div className="col-span-4 bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col items-center justify-center h-64">
              <div className="w-full flex justify-between items-center mb-4">
                <p className="text-sm font-bold text-gray-900">Budget Usage</p>
                <p className="text-sm font-bold text-gray-900">Daily Global</p>
              </div>
              <div className="relative w-40 h-20 overflow-hidden mb-6">
                {/* CSS Half Circle Gauge */}
                <div className="absolute inset-0 border-[16px] border-[#fdba74] rounded-t-full border-b-0 opacity-40"></div>
                <div className="absolute inset-0 border-[16px] border-[#ea580c] rounded-t-full border-b-0 origin-bottom transition-all duration-1000" style={{ transform: `rotate(${-90 + Math.min((dailyTotal / 500) * 180, 180)}deg)` }}></div>
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                  <span className="text-xl font-bold text-gray-900 leading-none">{Math.round((dailyTotal / 500) * 100)}%</span>
                  <span className="text-[10px] text-gray-500 font-medium">Consumed</span>
                </div>
              </div>
              <button className="px-6 py-2 bg-white border-2 border-gray-200 text-gray-700 rounded-full text-xs font-bold hover:bg-gray-50 transition-colors w-full">
                Adjust Limits
              </button>
            </div>

            {/* Time Tracker -> Active Agent Session */}
            <div className="col-span-8 rounded-3xl overflow-hidden relative shadow-md h-64 bg-gray-900 border border-gray-800">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-orange-950 opacity-90"></div>
              
              <div className="absolute inset-0 p-8 flex flex-col justify-between">
                <p className="text-sm font-bold text-orange-50 tracking-wider">Active Agent Session</p>
                <div className="flex justify-between items-end">
                  <h2 className="text-6xl font-bold text-white tracking-tight tabular-nums drop-shadow-md">
                    00:45:12
                  </h2>
                  <div className="flex gap-4">
                    <button className="px-8 py-2.5 rounded-full border border-white/40 text-white font-medium hover:bg-white/10 backdrop-blur-sm transition-all shadow-sm">
                      Audit
                    </button>
                    <button className="px-8 py-2.5 rounded-full border border-white/40 text-white font-medium hover:bg-white/10 backdrop-blur-sm transition-all shadow-sm bg-red-500/20 hover:bg-red-500/40 border-red-500/50">
                      Kill Task
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
