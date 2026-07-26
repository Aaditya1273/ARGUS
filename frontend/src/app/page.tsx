'use client'

import React, {
  useEffect, useRef, useState, useCallback, Fragment
} from 'react'
import Link from 'next/link'
import {
  Shield, ArrowRight, Play, ChevronDown,
  Lock, Globe, Github, CheckCircle, XCircle,
  Zap, Scale, Cpu, BookOpen,
  Building2, Users, FileText, BarChart3,
  Search, Terminal,
} from 'lucide-react'
import {
  MotionNavigationMenu,
  MotionNavigationMenuContent,
  MotionNavigationMenuItem,
  MotionNavigationMenuLink,
  MotionNavigationMenuList,
  MotionNavigationMenuTrigger,
} from '@/components/ui/motion-navigation-menu'
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

/* ══════════════════════════════════════════════════════════════
   COMPONENTS
   ══════════════════════════════════════════════════════════════ */

/* ─── Navigation (curved + floating + mega menu) ─── */
const PRODUCT_ITEMS = [
  { title: 'Runtime Governance', desc: 'Monitor and enforce policies on every tool call.', icon: Shield },
  { title: 'Cost Firewall', desc: 'Real-time budget tracking and circuit breakers.', icon: BarChart3 },
  { title: 'Mission Control', desc: 'Agent lifecycle management and live control.', icon: Terminal },
  { title: 'Agent DNA', desc: 'Behavioral fingerprinting and anomaly detection.', icon: Search },
  { title: 'Prompt Replay', desc: 'Debug by replaying failed traces with real LLM calls.', icon: FileText },
]

const SOLUTION_ITEMS = [
  { title: 'Enterprise', desc: 'SAML, audit logs, SLAs, and RBAC permissions.', icon: Building2 },
  { title: 'Security Teams', desc: 'SOC 2, encryption, OAuth 2.1 + PKCE, and zero-trust.', icon: Lock },
  { title: 'Platform Engineers', desc: 'MCP protocol, OpenTelemetry, custom plugins.', icon: Cpu },
  { title: 'Compliance & Legal', desc: 'Full audit trails, policy-as-code, and reporting.', icon: Users },
]

const RESOURCE_ITEMS = [
  { title: 'Documentation', desc: 'Guides, API reference, and integration tutorials.', icon: BookOpen },
  { title: 'API Reference', desc: 'Complete MCP and REST API documentation.', icon: FileText },
  { title: 'Changelog', desc: 'What shipped this month in ARGUS.', icon: Terminal },
  { title: 'GitHub', desc: 'Open source repository and community.', icon: Github },
]

