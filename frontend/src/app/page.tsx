'use client'

import React, {
  useEffect, useRef, useState, useCallback, Fragment
} from 'react'
import Link from 'next/link'
import {
  Activity, ArrowRight, Play, ChevronDown,
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
import { motion } from 'framer-motion'
import { WordsPullUp } from '@/components/ui/words-pull-up'
import { AnnouncementBanner } from '@/components/AnnouncementBanner'
import Grainient from '@/components/ui/Grainient'

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
  { title: 'Runtime Governance', desc: 'Monitor and enforce policies on every tool call.', icon: Activity },
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
            <span className={`text-sm font-bold tracking-tight transition-colors ${scrolled || menuValue ? 'text-black' : 'text-white'}`}>ARGUS</span>
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
                  <MotionNavigationMenuTrigger className={`text-sm transition-colors px-3 py-1.5 ${scrolled || menuValue ? 'text-gray-600 hover:text-black data-[state=open]:text-black' : 'text-gray-300 hover:text-white data-[state=open]:text-white'}`}>
                    Product
                  </MotionNavigationMenuTrigger>
                  <MotionNavigationMenuContent innerClassName="" className="!p-0">
                    <div className="grid w-[520px] grid-cols-[1fr_1fr] gap-1 p-2">
                      <MotionNavigationMenuLink
                        href="#"
                        className="bg-white hover:bg-orange-light rounded-xl min-h-[120px] justify-between p-4 border border-gray-100"
                      >
                        <span className="bg-white flex size-9 items-center justify-center rounded-lg border border-gray-200">
                          <Activity className="size-4 text-orange-600" />
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
                  <MotionNavigationMenuTrigger className={`text-sm transition-colors px-3 py-1.5 ${scrolled || menuValue ? 'text-gray-600 hover:text-black data-[state=open]:text-black' : 'text-gray-300 hover:text-white data-[state=open]:text-white'}`}>
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
                    className={`flex h-9 items-center px-3 py-1.5 text-sm transition-colors ${scrolled || menuValue ? 'text-gray-600 hover:text-black' : 'text-gray-300 hover:text-white'}`}
                  >
                    Architecture
                  </MotionNavigationMenuLink>
                </MotionNavigationMenuItem>
                <MotionNavigationMenuItem>
                  <MotionNavigationMenuLink
                    href="#integrations"
                    className={`flex h-9 items-center px-3 py-1.5 text-sm transition-colors ${scrolled || menuValue ? 'text-gray-600 hover:text-black' : 'text-gray-300 hover:text-white'}`}
                  >
                    Integrations
                  </MotionNavigationMenuLink>
                </MotionNavigationMenuItem>
                <MotionNavigationMenuItem>
                  <MotionNavigationMenuLink
                    href="#security"
                    className={`flex h-9 items-center px-3 py-1.5 text-sm transition-colors ${scrolled || menuValue ? 'text-gray-600 hover:text-black' : 'text-gray-300 hover:text-white'}`}
                  >
                    Security
                  </MotionNavigationMenuLink>
                </MotionNavigationMenuItem>
              </MotionNavigationMenuList>
            </MotionNavigationMenu>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-3 z-20">
            <Link href="/login" className={`text-sm transition-colors px-3 py-1.5 ${scrolled || menuValue ? 'text-gray-600 hover:text-black' : 'text-gray-300 hover:text-white'}`}>Sign In</Link>
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
    <section className="h-screen w-full relative">
      <div className="relative h-full w-full overflow-hidden">
        
        {/* Background video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_170732_8a9ccda6-5cff-4628-b164-059c500a2b41.mp4"
        />

        {/* Noise overlay */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.7] mix-blend-overlay bg-noise" />

        {/* Gradient overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />

        {/* Hero content positioned at the absolute bottom */}
        <div className="absolute bottom-0 left-0 right-0 px-[5vw] lg:px-[80px] pb-10 sm:pb-12 md:pb-16 max-w-[1680px] mx-auto z-10">
          <div className="flex flex-col w-full gap-4">
            
            {/* The Massive Title */}
            <h1
              className="font-[900] leading-[0.85] tracking-[-0.07em] text-[26vw] sm:text-[24vw] md:text-[22vw] lg:text-[18vw] xl:text-[18vw]"
              style={{ color: "#FDFCF8" }}
            >
              <WordsPullUp text="ARGUS" showAsterisk />
            </h1>

            {/* Description & Button Stack */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mt-4">
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-[700px] text-sm sm:text-base md:text-lg text-white/90 font-medium"
                style={{ lineHeight: 1.4 }}
              >
                ARGUS sits invisibly between your AI clients and your infrastructure to govern every single tool call in real-time. Unmatched observability and zero-trust security.
              </motion.p>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link href="/login" className="h-[56px] px-8 bg-[#FF6B00] hover:bg-[#CC5500] text-white rounded-lg font-semibold text-[15px] transition-all flex items-center justify-center gap-2 group whitespace-nowrap">
                  Deploy ARGUS 
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </motion.div>
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
            <Activity className="w-8 h-8 text-white" />
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
    <footer className="bg-[#0A0A0A] pt-20 pb-10 px-[5vw] lg:px-[80px] border-t border-gray-800">
      <div className="max-w-[1680px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8 mb-16">
          {/* Brand Column */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <img src="/LOGO.png" alt="ARGUS Logo" className="h-8 w-auto brightness-0 invert" />
              <span className="text-lg font-bold tracking-tight text-white">ARGUS</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
              The Enterprise AI Runtime Control Plane. Govern every tool call, block rogue agents, and gain unmatched observability over your AI infrastructure in real-time.
            </p>
          </div>

          {/* Product Column */}
          <div className="flex flex-col gap-4">
            <h4 className="text-white text-sm font-semibold mb-2">Product</h4>
            <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">Runtime Governance</a>
            <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">Cost Firewall</a>
            <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">Mission Control</a>
            <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">Agent DNA</a>
          </div>

          {/* Developers Column */}
          <div className="flex flex-col gap-4">
            <h4 className="text-white text-sm font-semibold mb-2">Developers</h4>
            <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">Documentation</a>
            <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">API Reference</a>
            <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">MCP Protocol</a>
            <a href="https://github.com/SigNoz/signoz" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors text-sm">GitHub</a>
          </div>

          {/* Company Column */}
          <div className="flex flex-col gap-4">
            <h4 className="text-white text-sm font-semibold mb-2">Company</h4>
            <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">About</a>
            <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">Security & Trust</a>
            <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">Privacy Policy</a>
            <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">Terms of Service</a>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gray-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} ARGUS Enterprise. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2 text-sm text-gray-500">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              All systems operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ══════════════════════════════════════════════════════════════
   CTA SECTION
   ══════════════════════════════════════════════════════════════ */

function CtaSection() {
  const [ref, isVisible] = useReveal<HTMLDivElement>()
  
  return (
    <section ref={ref} className="relative py-24 sm:py-32 overflow-hidden bg-white">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
        <div className={`relative isolate overflow-hidden bg-gray-900 px-6 py-24 text-center shadow-2xl sm:rounded-3xl sm:px-16 transition-all duration-1000 transform ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-95'}`}>
          {/* Glowing edge effect */}
          <div className="absolute inset-0 border border-white/10 sm:rounded-3xl pointer-events-none z-10" />
          
          <div className="absolute inset-0 z-0 opacity-40">
            <Grainient
              color1="#0A0A0A"
              color2="#FF6B00"
              color3="#111827"
              timeSpeed={0.15}
              warpStrength={1.5}
              warpSpeed={1.5}
              noiseScale={1.5}
              blendSoftness={0.2}
              grainAmount={0.08}
            />
          </div>

          <h2 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight text-white sm:text-5xl relative z-20">
            LIFETIME FREE PLAN 
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-gray-300 relative z-20">
            <strong className="text-[#FF6B00] font-semibold text-xl tracking-wide uppercase block mb-2">Only for FIRST 1000 BUILDERS</strong>
            Lock in a <strong className="text-white">Lifetime Free Plan</strong> (available only for the first 1000 users). 
            Deploy ARGUS in seconds and enforce enterprise-grade security on every tool call your agents make.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6 relative z-20">
            <Link
              href="/connect"
              className="rounded-full bg-gradient-to-r from-[#FF6B00] to-orange-500 px-8 py-4 text-sm font-bold tracking-wide text-white shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF6B00] transition-all duration-300 uppercase"
            >
              Claim Lifetime Free Access
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════ */

export default function LandingPage() {
  const [bannerVisible, setBannerVisible] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem('argus-banner-dismissed')
    if (!dismissed) setBannerVisible(true)
  }, [])

  const handleDismissBanner = () => {
    setBannerVisible(false)
    localStorage.setItem('argus-banner-dismissed', 'true')
  }

  return (
    <div className="min-h-screen bg-white">
      {bannerVisible && (
        <div className="relative z-[60]">
          <AnnouncementBanner onDismiss={handleDismissBanner} />
        </div>
      )}
      <Navigation />
      <HeroSection />
      <ArchitectureSection />
      <IntegrationsSection />
      <SecuritySection />
      <CtaSection />
      <Footer />
    </div>
  )
}
