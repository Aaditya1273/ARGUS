'use client'

import { useEffect, useRef, useState, useCallback, Fragment } from 'react'
import Link from 'next/link'
import {
  Shield, ArrowRight, Play, ChevronDown,
  Lock, Globe, Github, CheckCircle, XCircle,
  Zap, Scale, Cpu,
} from 'lucide-react'
import { Caveat } from 'next/font/google'

const caveat = Caveat({ subsets: ['latin'], weight: '400' })

/* ══════════════════════════════════════════════════════════════
   HOOKS
   ══════════════════════════════════════════════════════════════ */

function useReveal<T extends HTMLElement>(threshold = 0.1): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null)
  const [v, setV] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); o.unobserve(el) } }, { threshold })
    o.observe(el); return () => o.disconnect()
  }, [threshold])
  return [ref, v]
}

function useCounter(target: number, dur: number, start: boolean): number {
  const [c, setC] = useState(0)
  useEffect(() => {
    if (!start) return; let t: number | null = null
    const fn = (ts: number) => { if (!t) t = ts; const p = Math.min((ts - t) / dur, 1); setC(Math.floor((1 - Math.pow(1 - p, 3)) * target)); if (p < 1) requestAnimationFrame(fn) }
    requestAnimationFrame(fn)
  }, [target, dur, start])
  return c
}

function useScrollPosition() {
  const [y, setY] = useState(0)
  useEffect(() => {
    let ticking = false
    const h = () => {
      if (!ticking) {
        requestAnimationFrame(() => { setY(window.scrollY); ticking = false })
        ticking = true
      }
    }
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])
  return y
}

/* ══════════════════════════════════════════════════════════════
   DATA
   ══════════════════════════════════════════════════════════════ */

const trustMetrics = [
  { value: 99.99, suffix: '%', label: 'Uptime SLA' },
  { value: 100000, suffix: '+', label: 'Agents Protected' },
  { value: 50000, suffix: '+', label: 'Policies Enforced' },
  { value: 5, suffix: 'M+', label: 'Tool Calls Analyzed' },
]

const governancePlugins = [
  { name: 'Infinite Loop Detection', severity: 'CRITICAL', action: 'KILL_RUN', desc: 'Same tool called >5× in a row' },
  { name: 'Token Explosion Prevention', severity: 'CRITICAL', action: 'KILL_RUN', desc: 'Single call exceeds 10k tokens' },
  { name: 'Budget Exceeded', severity: 'CRITICAL', action: 'KILL_RUN', desc: 'Session cost exceeds configured limit' },
  { name: 'Latency Spike Detection', severity: 'HIGH', action: 'TRIGGER_FALLBACK', desc: 'Response time >5× baseline' },
  { name: 'Agent Stuck Detection', severity: 'HIGH', action: 'ALERT', desc: 'No progress detected for >2 minutes' },
  { name: 'Retry Storm Prevention', severity: 'MEDIUM', action: 'CIRCUIT_BREAKER', desc: 'Same operation retried >10×' },
  { name: 'Repeated Prompt Detection', severity: 'MEDIUM', action: 'ALERT', desc: 'Same prompt submitted >3×' },
  { name: 'Prompt Recursion Guard', severity: 'HIGH', action: 'KILL_RUN', desc: 'Prompt contains its own output' },
  { name: 'Tool Timeout Enforcement', severity: 'HIGH', action: 'ALERT', desc: 'Tool call exceeds 30s timeout' },
]

const policies = [
  { name: 'Production Budget Cap', metric: 'cost/session', threshold: '$25.00', operator: '>', action: 'KILL_RUN', active: true },
  { name: 'Dev Budget Warning', metric: 'cost/session', threshold: '$5.00', operator: '>', action: 'ALERT', active: true },
  { name: 'Token Limit', metric: 'tokens/call', threshold: '10,000', operator: '>', action: 'KILL_RUN', active: true },
  { name: 'Latency Threshold', metric: 'ms/response', threshold: '5,000', operator: '>', action: 'CIRCUIT_BREAKER', active: true },
]

const integrations = [
  { name: 'Claude Web', type: 'OAuth 2.1 + PKCE' },
  { name: 'Claude Desktop', type: 'MCP SSE' },
  { name: 'Claude Code', type: 'MCP HTTP' },
  { name: 'Cursor', type: 'MCP SSE' },
  { name: 'VS Code', type: 'MCP SSE' },
  { name: 'OpenAI', type: 'API' },
  { name: 'LangChain', type: 'SDK' },
  { name: 'SigNoz', type: 'OpenTelemetry' },
  { name: 'Any MCP Client', type: 'HTTP / SSE' },
]