function Navigation() {
  const scrollY = useScrollPosition()
  const scrolled = scrollY > 80
  const [menuValue, setMenuValue] = React.useState('')

  return (
    <nav className={`fixed z-50 transition-all duration-700 ${
      scrolled ? 'top-3 left-4 right-4' : 'top-4 left-0 right-0'
    }`}>
      {/* Background + blur layer */}
      <div className={`absolute inset-0 rounded-2xl transition-opacity duration-700 ${
        scrolled || menuValue ? 'opacity-100' : 'opacity-0'
      }`}>
        <div className="w-full h-full rounded-2xl bg-white/85 backdrop-blur-2xl border border-gray-200/80 shadow-[0_8px_32px_rgba(0,0,0,0.06)]" />
      </div>
      {/* Content */}
      <div className="relative mx-auto max-w-7xl">
        <div className="h-14 flex items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-3 group z-20">
            <img src="/LOGO.png" alt="ARGUS Logo" className="h-7 w-auto transition-transform duration-300 group-hover:scale-105" />
            <span className="text-sm font-bold tracking-tight">ARGUS</span>
          </Link>

          {/* Mega Menu — centered */}
          <div className="hidden md:flex items-center absolute left-1/2 -translate-x-1/2">
            <MotionNavigationMenu
              viewport
              value={menuValue}
              onValueChange={setMenuValue}
              springBounce={0}
              springStiffness={400}
              springDamping={30}
              viewportClassName="!bg-white/95 !backdrop-blur-xl !border-gray-200/80 !shadow-[0_8px_32px_rgba(0,0,0,0.08)] !rounded-xl"
              className="gap-0"
            >
              <MotionNavigationMenuList className="gap-0">
                {/* Product menu */}
                <MotionNavigationMenuItem value="product">
                  <MotionNavigationMenuTrigger className="text-sm text-gray-400 hover:text-black transition-colors px-3 py-1.5 data-[state=open]:text-black">
                    Product
                  </MotionNavigationMenuTrigger>
                  <MotionNavigationMenuContent innerClassName="" className="!p-0">
                    <div className="grid w-[520px] grid-cols-[1fr_1fr] gap-1 p-2">
                      <MotionNavigationMenuLink
                        href="#"
                        className="bg-white hover:bg-orange-light rounded-xl min-h-[120px] justify-between p-4 border border-gray-100"
                      >
                        <span className="bg-white flex size-9 items-center justify-center rounded-lg border border-gray-200">
                          <Shield className="size-4 text-orange-600" />
                        </span>
                        <span className="space-y-1">
                          <span className="block text-sm font-semibold text-gray-900">
                            Runtime Governance
                          </span>
                          <span className="text-gray-400 block text-xs leading-relaxed">
                            Monitor and enforce policies on every AI tool call in real time.
                          </span>
                        </span>
                      </MotionNavigationMenuLink>
                      <div className="grid grid-cols-1 gap-0.5">
                        {PRODUCT_ITEMS.filter((_, i) => i > 0).map((product) => (
                          <MotionNavigationMenuLink key={product.title} href="#">
                            <span className="flex items-center justify-between gap-2 text-sm font-medium text-gray-800">
                              <span className="flex items-center gap-2">
                                <product.icon className="size-3.5 text-orange-600" />
                                {product.title}
                              </span>
                              <ArrowRight className="size-3 text-gray-300 group-hover:text-orange-600 transition-colors" />
                            </span>
                            <span className="text-gray-400 text-xs mt-0.5">
                              {product.desc}
                            </span>
                          </MotionNavigationMenuLink>
                        ))}
                      </div>
                    </div>
                  </MotionNavigationMenuContent>
                </MotionNavigationMenuItem>

                {/* Solutions menu */}
                <MotionNavigationMenuItem value="solutions">
                  <MotionNavigationMenuTrigger className="text-sm text-gray-400 hover:text-black transition-colors px-3 py-1.5 data-[state=open]:text-black">
                    Solutions
                  </MotionNavigationMenuTrigger>
                  <MotionNavigationMenuContent innerClassName="" className="!p-0">
                    <div className="w-[380px] space-y-0.5 p-2">
                      <div className="text-gray-400 px-2.5 py-2 text-[11px] font-semibold uppercase tracking-widest">
                        Built for teams
                      </div>
                      {SOLUTION_ITEMS.map((solution) => (
                        <MotionNavigationMenuLink
                          key={solution.title}
                          href="#"
                          className="grid grid-cols-[auto_1fr_auto] items-center gap-3 hover:bg-orange-light rounded-xl"
                        >
                          <span className="flex size-8 items-center justify-center rounded-lg">
                            <solution.icon className="size-4.5 text-gray-600" />
                          </span>
                          <span className="space-y-0.5">
                            <span className="block text-sm font-semibold text-gray-800">
                              {solution.title}
                            </span>
                            <span className="text-gray-400 block text-xs leading-relaxed">
                              {solution.desc}
                            </span>
                          </span>
                          <span className="text-gray-400 rounded-lg px-1.5 py-0.5 text-xs font-medium">
                            View
                          </span>
                        </MotionNavigationMenuLink>
                      ))}
                    </div>
                  </MotionNavigationMenuContent>
                </MotionNavigationMenuItem>

                {/* Resources menu */}
                <MotionNavigationMenuItem value="resources">
                  <MotionNavigationMenuTrigger className="text-sm text-gray-400 hover:text-black transition-colors px-3 py-1.5 data-[state=open]:text-black">
                    Resources
                  </MotionNavigationMenuTrigger>
                  <MotionNavigationMenuContent innerClassName="" className="!p-0">
                    <div className="grid w-[460px] grid-cols-2 gap-1 p-2">
                      <div className="space-y-0.5">
                        {RESOURCE_ITEMS.slice(0, 3).map((resource) => (
                          <MotionNavigationMenuLink key={resource.title} href="#" className="hover:bg-orange-light rounded-xl">
                            <span className="flex items-center gap-2 text-sm font-medium text-gray-800">
                              <resource.icon className="size-3.5 text-orange-600" />
                              {resource.title}
                            </span>
                            <span className="text-gray-400 text-xs">
                              {resource.desc}
                            </span>
                          </MotionNavigationMenuLink>
                        ))}
                      </div>
                      <MotionNavigationMenuLink
                        href="https://github.com/SigNoz/signoz"
                        target="_blank"
                        className="bg-white hover:bg-orange-light rounded-xl min-h-[140px] justify-between p-4 border border-gray-100"
                      >
                        <span className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                          <Github className="size-4" />
                          GitHub
                        </span>
                        <span className="text-gray-400 text-xs leading-relaxed">
                          Open source ARGUS. Star us on GitHub and join the community.
                        </span>
                        <span className="text-xs font-semibold text-orange-600">
                          Star on GitHub →
                        </span>
                      </MotionNavigationMenuLink>
                    </div>
                  </MotionNavigationMenuContent>
                </MotionNavigationMenuItem>

                {/* Direct links */}
                <MotionNavigationMenuItem>
                  <MotionNavigationMenuLink
                    href="#architecture"
                    className="flex h-9 items-center px-3 py-1.5 text-sm text-gray-400 hover:text-black transition-colors"
                  >
                    Architecture
                  </MotionNavigationMenuLink>
                </MotionNavigationMenuItem>
                <MotionNavigationMenuItem>
                  <MotionNavigationMenuLink
                    href="#integrations"
                    className="flex h-9 items-center px-3 py-1.5 text-sm text-gray-400 hover:text-black transition-colors"
                  >
                    Integrations
                  </MotionNavigationMenuLink>
                </MotionNavigationMenuItem>
                <MotionNavigationMenuItem>
                  <MotionNavigationMenuLink
                    href="#security"
                    className="flex h-9 items-center px-3 py-1.5 text-sm text-gray-400 hover:text-black transition-colors"
                  >
                    Security
                  </MotionNavigationMenuLink>
                </MotionNavigationMenuItem>
              </MotionNavigationMenuList>
            </MotionNavigationMenu>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-3 z-20">
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

function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex flex-col justify-center pt-[120px] pb-[80px] overflow-hidden bg-[#fafafa]">
      
      {/* Background Mountain — 100% opacity, integrated via haze and gradients */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img src="/bg-mountain.png" alt="Mountains" className="w-full h-full object-cover object-right opacity-100 saturate-[0.45] contrast-[0.85] mix-blend-multiply" />
        
        {/* Atmospheric white gradients and soft haze */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#fafafa] via-[#fafafa]/85 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#fafafa] via-transparent to-transparent opacity-90" />
        <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]" />
      </div>
      
      {/* Background Lines — eye-guides behind headline */}
      <div className="absolute top-0 right-0 w-[65%] h-[80%] pointer-events-none z-[1] opacity-30">
        <img src="/bg-lines.png" alt="Lines" className="w-full h-full object-contain object-right-top" />
      </div>

      <div className="relative z-10 w-full max-w-[1680px] mx-auto px-[5vw] lg:px-[80px]">
        
        {/* Main Grid: Left 44%, Right 56% */}
        <div className="grid grid-cols-1 md:grid-cols-[44%_56%] w-full items-center">
          
          {/* Left Content */}
          <div className="flex flex-col relative z-20">
            {/* Status badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-white/60 backdrop-blur-sm text-[11px] font-mono text-gray-700 w-fit mb-[48px]">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse-dot" />
              v1.0.0 — Runtime Control Plane
            </div>

            {/* Headline - Max width 520px, 900 weight, tight tracking, 32px mb */}
            <h1 className="max-w-[520px] text-[4.5rem] xl:text-[5.5rem] leading-[1.0] font-[900] text-[#0A0A0A] tracking-tighter mb-[32px]">
              Every AI<br />Tool Call...
            </h1>

            {/* Handwritten words */}
            <div className={`flex flex-col gap-[34px] mb-[40px] pl-[10px] ${caveat.className}`} style={{ transform: 'rotate(-4deg)' }}>
              <div className="text-[3.8rem] xl:text-[4.5rem] leading-[0.7] text-[#FF6B00]">Observed.</div>
              <div className="text-[3.8rem] xl:text-[4.5rem] leading-[0.7] text-[#0D1117]">Governed.</div>
              <div className="text-[3.8rem] xl:text-[4.5rem] leading-[0.7] text-[#FF6B00]">Enforced.</div>
            </div>

            {/* Subheadline - max-w 560px for improved readability */}
            <p className="max-w-[560px] text-[16px] text-gray-600 leading-[1.65] font-medium mb-[40px]">
              ARGUS intercepts every AI tool call before execution, evaluates enterprise policies in milliseconds, and automatically blocks unsafe, expensive, or non-compliant behaviour.
            </p>

            {/* CTAs - h-56px, gap 16px */}
            <div className="flex items-center gap-[16px]">
              <Link href="/login" className="h-[56px] px-8 bg-[#FF6B00] hover:bg-[#CC5500] text-white rounded-lg font-semibold text-[15px] transition-all flex items-center justify-center gap-2">
                Deploy ARGUS <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#product" className="h-[56px] px-8 bg-transparent hover:bg-gray-50 text-gray-800 rounded-lg font-semibold text-[15px] transition-all border border-gray-300 flex items-center justify-center gap-2">
                <Play className="w-4 h-4 text-gray-600" /> View Live Runtime
              </a>
            </div>
          </div>

          {/* Right Content - 3D Shield */}
          <div className="relative h-full flex items-center justify-center pointer-events-none">
            <img 
              src="/hero-shield.png" 
              alt="ARGUS Shield" 
              className="w-[68%] max-w-[400px] object-contain drop-shadow-2xl transform translate-x-[125px] translate-y-[65px]"
            />
          </div>
        </div>

        {/* Bottom Trust Badges (Normal Document Flow) - exactly 80px below CTAs */}
        <div className="w-[78%] max-w-[1200px] mx-auto mt-[80px] hidden md:flex items-center justify-between px-10 h-[64px] rounded-[20px] bg-white/40 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] text-gray-800">
          <span className="flex items-center gap-2.5 text-[14px] font-medium"><Shield className="w-4 h-4 text-[#FF6B00]" /> 99.99% Uptime SLA</span>
          <span className="flex items-center gap-2.5 text-[14px] font-medium"><Lock className="w-4 h-4 text-[#FF6B00]" /> SOC 2 Compliant</span>
          <span className="flex items-center gap-2.5 text-[14px] font-medium"><Globe className="w-4 h-4 text-[#FF6B00]" /> Deploy Anywhere</span>
          <span className="flex items-center gap-2.5 text-[14px] font-medium"><Github className="w-4 h-4 text-[#FF6B00]" /> Open Source</span>
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
            <img src="/LOGO.png" alt="ARGUS Logo" className="h-6 w-auto" />
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
      <ArchitectureSection />
      <IntegrationsSection />
      <SecuritySection />
      <EnterpriseCTA />
      <Footer />
    </div>
  )
}
