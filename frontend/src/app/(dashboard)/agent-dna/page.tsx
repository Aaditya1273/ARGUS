'use client'

import React, { useEffect, useState } from 'react'

export default function AgentDNA() {
  const [profiles, setProfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/argus/dna/profiles')
      .then(res => res.json())
      .then(data => {
        setProfiles(data || [])
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa]">
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Agent DNA</h1>
              <p className="text-gray-500 mt-1">Behavioral fingerprinting and drift detection across all your agents.</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading Agent Profiles...</div>
            ) : profiles.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500">No agent DNA profiles found.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="text-xs uppercase bg-gray-50 text-gray-500 border-b border-gray-200 font-semibold tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Agent ID</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Current Cost</th>
                    <th className="px-6 py-4 text-right">Tokens</th>
                    <th className="px-6 py-4 text-right">Latency</th>
                    <th className="px-6 py-4 text-right">Last Tool</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {profiles.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{p.agent_id}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.status === 'RUNNING' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">${p.current_cost?.toFixed(4)}</td>
                      <td className="px-6 py-4 text-right">{p.current_tokens}</td>
                      <td className="px-6 py-4 text-right">{p.latency_ms}ms</td>
                      <td className="px-6 py-4 text-right font-mono text-xs">{p.last_tool}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