/* ─── Terminal log entries ─── */
const logEntries = [
  { time: '14:23:01', tool: 'read_file', args: '"src/config.ts"', cost: '$0.001', policy: 'PASS', type: 'pass' },
  { time: '14:23:02', tool: 'search_code', args: '"API_KEY"', cost: '$0.002', policy: 'BLOCKED', type: 'block' },
  { time: '14:23:03', tool: 'run_command', args: '"git push origin main"', cost: '$0.003', policy: 'BLOCKED', type: 'block' },
  { time: '14:23:04', tool: 'list_directory', args: '"./src"', cost: '$0.001', policy: 'PASS', type: 'pass' },
  { time: '14:23:05', tool: 'analyze_codebase', args: '()', cost: '$0.005', policy: 'PASS', type: 'pass' },
  { time: '14:23:06', tool: 'run_command', args: '"npm run build"', cost: '$0.003', policy: 'PASS', type: 'pass' },
  { time: '14:23:07', tool: 'read_file', args: '".env.production"', cost: '$0.001', policy: 'BLOCKED', type: 'block' },
  { time: '14:23:08', tool: 'search_code', args: '"password"', cost: '$0.002', policy: 'BLOCKED', type: 'block' },
  { time: '14:23:09', tool: 'list_directory', args: '"../.."', cost: '$0.001', policy: 'PASS', type: 'pass' },
  { time: '14:23:10', tool: 'signoz_query_traces', args: '("session_abc")', cost: '$0.002', policy: 'PASS', type: 'pass' },
]

/* ══════════════════════════════════════════════════════════════
   COMPONENTS
   ══════════════════════════════════════════════════════════════ */

