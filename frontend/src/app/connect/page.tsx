'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Shield, Zap, DollarSign, AlertTriangle, CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react'

interface OAuthRequest {
  request_id: string
  client_name: string
  client_id: string
  scope: string
  expires_at: string
}

const BUDGET_OPTIONS = [
  { value: 5,   label: '$5',  desc: 'Light session' },
  { value: 10,  label: '$10', desc: 'Standard' },
  { value: 25,  label: '$25', desc: 'Heavy analysis' },
  { value: 50,  label: '$50', desc: 'Unlimited work' },
]

function ConnectInner() {
  const params = useSearchParams()
  const router = useRouter()
  const requestId = params.get('request')

  const [req, setReq]           = useState<OAuthRequest | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [budget, setBudget]     = useState(10)
  const [approving, setApproving] = useState(false)
  const [denying, setDenying]   = useState(false)
  const [done, setDone]         = useState(false)

  useEffect(() => {
    if (!requestId) {
      setError('No request ID provided. This page should only be reached via an MCP OAuth flow.')
      setLoading(false)
      return
    }
    fetch(`/api/argus/oauth/request?id=${encodeURIComponent(requestId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setReq(data)
      })
      .catch(e => setError(e.message ?? 'Request not found or expired'))
      .finally(() => setLoading(false))
  }, [requestId])

  const handleApprove = async () => {
    if (!req) return
    setApproving(true)
    try {
      const res = await fetch('/api/argus/oauth/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: req.request_id, budget_limit: budget }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setDone(true)
      // redirect Claude Web back to its redirect_uri with the code
      if (data.redirect_to) {
        window.location.href = data.redirect_to
      }
    } catch (e: any) {
      setError(e.message ?? 'Approval failed')
      setApproving(false)
    }
  }

  const handleDeny = async () => {
    if (!req) return
    setDenying(true)
    try {
      const res = await fetch('/api/argus/oauth/deny', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: req.request_id }),
      })
      const data = await res.json()
      setDone(true)
      if (data.redirect_to) {
        window.location.href = data.redirect_to
      } else {
        router.push('/')
      }
    } catch {
      setDenying(false)
      router.push('/')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-red-500/20 rounded-2xl p-8 max-w-md w-full text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
          <h1 className="text-xl font-bold text-white">Connection Request Invalid</h1>
          <p className="text-sm text-gray-400">{error}</p>
          <p className="text-xs text-gray-600">
            This happens when the request has expired (10 min limit) or the URL is incorrect.
            Try connecting again from Claude.
          </p>
          <a href="https://claude.ai" className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
            Back to Claude <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <CheckCircle className="w-12 h-12 text-orange-400 mx-auto" />
          <p className="text-white font-semibold">Redirecting back to Claude…</p>
          <Loader2 className="w-4 h-4 text-gray-500 animate-spin mx-auto" />
        </div>
      </div>
    )
  }

  const clientDisplay = req?.client_name || req?.client_id || 'Claude'
  const expiresAt = req ? new Date(req.expires_at) : null
  const minsLeft = expiresAt ? Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 60000)) : 0

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5">

        {/* Header */}
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-7 h-7 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Connect to ARGUS</h1>
          <p className="text-sm text-gray-500 mt-1">
            <span className="text-white font-medium">{clientDisplay}</span> wants to use the ARGUS MCP tools
          </p>
        </div>

        {/* What gets access */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">This connection will allow:</p>
          {[
            { icon: Zap, label: 'Read files, search code, run commands in your project' },
            { icon: Shield, label: 'Query SigNoz traces, services, and alerts' },
            { icon: DollarSign, label: 'Every tool call is metered against your budget' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <Icon className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <p className="text-sm text-gray-300 leading-snug">{label}</p>
            </div>
          ))}
        </div>

        {/* Budget selector */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Session Budget</p>
            <span className="text-xs text-gray-600">Connection blocked when limit is reached</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {BUDGET_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setBudget(opt.value)}
                className={`py-3 rounded-lg border text-center transition-all ${
                  budget === opt.value
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                    : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                }`}
              >
                <p className="text-sm font-bold">{opt.label}</p>
                <p className="text-xs text-gray-600 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-600">
            Selected: <span className="text-amber-400 font-mono">${budget}.00</span> — ARGUS will block Claude when this is consumed
          </p>
        </div>

        {/* ARGUS guarantee */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-orange-500/5 border border-orange-500/15">
          <Shield className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-orange-400/80">
            ARGUS intercepts every tool call. If Claude exceeds the budget or triggers a governance rule,
            the connection is automatically terminated.
          </p>
        </div>

        {/* Expiry notice */}
        {minsLeft <= 5 && minsLeft > 0 && (
          <div className="flex items-center gap-2 text-xs text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            Request expires in {minsLeft} minute{minsLeft !== 1 ? 's' : ''}
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleDeny}
            disabled={denying || approving}
            className="flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {denying ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Deny
          </button>
          <button
            onClick={handleApprove}
            disabled={approving || denying}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors text-sm font-semibold disabled:opacity-50 shadow-lg shadow-indigo-500/20"
          >
            {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Approve
          </button>
        </div>

        <p className="text-center text-xs text-gray-700">
          Approving grants <span className="text-gray-500">{clientDisplay}</span> access via ARGUS MCP server
        </p>
      </div>
    </div>
  )
}

export default function ConnectPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    }>
      <ConnectInner />
    </Suspense>
  )
}
