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
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4">
        <div className="bg-white border border-red-100 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-xl shadow-red-500/5">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
          <h1 className="text-xl font-bold text-gray-900">Connection Request Invalid</h1>
          <p className="text-sm text-gray-500">{error}</p>
          <p className="text-xs text-gray-400">
            This happens when the request has expired (10 min limit) or the URL is incorrect.
            Try connecting again from Claude.
          </p>
          <a href="https://claude.ai" className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-500 transition-colors">
            Back to Claude <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="text-center space-y-4 animate-fadeIn">
          <div className="w-16 h-16 bg-green-50 border border-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-gray-900 font-bold text-lg">Redirecting back to Claude…</p>
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin mx-auto" />
        </div>
      </div>
    )
  }

  const clientDisplay = req?.client_name || req?.client_id || 'Claude'
  const expiresAt = req ? new Date(req.expires_at) : null
  const minsLeft = expiresAt ? Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 60000)) : 0

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4 selection:bg-orange-100 selection:text-orange-900">
      
      <div className="w-full max-w-[440px] space-y-6 animate-fadeIn">
        
        {/* Header with Live Connection Animation */}
        <div className="text-center pt-2">
          
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes flowDash {
              0% { stroke-dasharray: 15, 100; stroke-dashoffset: 115; }
              100% { stroke-dasharray: 15, 100; stroke-dashoffset: 0; }
            }
            .animate-flow-dash {
              animation: flowDash 1.5s linear infinite;
            }
            @keyframes pulseGlow {
              0%, 100% { opacity: 0.5; filter: blur(4px); }
              50% { opacity: 1; filter: blur(6px); }
            }
            .animate-pulse-glow {
              animation: pulseGlow 2s ease-in-out infinite;
            }
          `}} />

          <div className="flex items-center justify-center w-full mb-8 relative px-4">
            
            {/* AI Client Node */}
            <div className="relative z-10 w-[60px] h-[60px] rounded-2xl bg-white border border-gray-100 shadow-xl shadow-gray-200/50 flex items-center justify-center shrink-0">
              <div className="absolute inset-0 rounded-2xl bg-orange-500/5 animate-pulse"></div>
              {/* Fallback to Claude logo, or we could use generic AI icon if clientDisplay is unknown */}
              {clientDisplay.toLowerCase().includes('claude') ? (
                <img src="/ai-logos/claude-desktop.png" alt={clientDisplay} className="w-9 h-9 object-contain drop-shadow-sm" />
              ) : clientDisplay.toLowerCase().includes('cursor') ? (
                <img src="/ai-logos/cursor.png" alt={clientDisplay} className="w-9 h-9 object-contain drop-shadow-sm" />
              ) : clientDisplay.toLowerCase().includes('antigravity') ? (
                <img src="/ai-logos/antigravity.png" alt={clientDisplay} className="w-9 h-9 object-contain drop-shadow-sm" />
              ) : (
                <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center font-bold text-gray-500">{clientDisplay.charAt(0)}</div>
              )}
            </div>

            {/* Animated Connection Bridge */}
            <div className="flex-1 max-w-[140px] mx-2 relative h-12 flex items-center justify-center">
              {/* Subtle background track */}
              <div className="absolute w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
              
              {/* Flowing energy SVG */}
              <svg className="absolute w-full h-full overflow-visible" viewBox="0 0 100 24" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="flow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#FF6B00" stopOpacity="0.1" />
                    <stop offset="50%" stopColor="#FF9340" stopOpacity="1" />
                    <stop offset="100%" stopColor="#D97757" stopOpacity="0.1" />
                  </linearGradient>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>
                
                {/* Sine wave path connecting left to right */}
                <path 
                  d="M 0,12 C 25,0 75,24 100,12" 
                  fill="none" 
                  stroke="url(#flow-gradient)" 
                  strokeWidth="2.5" 
                  strokeLinecap="round"
                  className="animate-flow-dash"
                  style={{ filter: 'url(#glow)' }}
                />
                
                {/* Secondary inverse wave for DNA/intertwined look */}
                <path 
                  d="M 0,12 C 25,24 75,0 100,12" 
                  fill="none" 
                  stroke="url(#flow-gradient)" 
                  strokeWidth="1.5" 
                  strokeLinecap="round"
                  className="animate-flow-dash opacity-60"
                  style={{ animationDelay: '0.75s', filter: 'url(#glow)' }}
                />
              </svg>
            </div>

            {/* ARGUS Node */}
            <div className="relative z-10 w-[60px] h-[60px] rounded-2xl bg-gradient-to-br from-[#FF6B00] to-[#D97757] border border-orange-400 shadow-xl shadow-orange-500/30 flex items-center justify-center shrink-0">
              <div className="absolute -inset-1 rounded-2xl bg-orange-500/30 animate-pulse-glow pointer-events-none"></div>
              <img src="/LOGO.png" alt="ARGUS Logo" className="w-[30px] h-auto object-contain brightness-0 invert" />
            </div>
            
          </div>
          
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Connect to ARGUS</h1>
          <p className="text-sm text-gray-500 mt-2">
            <span className="text-gray-900 font-semibold">{clientDisplay}</span> wants to use the ARGUS MCP tools
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/60 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden">
          
          {/* What gets access */}
          <div className="p-6 space-y-4 border-b border-gray-100/80">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">This connection will allow:</p>
            <div className="space-y-4">
              {[
                { icon: Zap, label: 'Read files, search code, run commands in your project' },
                { icon: Shield, label: 'Query SigNoz traces, services, and alerts' },
                { icon: DollarSign, label: 'Every tool call is metered against your budget' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-orange-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-700 leading-snug pt-1.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Budget selector */}
          <div className="p-6 bg-gray-50/50 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Session Budget</p>
              <span className="text-[10px] font-medium text-gray-500 bg-gray-200/50 px-2 py-0.5 rounded-full">Blocked at limit</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {BUDGET_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setBudget(opt.value)}
                  className={`py-3 px-4 rounded-2xl border text-left transition-all hover:shadow-md ${
                    budget === opt.value
                      ? 'border-orange-500 bg-orange-50 shadow-orange-500/10 ring-1 ring-orange-500 ring-offset-1'
                      : 'border-gray-200 bg-white hover:border-orange-300'
                  }`}
                >
                  <p className={`text-base font-bold ${budget === opt.value ? 'text-orange-700' : 'text-gray-900'}`}>{opt.label}</p>
                  <p className={`text-[11px] mt-0.5 font-medium ${budget === opt.value ? 'text-orange-600/80' : 'text-gray-500'}`}>{opt.desc}</p>
                </button>
              ))}
            </div>
            
            <p className="text-[12px] font-medium text-gray-500 text-center pt-2">
              Selected: <span className="text-orange-600 font-bold font-mono bg-orange-50 px-1.5 py-0.5 rounded-md">${budget}.00</span> — ARGUS will block {clientDisplay} when consumed.
            </p>
          </div>

          {/* Action buttons */}
          <div className="p-6 bg-white border-t border-gray-100/80 space-y-4">
            
            {/* Expiry notice */}
            {minsLeft <= 5 && minsLeft > 0 && (
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-amber-600 bg-amber-50 py-2 rounded-xl">
                <AlertTriangle className="w-3.5 h-3.5" />
                Request expires in {minsLeft} minute{minsLeft !== 1 ? 's' : ''}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleDeny}
                disabled={denying || approving}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm transition-colors disabled:opacity-50"
              >
                {denying ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Deny
              </button>
              <button
                onClick={handleApprove}
                disabled={approving || denying}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-[#D97757]/30"
                style={{ background: 'linear-gradient(135deg, #FF6B00, #FF9340)' }}
              >
                {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Approve
              </button>
            </div>
          </div>

        </div>
        
        <p className="text-center text-[11px] font-medium text-gray-400">
          ARGUS · AI Agent Runtime Governance
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