/* ─── Navigation (curved + floating) ─── */
function Navigation() {
  const scrollY = useScrollPosition()
  const scrolled = scrollY > 80

  return (
    <nav className={`fixed z-50 transition-all duration-700 ${
      scrolled ? 'top-3 left-4 right-4' : 'top-4 left-0 right-0'
    }`}>
      {/* Background + blur layer — always present, fades via opacity */}
      <div className={`absolute inset-0 rounded-2xl transition-opacity duration-700 ${
        scrolled ? 'opacity-100' : 'opacity-0'
      }`}>
        <div className="w-full h-full rounded-2xl bg-white/85 backdrop-blur-2xl border border-gray-200/80 shadow-[0_8px_32px_rgba(0,0,0,0.06)]" />
      </div>
      {/* Content — same max-w always, constrained by outer nav width */}
      <div className="relative mx-auto max-w-7xl">
        <div className="h-14 flex items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-7 h-7 rounded-lg bg-black flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight">ARGUS</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            {['Product', 'Governance', 'Policies', 'Architecture'].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`}
                className="text-sm text-gray-400 hover:text-black transition-colors">
                {item}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-400 hover:text-black transition-colors px-3 py-1.5">Sign In</Link>
            <Link href="/login" className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-lg bg-[#FF6B00] text-white hover:bg-[#CC5500] transition-all duration-300">
              Deploy ARGUS <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}

/* ─── Section Header ─── */
function SectionHeader({ label, title, desc, centered = false }: { label: string; title: string; desc: string; centered?: boolean }) {
  const [ref, v] = useReveal<HTMLDivElement>()
  return (
    <div ref={ref} className={`reveal ${v ? 'visible' : ''} ${centered ? 'text-center mx-auto' : ''}`} style={{ maxWidth: centered ? '640px' : undefined }}>
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-semibold uppercase tracking-wider text-gray-400 border border-gray-200 bg-gray-50 mb-6">
        / {label}
      </span>
      <h2 className="h2 text-black mb-4">{title}</h2>
      <p className="subtitle max-w-2xl">{desc}</p>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SECTION 1 — HERO with Runtime Pipeline + Live Terminal
   ══════════════════════════════════════════════════════════════ */

function RuntimePipeline() {
  const nodes = [
    { id: 'claude', label: 'AI Agent', icon: 'cpu', active: true },
    { id: 'gateway', label: 'ARGUS\nGateway', icon: 'zap', active: true },
    { id: 'policy', label: 'Policy\nEngine', icon: 'scale', active: true },
    { id: 'decision', label: 'Decision', icon: 'decision', active: true },
  ]
  const [activePacket, setActivePacket] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setActivePacket((p) => (p + 1) % 3), 2200)
    return () => clearInterval(t)
  }, [])

  const renderIcon = (icon: string, isDecision: boolean) => {
    if (isDecision) {
      return activePacket % 2 === 0
        ? <CheckCircle className="w-6 h-6 text-green-500" />
        : <XCircle className="w-6 h-6 text-red-500" />
    }
    switch (icon) {
      case 'zap': return <Zap className="w-5 h-5 text-orange-500" />
      case 'scale': return <Scale className="w-5 h-5" />
      case 'cpu': return <Cpu className="w-5 h-5" />
      default: return <Shield className="w-5 h-5" />
    }
  }

  return (
    <div className="pipeline-container max-w-3xl mx-auto">
      {nodes.map((node, i) => (
        <Fragment key={node.id}>
          {i > 0 && (
            <div className={`pipeline-line ${node.active ? 'active' : ''}`} style={{ height: 2, flex: '0 1 120px' }}>
              {activePacket === (i - 1) && (
                <div className="pipeline-packet" />
              )}
            </div>
          )}
          <div className={`pipeline-node ${node.active ? 'active' : ''}`}>
            <div className="pipeline-node-circle" style={{ width: 64, height: 64 }}>
              {renderIcon(node.icon, node.id === 'decision')}
            </div>
            <div className="pipeline-node-label" style={{ whiteSpace: 'pre-line' }}>{node.label}</div>
            {node.active && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-orange-500 animate-pulse-dot" />
            )}
          </div>
        </Fragment>
      ))}
      {/* Target systems after decision */}
      <div className="flex items-center gap-2 mt-6 pt-4 border-t border-gray-100">
        <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider mr-2">Targets</span>
        {['Filesystem', 'Terminal', 'GitHub', 'Database', 'Slack'].map((t) => (
          <span key={t} className="px-2 py-1 rounded text-[10px] font-mono border border-gray-200 text-gray-400 bg-gray-50">
            {t}
          </span>
        ))}
      </div>
      {/* Decision arrows */}
      <div className="flex gap-8 mt-3">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-gray-400">ALLOW</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-gray-400">BLOCK</span>
        </div>
      </div>
    </div>
  )
}

function LiveTerminal() {
  const [visible, setVisible] = useState(0)
  const [entry, setEntry] = useState(0)
  const [budget, setBudget] = useState(0)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    const t = setInterval(() => {
      setVisible((v) => Math.min(v + 1, logEntries.length))
      setEntry((e) => (e + 1) % logEntries.length)
      setBudget((b) => {
        const inc = Number((Math.random() * 0.005).toFixed(4))
        const nb = b + inc
        if (nb > 0.025) setBlocked(true)
        return nb
      })
    }, 1200)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="terminal w-full max-w-3xl mx-auto">
      <div className="terminal-header">
        <span className="terminal-dot red" />
        <span className="terminal-dot yellow" />
        <span className="terminal-dot green" />
        <span className="terminal-title">argus — runtime intercept (PID 8421)</span>
        <span className="ml-auto text-xs text-gray-500">◉ live</span>
      </div>
      <div className="terminal-body" style={{ maxHeight: 320 }}>
        {/* Budget bar */}
        <div className="mb-3 pb-3 border-b border-gray-700">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-gray-400">session budget</span>
            <span className={blocked ? 'terminal-block' : 'terminal-cost'}>
              {blocked ? 'BLOCKED' : `$${budget.toFixed(4)} / $5.00`}
            </span>
          </div>
          <div className="progress">
            <div className={`progress-fill ${blocked ? 'danger' : ''}`}
              style={{ width: `${Math.min((budget / 5) * 100, 100)}%` }} />
          </div>
        </div>

        {/* Log stream */}
        {logEntries.slice(0, visible).map((log, i) => (
          <div key={i} className="terminal-line" style={{ animationDelay: `${i * 0.1}s` }}>
            <span className="terminal-time">{log.time}</span>
            <span className="terminal-arrow">→</span>
            <span className="terminal-tool">{log.tool}</span>
            <span className="terminal-detail">({log.args})</span>
            <span className="ml-auto flex items-center gap-3">
              <span className="terminal-cost">{log.cost}</span>
              <span className={log.type === 'pass' ? 'terminal-pass' : 'terminal-block'}>
                {log.policy}
              </span>
            </span>
          </div>
        ))}

        {/* Live cursor */}
        <div className="terminal-line" style={{ opacity: 1 }}>
          <span className="terminal-time text-gray-600">--:--:--</span>
          <span className="terminal-arrow opacity-50">█</span>
        </div>
      </div>
    </div>
  )
}

function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-24 pb-20 overflow-hidden bg-[#fafafa]">
      
      {/* Background Mountain — seamless blend */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img src="/bg-mountain.png" alt="Mountains" className="w-full h-full object-cover object-right mix-blend-multiply opacity-100" />
      </div>
      
      {/* Background Lines */}
      <div className="absolute top-0 right-0 w-[65%] h-[80%] pointer-events-none z-[1]">
        <img src="/bg-lines.png" alt="Lines" className="w-full h-full object-contain object-right-top opacity-50" />
      </div>

      <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 lg:px-12 grid grid-cols-1 md:grid-cols-[45%_55%] gap-12 items-center">
        {/* Left Content */}
        <div className="space-y-6 pt-10 pb-16">
          {/* Status badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-gray-200 bg-white/60 backdrop-blur-sm text-[11px] font-mono text-gray-700">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse-dot" />
            v1.0.0 — Runtime Control Plane
          </div>

          {/* Headline */}
          <div className="relative z-20">
            <h1 className="text-[4.5rem] xl:text-[5.5rem] leading-[1.0] font-bold text-[#0A0A0A] tracking-[-0.03em]">
              Every AI<br />Tool Call.
            </h1>
            <div className={`mt-2 ${caveat.className}`} style={{ transform: 'rotate(-4deg) translateY(-5px)' }}>
              <div className="text-[3.8rem] xl:text-[4.8rem] leading-[1.1] text-[#FF6B00]">Observed.</div>
              <div className="text-[3.8rem] xl:text-[4.8rem] leading-[1.1] text-[#0D1117]">Governed.</div>
              <div className="text-[3.8rem] xl:text-[4.8rem] leading-[1.1] text-[#FF6B00]">Enforced.</div>
            </div>
          </div>

          {/* Subheadline */}
          <p className="text-[15px] max-w-[420px] text-gray-600 leading-relaxed font-medium">
            ARGUS intercepts every AI tool call before execution, evaluates enterprise policies in milliseconds, and automatically blocks unsafe, expensive, or non-compliant behaviour.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
            <Link href="/login" className="px-8 py-3.5 bg-[#FF6B00] hover:bg-[#CC5500] text-white rounded-lg font-semibold text-[15px] transition-all flex items-center gap-2">
              Deploy ARGUS <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#product" className="px-8 py-3.5 bg-white hover:bg-gray-50 text-gray-800 rounded-lg font-semibold text-[15px] transition-all border border-gray-200 shadow-sm flex items-center gap-2">
              <Play className="w-4 h-4 text-gray-600" /> View Live Runtime
            </a>
          </div>
        </div>

        {/* Right Content - 3D Shield */}
        <div className="relative h-full min-h-[500px] md:min-h-[700px] flex items-center justify-center pointer-events-none mt-10 md:mt-0">
          <img 
            src="/hero-shield.png" 
            alt="ARGUS Shield" 
            className="absolute z-10 w-[110%] max-w-[850px] right-[-5%] top-1/2 -translate-y-1/2 drop-shadow-2xl"
          />
        </div>
      </div>
      
      {/* Bottom Trust Badges (Floating Dark Pill) */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-[90%] md:max-w-4xl px-4 z-20 hidden md:block">
        <div className="flex flex-wrap items-center justify-center md:justify-between gap-6 px-10 py-5 rounded-2xl bg-gray-900/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] text-white">
          <span className="flex items-center gap-2.5 text-sm font-medium"><Shield className="w-4 h-4 text-[#FF6B00]" /> 99.99% Uptime SLA</span>
          <span className="flex items-center gap-2.5 text-sm font-medium"><Lock className="w-4 h-4 text-[#FF6B00]" /> SOC 2 Compliant</span>
          <span className="flex items-center gap-2.5 text-sm font-medium"><Globe className="w-4 h-4 text-[#FF6B00]" /> Deploy Anywhere</span>
          <span className="flex items-center gap-2.5 text-sm font-medium"><Github className="w-4 h-4 text-[#FF6B00]" /> Open Source</span>
        </div>
      </div>
    </section>
  )
}


/* ══════════════════════════════════════════════════════════════
   SECTION 2 — Enterprise Trust Metrics
   ══════════════════════════════════════════════════════════════ */

function TrustMetrics() {
  const [ref, v] = useReveal<HTMLDivElement>()
  return (
    <section id="metrics" className="section-pad border-t border-gray-100">
      <div className="section-container">
        <div ref={ref} className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-100 rounded-xl overflow-hidden border border-gray-100">
          {trustMetrics.map((m) => (
            <MetricCard key={m.label} metric={m} visible={v} />
          ))}
        </div>
      </div>
    </section>
  )
}

function MetricCard({ metric, visible }: { metric: typeof trustMetrics[0]; visible: boolean }) {
  const count = useCounter(metric.value, 2000, visible)
  return (
    <div className="bg-white p-8 md:p-10 text-center">
      <div className="stat-number">
        {count.toLocaleString()}{metric.suffix}
      </div>
      <p className="stat-label">{metric.label}</p>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SECTION 3 — Live Product Dashboard
   ══════════════════════════════════════════════════════════════ */

function ProductDashboard() {
  const [ref, v] = useReveal<HTMLDivElement>()

  const agents = [
    { id: 'claude-web-DpRr3vJ6jKfP', status: 'RUNNING', cost: 0.042, tokens: 12453, latency: 342, tool: 'search_code' },
    { id: 'claude-desktop-9xK2mN4', status: 'PAUSED', cost: 0.018, tokens: 5892, latency: 189, tool: 'read_file' },
    { id: 'demo-agent-v3', status: 'RUNNING', cost: 0.091, tokens: 28451, latency: 567, tool: 'analyze_codebase' },
    { id: 'ci-pipeline-agent', status: 'BLOCKED', cost: 0.153, tokens: 45210, latency: 1200, tool: 'run_command' },
  ]

  return (
    <section id="product" className="section-pad bg-gray-50 border-t border-gray-100">
      <div className="section-container">
        <SectionHeader
          label="Product"
          title="Live Runtime Dashboard"
          desc="Real-time visibility into every connected agent, policy evaluation, and cost burn."
        />
        <div ref={ref} className={`reveal ${v ? 'visible' : ''}`}>
          <div className="dashboard-mock">
            {/* Mock browser chrome */}
            <div className="dashboard-mock-header">
              <span className="text-xs text-gray-400 font-mono">argus.localhost/mission-control</span>
              <div className="ml-auto flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gray-300" />
                <span className="w-2 h-2 rounded-full bg-gray-300" />
                <span className="w-2 h-2 rounded-full bg-red-500" />
              </div>
            </div>
            {/* Mock dashboard content */}
            <div className="flex">
              <div className="dashboard-mock-sidebar hidden md:block">
                {['Mission Control', 'Cost Firewall', 'Agent DNA', 'Governance', 'Plugins', 'Settings'].map((item) => (
                  <button key={item}
                    className={`w-full text-left px-3 py-2 rounded text-xs font-medium mb-0.5 transition-colors ${
                      item === 'Mission Control' ? 'bg-orange-50 text-orange-600' : 'text-gray-400 hover:text-gray-600'
                    }`}>
                    {item}
                  </button>
                ))}
              </div>
              {/* Stats + table */}
              <div className="flex-1 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold">Connected Agents</h3>
                  <span className="text-xs text-gray-400 font-mono">{agents.filter(a => a.status === 'RUNNING').length} / {agents.length} online</span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-100">
                      <th className="text-left font-medium pb-2 pr-4">Agent</th>
                      <th className="text-left font-medium pb-2 pr-4">Status</th>
                      <th className="text-right font-medium pb-2 pr-4">Cost</th>
                      <th className="text-right font-medium pb-2 pr-4">Tokens</th>
                      <th className="text-right font-medium pb-2 pr-4">Latency</th>
                      <th className="text-left font-medium pb-2 pr-4">Tool</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((a) => (
                      <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="py-2.5 pr-4 font-mono text-gray-500">{a.id.slice(0, 16)}…</td>
                        <td className="py-2.5 pr-4">
                          <span className={`badge ${
                            a.status === 'RUNNING' ? 'badge-pass' : a.status === 'PAUSED' ? 'badge-warn' : 'badge-block'
                          }`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono text-orange-600">${a.cost.toFixed(3)}</td>
                        <td className="py-2.5 pr-4 text-right font-mono text-gray-500">{a.tokens.toLocaleString()}</td>
                        <td className="py-2.5 pr-4 text-right font-mono text-gray-500">{a.latency}ms</td>
                        <td className="py-2.5 pr-4 text-gray-400 font-mono">{a.tool}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ══════════════════════════════════════════════════════════════
   SECTION 4 — Runtime Governance Engine
   ══════════════════════════════════════════════════════════════ */

const severityColors: Record<string, string> = {
  CRITICAL: 'text-red-600 bg-red-50 border-red-200',
  HIGH: 'text-orange-600 orange-bg-soft border-orange-200',
  MEDIUM: 'text-amber-600 bg-amber-50 border-amber-200',
}

const severityDots: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-amber-500',
}

function GovernanceEngine() {
  const [ref, v] = useReveal<HTMLDivElement>()
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <section id="governance" className="section-pad border-t border-gray-100">
      <div className="section-container">
        <SectionHeader
          label="Governance"
          title="Runtime Governance Engine"
          desc="Nine detection plugins evaluate every tool call. When a rule fires, ARGUS executes the configured action — instantly."
        />
        <div ref={ref} className={`reveal ${v ? 'visible' : ''}`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {governancePlugins.map((plugin) => (
              <div key={plugin.name}
                onMouseEnter={() => setHovered(plugin.name)}
                onMouseLeave={() => setHovered(null)}
                className={`card-enterprise p-5 transition-all duration-200 ${
                  hovered === plugin.name ? 'border-orange-300' : ''
                }`}>
                <div className="flex items-start justify-between mb-3">
                  <span className="text-sm font-semibold text-black">{plugin.name}</span>
                  <span className={`badge ${severityColors[plugin.severity]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${severityDots[plugin.severity]}`} />
                    {plugin.severity}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-3">{plugin.desc}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">Action</span>
                  <code className="text-[11px] font-mono text-orange-600 bg-orange-light px-1.5 py-0.5 rounded">
                    {plugin.action}
                  </code>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ══════════════════════════════════════════════════════════════
   SECTION 5 — Policy Engine
   ══════════════════════════════════════════════════════════════ */

function PolicyEngine() {
  const [ref, v] = useReveal<HTMLDivElement>()
  return (
    <section id="policies" className="section-pad bg-gray-50 border-t border-gray-100">
      <div className="section-container">
        <SectionHeader
          label="Policies"
          title="Policy Engine"
          desc="Define budget limits, behavioral rules, and automated responses. No coding required — policies evaluate in milliseconds."
        />
        <div ref={ref} className={`reveal ${v ? 'visible' : ''}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {policies.map((p) => (
              <div key={p.name} className="card-enterprise p-6 flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-black">{p.name}</span>
                    <span className={`badge ${p.active ? 'badge-pass' : 'badge-neutral'}`}>
                      {p.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono text-gray-400">
                    <span>{p.metric}</span>
                    <span className="text-gray-300">{p.operator}</span>
                    <span className="text-orange-600 font-semibold">{p.threshold}</span>
                  </div>
                </div>
                <code className="text-[10px] font-mono text-orange-600 bg-orange-light px-2 py-1 rounded uppercase">
                  {p.action}
                </code>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ══════════════════════════════════════════════════════════════
   SECTION 6 — Cost Firewall
   ══════════════════════════════════════════════════════════════ */

function CostFirewallSection() {
  const [ref, v] = useReveal<HTMLDivElement>()
  const burnRate = useCounter(247, 2000, v)
  const blockedCount = useCounter(89, 2000, v)
  const savedAmount = useCounter(12430, 2500, v)

  return (
    <section id="cost-firewall" className="section-pad border-t border-gray-100">
      <div className="section-container">
        <SectionHeader
          label="Cost"
          title="Cost Firewall"
          desc="Every tool call is metered against a per-session budget. When the burn rate spikes, ARGUS automatically cuts the connection."
        />
        <div ref={ref} className={`reveal ${v ? 'visible' : ''}`}>
          <div className="dashboard-mock">
            <div className="p-6">
              {/* Mock cost chart */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Burn Rate</span>
                  <span className="text-lg font-bold font-mono">${burnRate.toFixed(2)}<span className="text-sm text-gray-400 font-normal">/hr</span></span>
                </div>
                <div className="h-24 flex items-end gap-1">
                  {Array.from({ length: 24 }).map((_, i) => {
                    const h = 20 + Math.sin(i * 0.5) * 15 + Math.random() * 20
                    return (
                      <div key={i}
                        className="flex-1 rounded-sm transition-all duration-300"
                        style={{
                          height: `${h}%`,
                          background: i > 20 ? 'var(--orange)' : 'var(--gray-200)',
                        }}
                      />
                    )
                  })}
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="stat-number text-xl">${savedAmount.toLocaleString()}</div>
                  <p className="stat-label text-xs">Cost Saved</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="stat-number text-xl">{blockedCount.toLocaleString()}</div>
                  <p className="stat-label text-xs">Excessive Calls Blocked</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-orange-light border border-orange-200">
                  <div className="stat-number text-xl text-orange-600">$100.00</div>
                  <p className="stat-label text-xs">Default Session Limit</p>
                </div>
              </div>

              {/* Budget bar */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                  <span>Current session burn</span>
                  <span className="font-mono text-orange-600">$24.68 / $100.00</span>
                </div>
                <div className="progress"><div className="progress-fill" style={{ width: '24.68%' }} /></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ══════════════════════════════════════════════════════════════
   SECTION 7 — Live Mission Control
   ══════════════════════════════════════════════════════════════ */

function MissionControlSection() {
  const [ref, v] = useReveal<HTMLDivElement>()
  return (
    <section id="mission-control" className="section-pad bg-gray-50 border-t border-gray-100">
      <div className="section-container">
        <SectionHeader
          label="Control"
          title="Live Mission Control"
          desc="Every connected agent in a single pane. Kill, pause, or resume any agent in real time."
        />
        <div ref={ref} className={`reveal ${v ? 'visible' : ''}`}>
          <div className="dashboard-mock">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse-dot" />
                  <span className="text-xs font-mono text-gray-500">4 agents connected · 2 running</span>
                </div>
                <span className="text-xs text-gray-400">Auto-refresh 5s</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-200">
                    <th className="text-left font-medium pb-2.5 pr-4">Agent</th>
                    <th className="text-left font-medium pb-2.5 pr-4">Status</th>
                    <th className="text-right font-medium pb-2.5 pr-4">Cost</th>
                    <th className="text-right font-medium pb-2.5 pr-4">Tokens</th>
                    <th className="text-right font-medium pb-2.5 pr-4">Latency</th>
                    <th className="text-left font-medium pb-2.5">Last Tool</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: 'claude-web-8xK2mN4', status: 'RUNNING' as const, cost: 0.042, tokens: 12453, latency: 342, tool: 'search_code' },
                    { id: 'claude-dsktp-3jF9pQ7', status: 'PAUSED' as const, cost: 0.018, tokens: 5892, latency: 189, tool: 'read_file' },
                    { id: 'ci-agent-v2', status: 'RUNNING' as const, cost: 0.091, tokens: 28451, latency: 567, tool: 'analyze_codebase' },
                    { id: 'prod-pipeline', status: 'BLOCKED' as const, cost: 0.153, tokens: 45210, latency: 1200, tool: 'run_command' },
                  ].map((a) => (
                    <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="py-2.5 pr-4 font-mono text-gray-500 text-[11px]">{a.id}</td>
                      <td className="py-2.5 pr-4">
                        <span className={`badge ${a.status === 'RUNNING' ? 'badge-pass' : a.status === 'PAUSED' ? 'badge-warn' : 'badge-block'}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono text-orange-600">${a.cost.toFixed(3)}</td>
                      <td className="py-2.5 pr-4 text-right font-mono text-gray-500">{a.tokens.toLocaleString()}</td>
                      <td className="py-2.5 pr-4 text-right font-mono text-gray-500">{a.latency}ms</td>
                      <td className="py-2.5 text-gray-400 font-mono">{a.tool}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ══════════════════════════════════════════════════════════════
   SECTION 8 — Agent Runtime Architecture
   ══════════════════════════════════════════════════════════════ */

function ArchitectureDiagram() {
  const [activeNode, setActiveNode] = useState<string | null>(null)

  const layers = [
    { id: 'client', label: 'Client Layer', items: ['Claude Web', 'Claude Desktop', 'Cursor', 'VS Code', 'OpenAI SDK'], color: 'text-gray-500' },
    { id: 'gateway', label: 'ARGUS Gateway', items: ['OAuth 2.1 + PKCE', 'MCP Server', 'WebSocket', 'REST API'], color: 'text-orange-600' },
    { id: 'engine', label: 'Governance Engine', items: ['9 Detection Plugins', 'Policy Evaluator', 'Cost Meter', 'Agent DNA'], color: 'text-orange-600' },
    { id: 'action', label: 'Enforcement', items: ['KILL_RUN', 'ALERT', 'CIRCUIT_BREAKER', 'TRIGGER_FALLBACK'], color: 'text-orange-600' },
    { id: 'telemetry', label: 'Telemetry', items: ['OpenTelemetry', 'SigNoz Cloud', 'Live Dashboard', 'Audit Logs'], color: 'text-gray-500' },
  ]

  return (
    <div className="space-y-0">
      {layers.map((layer, i) => (
        <div key={layer.id}
          onMouseEnter={() => setActiveNode(layer.id)}
          onMouseLeave={() => setActiveNode(null)}
          className="flex items-stretch gap-4 group">
          {/* Layer label */}
          <div className="w-32 flex-shrink-0 flex items-center justify-end pr-4">
            <span className={`text-[10px] font-mono font-semibold uppercase tracking-wider transition-colors ${
              activeNode === layer.id ? 'text-orange-600' : 'text-gray-400'
            }`}>
              {layer.label}
            </span>
          </div>
          {/* Connection line */}
          <div className="relative flex items-center">
            <div className={`w-px h-full min-h-[56px] transition-colors ${
              activeNode === layer.id ? 'bg-orange-400' : 'bg-gray-200'
            }`} />
            {i < layers.length - 1 && (
              <div className={`absolute bottom-0 left-0 w-3 h-px transition-colors ${
                activeNode === layer.id ? 'bg-orange-400' : 'bg-gray-200'
              }`} />
            )}
          </div>
          {/* Items */}
          <div className="flex-1 py-3 flex flex-wrap items-center gap-2">
            {layer.items.map((item) => (
              <span key={item} className={`px-3 py-1.5 rounded text-xs font-mono border transition-all duration-200 ${
                activeNode === layer.id
                  ? 'border-orange-300 bg-orange-light text-orange-700'
                  : 'border-gray-200 bg-white text-gray-500'
              }`}>
                {item}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ArchitectureSection() {
  const [ref, v] = useReveal<HTMLDivElement>()
  return (
    <section id="architecture" className="section-pad border-t border-gray-100">
      <div className="section-container">
        <SectionHeader
          label="Architecture"
          title="Agent Runtime Architecture"
          desc="From client connection to policy enforcement to telemetry — every layer is observable, governable, and auditable."
        />
        <div ref={ref} className={`reveal ${v ? 'visible' : ''}`}>
          <div className="card-enterprise p-8">
            <ArchitectureDiagram />
          </div>
        </div>
      </div>
    </section>
  )
}

/* ══════════════════════════════════════════════════════════════
   SECTION 9 — Integrations
   ══════════════════════════════════════════════════════════════ */

function IntegrationsSection() {
  const [ref, v] = useReveal<HTMLDivElement>()
  return (
    <section className="section-pad bg-gray-50 border-t border-gray-100">
      <div className="section-container">
        <SectionHeader
          label="Integrations"
          title="Works With Everything"
          desc="Connect any MCP-compatible client, SDK, or API. ARGUS integrates with your existing infrastructure."
          centered
        />
        <div ref={ref} className={`reveal ${v ? 'visible' : ''}`}>
          <div className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
            {integrations.map((int) => (
              <div key={int.name} className="integration-chip group">
                <span className="text-sm font-medium text-gray-600 group-hover:text-orange-600 transition-colors">{int.name}</span>
                <span className="text-[10px] font-mono text-gray-300 group-hover:text-orange-400 transition-colors">{int.type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ══════════════════════════════════════════════════════════════
   SECTION 10 — Security & Compliance
   ══════════════════════════════════════════════════════════════ */

function SecuritySection() {
  const [ref, v] = useReveal<HTMLDivElement>()
  const items = [
    { title: 'OAuth 2.1 + PKCE', desc: 'Authorization Code Flow with Proof Key for Code Exchange. No secrets are shared with client applications.' },
    { title: 'End-to-End Encryption', desc: 'All tool call payloads encrypted in transit via TLS 1.3. Audit logs encrypted at rest with AES-256.' },
    { title: 'Fine-Grained Authorization', desc: 'OpenFGA-based relationship tuples. Define who can access what at the resource level.' },
    { title: 'Audit Trail', desc: 'Every policy evaluation, tool call, and enforcement action is logged with full context for compliance.' },
  ]
  return (
    <section className="section-pad border-t border-gray-100">
      <div className="section-container">
        <SectionHeader
          label="Security"
          title="Enterprise Security & Compliance"
          desc="SOC 2 compliant architecture with OAuth 2.1, encryption, and full audit trails."
        />
        <div ref={ref} className={`reveal ${v ? 'visible' : ''}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item) => (
              <div key={item.title} className="card-enterprise p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Lock className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-semibold text-black">{item.title}</span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          {/* Compliance badges */}
          <div className="flex flex-wrap gap-4 mt-8 justify-center">
            {['SOC 2 Type II', 'ISO 27001', 'GDPR', 'HIPAA Eligible', 'Open Source'].map((badge) => (
              <div key={badge} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-500">
                <CheckCircle className="w-3.5 h-3.5 text-orange-600" />
                {badge}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ══════════════════════════════════════════════════════════════
   SECTION 11 — Open Source
   ══════════════════════════════════════════════════════════════ */

function OpenSourceSection() {
  const [ref, v] = useReveal<HTMLDivElement>()
  const stars = useCounter(12500, 2500, v)
  const contributors = useCounter(340, 2500, v)

  return (
    <section className="section-pad bg-gray-50 border-t border-gray-100">
      <div className="section-container">
        <SectionHeader
          label="Open Source"
          title="Built in the Open"
          desc="ARGUS is open source. Audit the code, contribute, or self-host on your own infrastructure."
          centered
        />
        <div ref={ref} className={`reveal ${v ? 'visible' : ''}`}>
          <div className="max-w-xl mx-auto">
            <div className="card-enterprise p-8 text-center space-y-6">
              <Github className="w-10 h-10 text-black mx-auto" />
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <div className="stat-number text-2xl">{stars.toLocaleString()}</div>
                  <p className="stat-label text-xs">GitHub Stars</p>
                </div>
                <div>
                  <div className="stat-number text-2xl">{contributors.toLocaleString()}</div>
                  <p className="stat-label text-xs">Contributors</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a href="https://github.com/SigNoz/signoz" target="_blank" rel="noopener noreferrer"
                  className="btn-primary text-sm !py-2.5 !px-6">
                  <Github className="w-4 h-4" /> Star on GitHub
                </a>
                <a href="#" className="btn-secondary text-sm !py-2.5 !px-6">
                  View Documentation
                </a>
              </div>
              <p className="text-xs text-gray-400 font-mono">Apache 2.0 License · No telemetry by default</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ══════════════════════════════════════════════════════════════
   SECTION 12 — Enterprise CTA
   ══════════════════════════════════════════════════════════════ */

function EnterpriseCTA() {
  const [ref, v] = useReveal<HTMLDivElement>()
  return (
    <section className="section-pad border-t border-gray-100">
      <div ref={ref} className={`reveal ${v ? 'visible' : ''}`}>
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="w-16 h-16 rounded-2xl bg-black flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h2 className="h1 text-black">
            Ready to Govern Your
            <br />
            <span className="orange-text">AI Runtime</span>?
          </h2>
          <p className="subtitle max-w-xl mx-auto text-gray-400">
            Deploy in minutes. Connect any AI client. Enforce enterprise policies from day one.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login" className="btn-primary text-base !py-3.5 !px-8">
              Deploy ARGUS <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#" className="btn-secondary text-base !py-3.5 !px-8">
              <Play className="w-4 h-4" /> Schedule Demo
            </a>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-gray-400 pt-2">
            <span>Free 14-day trial</span>
            <span className="w-px h-3 bg-gray-200" />
            <span>No credit card</span>
            <span className="w-px h-3 bg-gray-200" />
            <span>Self-host available</span>
            <span className="w-px h-3 bg-gray-200" />
            <span>SOC 2 compliant</span>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ══════════════════════════════════════════════════════════════
   FOOTER
   ══════════════════════════════════════════════════════════════ */

function Footer() {
  return (
    <footer className="border-t border-gray-100 py-10 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-black flex items-center justify-center">
              <Shield className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-bold tracking-tight">ARGUS</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-gray-400">
            <a href="#" className="hover:text-black transition-colors">Documentation</a>
            <a href="#" className="hover:text-black transition-colors">API Reference</a>
            <a href="#" className="hover:text-black transition-colors">Privacy</a>
            <a href="#" className="hover:text-black transition-colors">Terms</a>
            <a href="https://github.com/SigNoz/signoz" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">
              GitHub
            </a>
          </div>
          <p className="text-[10px] text-gray-300">
            © {new Date().getFullYear()} ARGUS Enterprise. Apache 2.0.
          </p>
        </div>
      </div>
    </footer>
  )
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════ */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <HeroSection />
      <TrustMetrics />
      <ProductDashboard />
      <GovernanceEngine />
      <PolicyEngine />
      <CostFirewallSection />
      <MissionControlSection />
      <ArchitectureSection />
      <IntegrationsSection />
      <SecuritySection />
      <OpenSourceSection />
      <EnterpriseCTA />
      <Footer />
    </div>
  )
}
