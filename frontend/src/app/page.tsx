'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { Shield, Activity, DollarSign, Dna, Scale, PlayCircle, ChevronDown, Sparkles, ArrowRight, Zap, Cpu, Lock, Bot, Cloud } from 'lucide-react'
import { useMagneticTilt, useShimmer, useIridescent, useRipple, calculateDepthStyle } from '@/hooks/useInteractions'

// ─── HOOKS ───
function useReveal<T extends HTMLElement>(threshold = 0.15): [React.RefObject<T | null>, boolean] {
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

// ─── DATA ───
const stats = [
  { value: 99.9, suffix: '%', label: 'Uptime', icon: Cloud, gradient: 'from-orange-400/20 to-red-400/10' },
  { value: 100000, suffix: '+', label: 'Agents Protected', icon: Bot, gradient: 'from-indigo-400/20 to-purple-400/10' },
  { value: 50000, suffix: '+', label: 'Policies Enforced', icon: Scale, gradient: 'from-amber-400/20 to-orange-400/10' },
  { value: 5, suffix: 'M+', label: 'Tool Calls Analyzed', icon: Activity, gradient: 'from-cyan-400/20 to-blue-400/10' },
]
const features = [
  { title: 'Real-time Governance', desc: 'Enforce runtime policies on every agent action. Kill loops, prevent token explosions, and enforce budget limits automatically.', icon: Scale, gradient: 'from-indigo-500 to-purple-600' },
  { title: 'Cost Firewall', desc: 'Set budget limits per agent. When burn rate spikes, ARGUS automatically cuts the connection.', icon: DollarSign, gradient: 'from-amber-500 to-orange-600' },
  { title: 'Behavioral DNA', desc: 'Every agent develops a unique behavioral fingerprint. ARGUS detects anomalies, drift, and deviations from baselines.', icon: Dna, gradient: 'from-purple-500 to-pink-600' },
  { title: 'Incident Response', desc: 'Real-time alerting and automated actions. Pause, kill, trigger fallbacks, or circuit-break runaway agents.', icon: Activity, gradient: 'from-red-500 to-rose-600' },
  { title: 'Prompt Replay', desc: 'Reconstruct past traces and replay with modified prompts. Compare responses side-by-side and measure deltas.', icon: PlayCircle, gradient: 'from-cyan-500 to-blue-600' },
  { title: 'MCP Integration', desc: 'Claude Desktop connects via Model Context Protocol. Every tool call is metered, governed, and streamed live.', icon: Cpu, gradient: 'from-violet-500 to-indigo-600' },
]
const steps = [
  { step: '01', title: 'Connect Your Agents', desc: 'Integrate via MCP, OpenTelemetry, or our SDK. Works with Claude, GPT, and any LLM.', icon: Zap },
  { step: '02', title: 'Set Governance Rules', desc: 'Define cost limits, behavioral policies, and automatic responses. No coding required.', icon: Lock },
  { step: '03', title: 'Real-time Monitoring', desc: 'Watch every tool call stream live. See costs, tokens, latency, and anomalies as they happen.', icon: Activity },
  { step: '04', title: 'Automatic Enforcement', desc: 'When a rule fires, ARGUS acts. Kill, pause, alert, or circuit-break — instantly.', icon: Shield },
]

// ─── SECTION HEADER ───
function SectionHeader({ label, title, desc }: { label: string; title: string; desc: string }) {
  const [ref, v] = useReveal<HTMLDivElement>()
  return (
    <div ref={ref} className={`text-center mb-16 reveal ${v ? 'visible' : ''}`}>
      <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium bg-indigo-50 border border-indigo-100 text-indigo-600 mb-4"><Sparkles className="w-3 h-3" />{label}</span>
      <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[#1d1d1f] mb-4">{title}</h2>
      <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">{desc}</p>
    </div>
  )
}

// ─── ORBS ───
function FloatingOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div className="absolute -top-40 -right-40 w-[700px] h-[700px] rounded-full bg-gradient-to-br from-indigo-300/50 via-purple-300/30 to-transparent blur-3xl animate-float" />
      <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-orange-300/40 via-red-300/20 to-transparent blur-3xl animate-float" style={{ animationDelay: '-2s' }} />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-gradient-to-l from-pink-300/30 via-purple-300/20 to-transparent blur-3xl animate-float" style={{ animationDelay: '-4s' }} />
      <div className="absolute bottom-1/4 left-1/3 w-[350px] h-[350px] rounded-full bg-gradient-to-r from-amber-300/30 via-orange-300/20 to-transparent blur-3xl animate-float" style={{ animationDelay: '-6s' }} />
      <div className="absolute inset-0 opacity-[0.3]" style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
    </div>
  )
}

