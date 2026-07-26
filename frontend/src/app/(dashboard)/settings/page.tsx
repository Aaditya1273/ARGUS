'use client'

import { useEffect, useState } from 'react'
import { Shield, Cloud, CheckCircle, AlertTriangle, ExternalLink, Copy, Check } from 'lucide-react'

interface SigNozHealth {
  configured: boolean; status: string; endpoint: string
  region: string; key_length: number; message: string
}

function CopyBtn({ text }: { text: string }) {
  const [c, setC] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setC(true); setTimeout(() => setC(false), 1500) }}
      className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">
      {c ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

export default function SettingsPage() {
  const [signoz, setSignoz] = useState<SigNozHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [otelConfig, setOtelConfig] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('http://127.0.0.1:8080/api/v1/argus/signoz/health').then(r => r.json()),
      fetch('http://127.0.0.1:8080/api/v1/argus/signoz/config').then(r => r.text()),
    ]).then(([h, cfg]) => {
      setSignoz(h); setOtelConfig(cfg)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">ARGUS configuration and SigNoz Cloud integration status.</p>
      </div>

      {/* SigNoz Connection Status — the proof */}
      <div className="card p-6 mb-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
            <Cloud className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">SigNoz Cloud</h2>
            <p className="text-xs text-gray-500">Observability backend — receives all ARGUS spans</p>
          </div>
          {!loading && (
            <div className={`ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
              signoz?.configured
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-600'
            }`}>
              {signoz?.configured
                ? <><CheckCircle className="w-3.5 h-3.5" /> Connected</>
                : <><AlertTriangle className="w-3.5 h-3.5" /> Not configured</>
              }
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="w-4 h-4 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
            Checking connection…
          </div>
        ) : signoz ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { l: 'Status',   v: signoz.status,        hi: signoz.configured },
                { l: 'Region',   v: signoz.region || 'in2', hi: false },
                { l: 'Endpoint', v: signoz.endpoint || '—', hi: false },
                { l: 'Key Size', v: signoz.key_length ? `${signoz.key_length} chars` : '—', hi: false },
              ].map(s => (
                <div key={s.l} className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-500">{s.l}</p>
                  <p className={`text-sm font-semibold mt-0.5 truncate ${s.hi ? 'text-green-700' : 'text-gray-900'}`}>{s.v}</p>
                </div>
              ))}
            </div>

            {signoz.configured && (
              <>
                {/* PROOF: spans are shipped to SigNoz */}
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-green-50 border border-green-200">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-green-700 space-y-1">
                    <p className="font-semibold">Real spans shipping to SigNoz Cloud</p>
                    <p>Every MCP tool call, OAuth session connect, and governance violation is emitted as an OTel span with service.name = <code className="bg-green-100 px-1 rounded">argus-control-plane</code></p>
                    <a href="https://app.in2.signoz.cloud" target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-green-600 font-medium hover:underline mt-1">
                      Open SigNoz Cloud → Traces <ExternalLink className="w-3 h-3" />
                    </a>
                    <p className="text-green-600">Filter: <code className="bg-green-100 px-1 rounded">service.name = argus-control-plane</code></p>
                    <p className="text-green-600">Operations: <code className="bg-green-100 px-1 rounded">mcp.tool_call</code>, <code className="bg-green-100 px-1 rounded">argus.session.connect</code>, <code className="bg-green-100 px-1 rounded">argus.governance.violation</code></p>
                  </div>
                </div>

                {/* OTel exporter config */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-600">OTel Exporter Config (for your agents)</p>
                    <CopyBtn text={otelConfig} />
                  </div>
                  <pre className="code-block text-[11px]">{otelConfig || '# Run backend to generate config'}</pre>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Backend offline — start Go server on :8080
          </div>
        )}
      </div>

      {/* ARGUS server info */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
            <Shield className="w-5 h-5 text-orange-600" />
          </div>
          <h2 className="text-sm font-semibold text-gray-900">ARGUS Backend</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { l: 'Backend URL',     v: 'http://localhost:8080' },
            { l: 'Dashboard URL',   v: 'http://localhost:3000' },
            { l: 'MCP Endpoint',    v: 'http://localhost:8080/api/v1/mcp' },
            { l: 'OAuth Discovery', v: 'http://localhost:8080/.well-known/oauth-authorization-server' },
          ].map(s => (
            <div key={s.l} className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">{s.l}</p>
                <p className="text-xs font-mono text-gray-800 mt-0.5 truncate max-w-[220px]">{s.v}</p>
              </div>
              <CopyBtn text={s.v} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