// ─── NAV ───
function Navigation() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', h, { passive: true }); return () => window.removeEventListener('scroll', h)
  }, [])

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${scrolled ? 'bg-white/80 backdrop-blur-2xl border-b border-black/[0.04] shadow-sm' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200 transition-all duration-500 group-hover:rounded-xl"><Shield className="w-5 h-5 text-white" /></div>
          <span className="text-base font-bold gradient-text">ARGUS</span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          {['Features', 'Stats', 'How It Works'].map((item) => (
            <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, '-')}`} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">{item}</a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 hover:text-[#1d1d1f] transition-colors rounded-2xl hover:bg-black/[0.02]">Sign In</Link>
          <Link href="/signup" className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 transition-all duration-500 shadow-lg shadow-indigo-200">Get Started <ArrowRight className="w-3.5 h-3.5" /></Link>
        </div>
      </div>
    </nav>
  )
}

// ─── HERO ───
function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const handleMove = useCallback((e: React.MouseEvent) => {
    if (!heroRef.current) return
    const r = heroRef.current.getBoundingClientRect()
    setMouse({ x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 })
  }, [])

  return (
    <section ref={heroRef} onMouseMove={handleMove} className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-50 via-purple-50/50 to-transparent animate-gradient-move" />
      
      {/* Orbiting rings with magnetic shift */}
      <div className="absolute inset-0 pointer-events-none" style={{ transform: `translate(${mouse.x * 8}px, ${mouse.y * 8}px)`, transition: 'transform 0.3s ease-out' }}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-indigo-200/40 animate-orbit" style={{ animationDuration: '25s' }} />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full border border-purple-200/40 animate-orbit" style={{ animationDuration: '18s', animationDirection: 'reverse' }} />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] rounded-full border border-orange-200/40 animate-orbit" style={{ animationDuration: '12s' }} />
      </div>

      {/* CTA Button with ripple */}
      <RippleButton />

      {/* Hero Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium bg-white/80 border border-black/[0.04] text-gray-500 mb-8 shadow-sm animate-fadeIn iridescent-breathe">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />AI Runtime Governance — Now Live
        </div>

        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.1] mb-6 magnetic-card-inner" style={{ transform: `perspective(800px) rotateX(${-mouse.y * 3}deg) rotateY(${mouse.x * 3}deg)`, transition: 'transform 0.15s ease-out' }}>
          <span className="text-[#1d1d1f]">Govern Your</span><br />
          <span className="gradient-text depth-2" style={{ display: 'inline-block' }}>AI Agents</span><br />
          <span className="text-gray-400">in Real Time.</span>
        </h1>

        <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed" style={{ transform: `translate(${mouse.x * 2}px, ${mouse.y * 2}px)`, transition: 'transform 0.2s ease-out' }}>
          The autonomous runtime control plane that observes, detects, governs, and heals your AI agents.
        </p>

        {/* CTA with magnetic tilt + shimmer + ripple */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <Link href="/signup" className="group relative inline-flex items-center gap-2.5 px-8 py-4 text-base font-semibold rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white animate-gradient-move hover:rounded-3xl transition-all duration-700 shadow-2xl shadow-indigo-500/25 ripple-container" onClick={(e) => { const r = document.createElement('span'); r.className = 'ripple'; const rect = e.currentTarget.getBoundingClientRect(); r.style.left = `${e.clientX - rect.left}px`; r.style.top = `${e.clientY - rect.top}px`; r.style.width = r.style.height = '20px'; r.style.marginLeft = r.style.marginTop = '-10px'; e.currentTarget.appendChild(r); r.addEventListener('animationend', () => r.remove()) }}>
            <span className="relative z-10 flex items-center gap-2.5">Enter ARGUS <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" /></span>
          </Link>
          <a href="#features" className="inline-flex items-center gap-2.5 px-8 py-4 text-base font-semibold rounded-2xl bg-white/80 backdrop-blur-xl border border-black/[0.04] text-[#1d1d1f] hover:border-indigo-300/40 transition-all duration-500 shadow-sm morph-on-hover" style={{ borderRadius: '1rem' }}>
            <PlayCircle className="w-5 h-5" /> See How It Works
          </a>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap items-center justify-center gap-8 text-xs text-gray-500">
          <span className="flex items-center gap-2"><Shield className="w-4 h-4 text-orange-500" /> 99.9% Uptime SLA</span>
          <span className="flex items-center gap-2"><Lock className="w-4 h-4 text-orange-500" /> SOC 2 Compliant</span>
          <span className="flex items-center gap-2"><Cloud className="w-4 h-4 text-orange-500" /> Deploy Anywhere</span>
        </div>
      </div>
      <a href="#features" className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-400 hover:text-gray-600 transition-colors animate-breathe">
        <span className="text-xs font-medium">Scroll to explore</span>
        <ChevronDown className="w-4 h-4" />
      </a>
    </section>
  )
}

// Placeholder for the ripple button - not actually used inline
function RippleButton() { return null }

// ─── FEATURE CARD ───
function FeatureCard({ feature }: { feature: typeof features[0] }) {
  const [ref, v] = useReveal<HTMLDivElement>()
  const magnetic = useMagneticTilt(8)
  const shimmer = useShimmer()
  const iri = useIridescent()
  const [mPos, setMPos] = useState({ x: 0, y: 0 })

  const handleMove = useCallback((e: React.MouseEvent) => {
    magnetic.handlers.onMouseMove(e)
    shimmer.handlers.onMouseMove(e)
    iri.handlers.onMouseMove(e)
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    setMPos({ x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 })
  }, [magnetic, shimmer, iri])

  return (
    <div ref={ref} className={`reveal ${v ? 'visible' : ''}`} style={{ transitionDelay: `${features.indexOf(feature) * 80}ms` }}>
      <div ref={magnetic.ref}
        onMouseMove={handleMove}
        onMouseLeave={magnetic.handlers.onMouseLeave}
        className="relative magnetic-card shimmer-card morph-card iridescent-edge h-full"
        style={{ borderRadius: '1.5rem' }}
      >
        <div className="relative h-full bg-white/80 backdrop-blur-2xl border border-black/[0.04] p-7 shadow-sm transition-all duration-500" style={{ borderRadius: 'inherit', ...magnetic.style, transform: magnetic.style.transform ? `${magnetic.style.transform} translateZ(0)` : '' }}>
          <div ref={shimmer.ref} className="absolute inset-0 rounded-[inherit] pointer-events-none shimmer-card" />
          
          <div ref={iri.ref} className="relative z-10 iridescent-edge">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 shadow-lg transition-all duration-500`} 
              style={calculateDepthStyle(mPos.x, mPos.y, 12).icon}>
              <feature.icon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-[#1d1d1f] mb-2 parallax-layer" style={calculateDepthStyle(mPos.x, mPos.y, 8).title}>{feature.title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed parallax-layer" style={calculateDepthStyle(mPos.x, mPos.y, 4).desc}>{feature.desc}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── STAT CARD ───
function StatCard({ stat, visible }: { stat: typeof stats[0]; visible: boolean }) {
  const count = useCounter(stat.value, 2000, visible)
  const magnetic = useMagneticTilt(6)

  return (
    <div ref={magnetic.ref} onMouseMove={magnetic.handlers.onMouseMove} onMouseLeave={magnetic.handlers.onMouseLeave} className="magnetic-card morph-card" style={{ borderRadius: '1.5rem' }}>
      <div className="bg-white/80 backdrop-blur-2xl border border-black/[0.04] p-8 text-center shadow-sm transition-all duration-500" style={{ borderRadius: 'inherit', ...magnetic.style }}>
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-50 border border-black/[0.04] flex items-center justify-center mx-auto mb-4 transition-all duration-500 parallax-layer-1" style={{ transform: magnetic.style.transform ? `translateZ(20px)` : '' }}>
          <stat.icon className="w-7 h-7 text-gray-600" />
        </div>
        <div className="text-4xl md:text-5xl font-bold gradient-text mb-2 font-mono tabular-nums depth-2">{count.toLocaleString()}{stat.suffix}</div>
        <p className="text-sm text-gray-500">{stat.label}</p>
      </div>
    </div>
  )
}

// ─── STEP CARD ───
function StepCard({ step, index }: { step: typeof steps[0]; index: number }) {
  const [ref, v] = useReveal<HTMLDivElement>()
  const isLeft = index % 2 === 0
  return (
    <div ref={ref} className={`relative flex flex-col md:flex-row items-start gap-8 md:gap-12 reveal ${v ? 'visible' : ''} ${isLeft ? 'md:flex-row' : 'md:flex-row-reverse'}`} style={{ transitionDelay: `${index * 150}ms` }}>
      <div className={`flex-1 ${isLeft ? 'md:text-right' : 'md:text-left'}`}>
        <div className="bg-white/80 backdrop-blur-2xl rounded-3xl border border-black/[0.04] p-6 md:p-8 inline-block shadow-sm shimmer-card morph-card iridescent-edge glow-wave" style={{ borderRadius: '1.5rem' }}>
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 border border-indigo-200 flex items-center justify-center flex-shrink-0 ${isLeft ? 'md:order-2' : ''}`}>
              <step.icon className="w-6 h-6 text-indigo-600" />
            </div>
            <div className={isLeft ? 'md:text-right' : ''}>
              <span className="text-xs font-mono text-indigo-500 font-semibold">{step.step}</span>
              <h3 className="text-lg font-semibold text-[#1d1d1f] mt-1">{step.title}</h3>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">{step.desc}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="hidden md:flex items-center justify-center w-16 flex-shrink-0">
        <div className="w-4 h-4 rounded-full bg-gradient-to-r from-indigo-400 to-purple-400 shadow-lg shadow-indigo-200 iridescent-breathe" />
      </div>
      <div className="hidden md:block flex-1" />
    </div>
  )
}

// ─── SECTIONS ───
function FeaturesSection() {
  return (
    <section id="features" className="relative py-28 px-6">
      <div className="max-w-7xl mx-auto">
        <SectionHeader label="Features" title="Everything You Need to Govern AI" desc="A comprehensive suite of tools to observe, control, and protect your AI agent runtime environment." />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => <FeatureCard key={feature.title} feature={feature} />)}
        </div>
      </div>
    </section>
  )
}

function StatsSection() {
  const [ref, v] = useReveal<HTMLDivElement>()
  return (
    <section id="stats" className="relative py-28 px-6">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-50/50 to-transparent" />
      <div className="max-w-7xl mx-auto relative">
        <SectionHeader label="Stats" title="Trusted by Engineering Teams" desc="Numbers that show the impact of autonomous AI governance." />
        <div ref={ref} className="grid grid-cols-2 md:grid-cols-4 gap-6 stagger-children">
          {stats.map((stat) => <StatCard key={stat.label} stat={stat} visible={v} />)}
        </div>
      </div>
    </section>
  )
}

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <SectionHeader label="How It Works" title="Set Up in Minutes" desc="From zero to governance in four simple steps." />
        <div className="relative">
          <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-indigo-300/50 via-purple-300/30 to-transparent -translate-x-1/2 hidden md:block" />
          <div className="space-y-16 md:space-y-24">{steps.map((step, i) => <StepCard key={step.step} step={step} index={i} />)}</div>
        </div>
      </div>
    </section>
  )
}

function CTASection() {
  const [ref, v] = useReveal<HTMLDivElement>()
  return (
    <section className="relative py-32 px-6">
      <div className="absolute inset-0 bg-gradient-to-t from-indigo-50/80 via-purple-50/40 to-transparent" />
      <div ref={ref} className={`relative max-w-4xl mx-auto text-center reveal-scale ${v ? 'visible' : ''}`}>
        <div className="bg-white/90 backdrop-blur-2xl rounded-[2rem] border border-black/[0.04] p-12 md:p-16 shadow-xl gradient-border morph-card glow-wave" style={{ borderRadius: '2rem' }}>
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-indigo-200 iridescent-breathe">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-[#1d1d1f] mb-4">
            Ready to Govern Your <span className="gradient-text">AI Runtime</span>?
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">Join engineering teams that trust ARGUS to protect their AI agents.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className="group inline-flex items-center gap-2.5 px-8 py-4 text-base font-semibold rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 transition-all duration-500 shadow-2xl shadow-indigo-200 ripple-container morph-card hover:rounded-3xl" style={{ borderRadius: '1rem' }} onClick={(e) => { const r = document.createElement('span'); r.className = 'ripple'; const rect = e.currentTarget.getBoundingClientRect(); r.style.left = `${e.clientX - rect.left}px`; r.style.top = `${e.clientY - rect.top}px`; r.style.width = r.style.height = '20px'; r.style.marginLeft = r.style.marginTop = '-10px'; e.currentTarget.appendChild(r); r.addEventListener('animationend', () => r.remove()) }}>
              Get Started Free <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" />
            </Link>
            <Link href="/login" className="inline-flex items-center gap-2.5 px-8 py-4 text-base font-semibold rounded-2xl bg-white/90 backdrop-blur-xl border border-black/[0.04] text-[#1d1d1f] hover:border-indigo-300/40 transition-all duration-500 morph-card" style={{ borderRadius: '1rem' }}>Sign In</Link>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-8 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">🚀 Free 14-day trial</span>
            <span className="flex items-center gap-1.5">💳 No credit card required</span>
            <span className="flex items-center gap-1.5">🔒 SOC 2 compliant</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-black/[0.04] py-12 px-6 bg-white/50">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center"><Shield className="w-3.5 h-3.5 text-white" /></div>
            <span className="text-sm font-bold gradient-text">ARGUS</span>
          </div>
          <div className="flex items-center gap-8 text-sm text-gray-500">
            <a href="#" className="hover:text-gray-700 transition-colors">Docs</a>
            <a href="#" className="hover:text-gray-700 transition-colors">API</a>
            <a href="#" className="hover:text-gray-700 transition-colors">Privacy</a>
            <a href="#" className="hover:text-gray-700 transition-colors">Terms</a>
          </div>
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} ARGUS Enterprise. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

// ─── MAIN ───
export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-[#f5f5f7]">
      <FloatingOrbs />
      <div className="relative z-10">
        <Navigation />
        <HeroSection />
        <FeaturesSection />
        <StatsSection />
        <HowItWorksSection />
        <CTASection />
        <Footer />
      </div>
    </div>
  )
}
