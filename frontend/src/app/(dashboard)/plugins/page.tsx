'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import {
  Terminal, FileText, Search, FolderOpen, BarChart3, Activity, Cpu,
  Bell, Globe, Braces, Code, DollarSign, Copy, Check, ExternalLink,
  Plug, AlertTriangle, ChevronDown, ChevronUp, X, BookOpen, Info,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────
const MCP_URL   = 'https://argus-xhgx.onrender.com/api/v1/mcp'
const CARD_NAME = 'argus'

// ─── Pre-computed links & configs ─────────────────────────────────────────────
const claudeWebLink = `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=${encodeURIComponent(CARD_NAME)}&connectorUrl=${encodeURIComponent(MCP_URL)}`
const vscodeCfgObj  = { name: CARD_NAME, type: 'http', url: MCP_URL }
const vscodeLink    = `vscode:mcp/install?${encodeURIComponent(JSON.stringify(vscodeCfgObj))}`
const cursorCfgB64  = typeof window !== 'undefined' ? btoa(JSON.stringify({ url: MCP_URL })) : ''
const cursorLink    = `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(CARD_NAME)}&config=${cursorCfgB64}`
const kiroCfgObj    = { url: MCP_URL }
const kiroLink      = `https://kiro.dev/launch/mcp/add?name=${encodeURIComponent(CARD_NAME)}&config=${encodeURIComponent(JSON.stringify(kiroCfgObj))}`
const claudeCodeCmd = `claude mcp add --transport http ${CARD_NAME} ${MCP_URL}`
const codexCmd      = `codex mcp add ${CARD_NAME} --url ${MCP_URL}`
const windsurfCfg   = JSON.stringify({ mcpServers: { [CARD_NAME]: { url: MCP_URL } } }, null, 2)
const zedCfg        = JSON.stringify({ context_servers: { [CARD_NAME]: { url: MCP_URL, transport: 'sse' } } }, null, 2)
const antigravityCmd = `antigravity mcp add ${CARD_NAME} --url ${MCP_URL}`
const desktopCfg    = JSON.stringify({ mcpServers: { [CARD_NAME]: { url: MCP_URL } } }, null, 2)
const cursorCfg     = JSON.stringify({ mcpServers: { [CARD_NAME]: { url: MCP_URL, transport: 'sse' } } }, null, 2)
const vscodeCfgStr  = JSON.stringify({ servers: { [CARD_NAME]: { type: 'sse', url: MCP_URL } } }, null, 2)
const genericCfg    = JSON.stringify({ mcpServers: { [CARD_NAME]: { type: 'http', url: MCP_URL } } }, null, 2)

// ─── Logo map ─────────────────────────────────────────────────────────────────
const LOGOS: Record<string, string> = {
  'claude-code':    '/ai-logos/claude-code.png',
  'claude-desktop': '/ai-logos/claude-desktop.png',
  'codex':          '/ai-logos/codex.png',
  'codex-desktop':  '/ai-logos/codex.png',
  'windsurf':       '/ai-logos/windsurf.png',
  'kiro':           '/ai-logos/kiro.png',
  'zed':            '/ai-logos/zed.png',
  'antigravity':    '/ai-logos/antigravity.png',
  'cursor':         '/ai-logos/cursor.png',
  'vscode':         '/ai-logos/vscode.png',
  'generic':        '/ai-logos/otherjson.png',
}

// ─── Guide steps per client ────────────────────────────────────────────────────
interface GuideStep { step: string; detail: string }
const GUIDES: Record<string, { title: string; steps: GuideStep[] }> = {
  'claude-code': {
    title: 'Connect ARGUS to Claude Code',
    steps: [
      { step: 'Copy the command', detail: 'Click the Claude Code chip or the Copy button below to copy the CLI command.' },
      { step: 'Open your terminal', detail: 'Open any terminal — Claude Code must already be installed (npm i -g @anthropic-ai/claude-code).' },
      { step: 'Paste & run', detail: `Run: ${claudeCodeCmd}` },
      { step: 'Verify', detail: 'Run: claude mcp list — you should see "argus" listed as an HTTP server.' },
      { step: 'Start using', detail: 'Launch Claude Code in any project. ARGUS now governs every tool call automatically.' },
    ],
  },
  'codex': {
    title: 'Connect ARGUS to OpenAI Codex CLI',
    steps: [
      { step: 'Copy the command', detail: 'Click the Codex chip or Copy button to copy the CLI command.' },
      { step: 'Open your terminal', detail: 'Ensure Codex CLI is installed: npm i -g @openai/codex' },
      { step: 'Paste & run', detail: `Run: ${codexCmd}` },
      { step: 'Verify', detail: 'Run: codex mcp list — ARGUS should appear.' },
      { step: 'Config file location', detail: 'Codex also writes to ~/.codex/config.toml under [mcp_servers.argus].' },
    ],
  },
  'windsurf': {
    title: 'Connect ARGUS to Windsurf',
    steps: [
      { step: 'Copy the JSON config', detail: 'Click the Windsurf chip or Copy button to copy the config block.' },
      { step: 'Open config file', detail: 'macOS/Linux: ~/.codeium/windsurf/mcp_config.json\nWindows: %USERPROFILE%\\.codeium\\windsurf\\mcp_config.json' },
      { step: 'Merge the config', detail: 'Paste the copied JSON into your mcp_config.json. If the file has existing entries, add the "argus" key inside mcpServers.' },
      { step: 'Restart Windsurf', detail: 'Fully quit and reopen Windsurf for it to load the new server.' },
      { step: 'Verify', detail: 'Open Windsurf Settings → Cascade → MCP Servers. ARGUS should appear as connected.' },
    ],
  },
  'kiro': {
    title: 'Connect ARGUS to Kiro',
    steps: [
      { step: 'Click the Kiro chip', detail: 'Click the Kiro chip above — it opens kiro.dev/launch/mcp/add with ARGUS pre-filled.' },
      { step: 'Approve in Kiro', detail: 'Kiro opens a confirmation dialog showing the server name and URL. Click Add to confirm.' },
      { step: 'Verify', detail: 'Open Command Palette → "Kiro: Open user MCP config" and confirm the argus entry is present.' },
      { step: 'Manual fallback', detail: 'If the deep link fails, open ~/.kiro/settings/mcp.json and add: { "mcpServers": { "argus": { "url": "' + MCP_URL + '" } } }' },
    ],
  },
  'zed': {
    title: 'Connect ARGUS to Zed',
    steps: [
      { step: 'Copy the config block', detail: 'Click the Zed chip or Copy button to copy the context_servers JSON.' },
      { step: 'Open settings', detail: 'In Zed, open Command Palette (Cmd+Shift+P) → type "zed: open settings file".' },
      { step: 'Merge the config', detail: 'Paste the copied JSON at the top level of your settings.json. It adds a "context_servers" key.' },
      { step: 'Save', detail: 'Zed hot-reloads settings — no restart needed.' },
      { step: 'Verify', detail: 'Go to Settings → AI → MCP Servers and confirm ARGUS is listed and connected.' },
    ],
  },
  'antigravity': {
    title: 'Connect ARGUS to Antigravity',
    steps: [
      { step: 'Copy the config', detail: 'Click the Antigravity chip or Copy button to copy the configuration code.' },
      { step: 'Open settings', detail: 'In Antigravity IDE, navigate to Settings → Manage MCP → Configure MCP.' },
      { step: 'Paste the config', detail: 'Paste the copied code directly into the configuration field.' },
      { step: 'Verify', detail: 'Check the connected servers list in the Manage MCP panel — ARGUS should appear as Active.' },
    ],
  },
  'cursor': {
    title: 'Connect ARGUS to Cursor',
    steps: [
      { step: 'One-click install (recommended)', detail: 'Click the Cursor chip on the Connect tab — it opens Cursor\'s MCP install dialog pre-filled.' },
      { step: 'Manual: open config', detail: 'Alternatively, open .cursor/mcp.json in your project root (or create it).' },
      { step: 'Paste config', detail: 'Paste the JSON config into .cursor/mcp.json under mcpServers.' },
      { step: 'Reload Cursor', detail: 'Use Command Palette → "Developer: Reload Window" or restart Cursor.' },
      { step: 'Verify', detail: 'Open Cursor Settings → MCP. ARGUS should appear as an active server.' },
    ],
  },
  'vscode': {
    title: 'Connect ARGUS to VS Code',
    steps: [
      { step: 'One-click install (recommended)', detail: 'Click the VS Code chip on the Connect tab — it triggers vscode:mcp/install which adds ARGUS automatically.' },
      { step: 'Manual: open config', detail: 'Alternatively, create or open .vscode/mcp.json in your workspace.' },
      { step: 'Paste config', detail: 'Add the JSON config inside the "servers" key.' },
      { step: 'Reload', detail: 'VS Code picks up the new config on next window reload.' },
      { step: 'Verify', detail: 'Open VS Code Settings and search for MCP — ARGUS should be listed.' },
    ],
  },
  'generic': {
    title: 'Connect ARGUS to any MCP client',
    steps: [
      { step: 'Copy the JSON', detail: 'Click the JSON chip or Copy button to get the generic mcpServers config.' },
      { step: 'Locate your client\'s config', detail: 'Every MCP-compatible client has an mcpServers or servers config. Check your client\'s docs.' },
      { step: 'Merge the config', detail: 'Add the "argus" key inside mcpServers with type: "http" and the url.' },
      { step: 'Restart your client', detail: 'Most clients require a restart to load new MCP server configs.' },
      { step: 'Verify', detail: 'Look for ARGUS in your client\'s MCP server list or tool picker.' },
    ],
  },
}

// ─── Tool decorators ──────────────────────────────────────────────────────────
const ICONS: Record<string, React.ElementType> = {
  read_file: FileText, search_code: Search, list_directory: FolderOpen,
  analyze_codebase: BarChart3, run_command: Terminal, signoz_get_services: Globe,
  signoz_list_alerts: Bell, signoz_query_traces: Braces, argus_list_agents: Activity,
  argus_agent_dna: Cpu, argus_cost_status: DollarSign,
}
const TOOL_COLOR: Record<string, string> = {
  read_file: 'bg-blue-50 text-blue-700 border-blue-200',
  search_code: 'bg-purple-50 text-purple-700 border-purple-200',
  list_directory: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  analyze_codebase: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  run_command: 'bg-orange-50 text-orange-700 border-orange-200',
  signoz_get_services: 'bg-green-50 text-green-700 border-green-200',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function CopyBtn({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [c, setC] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setC(true); setTimeout(() => setC(false), 1500) }}
      className="btn-ghost text-xs px-3 py-1.5"
    >
      {c ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
      {c ? 'Copied!' : label}
    </button>
  )
}

function CodeBox({ code }: { code: string }) {
  return (
    <div className="relative group code-block text-[12px]">
      <pre className="pr-16 whitespace-pre-wrap">{code}</pre>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => navigator.clipboard.writeText(code)}
          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Liquid Glass Modal ────────────────────────────────────────────────────────
function GuideModal({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const guide  = GUIDES[clientId]
  const logo   = LOGOS[clientId]
  if (!guide) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-white/40 backdrop-blur-sm" />

      {/* Glass card */}
      <div
        className="relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.6)',
          boxShadow: '0 8px 64px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.9)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 pt-6 pb-5 flex items-start gap-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.5)' }}
        >
          {logo && (
            <div className="flex-shrink-0 w-12 h-12 rounded-2xl overflow-hidden bg-white shadow-md flex items-center justify-center">
              <Image src={logo} alt={clientId} width={48} height={48} className="object-contain" />
            </div>
          )}
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-[10px] font-semibold text-orange-600 uppercase tracking-widest mb-0.5">Setup Guide</p>
            <h2 className="text-base font-bold text-gray-900 leading-snug">{guide.title}</h2>
          </div>
        </div>

        {/* Steps */}
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {guide.steps.map((s, i) => (
            <div key={i} className="flex gap-3">
              <div
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #FF6B00, #FF9340)' }}
              >
                {i + 1}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{s.step}</p>
                {s.detail.includes('\n') ? (
                  s.detail.split('\n').map((line, j) => (
                    <p key={j} className="text-xs text-gray-500 mt-0.5 font-mono leading-relaxed">{line}</p>
                  ))
                ) : s.detail.startsWith('Run:') || s.detail.startsWith('claude') || s.detail.startsWith('codex') || s.detail.startsWith('antigravity') ? (
                  <code className="block text-xs text-orange-600 mt-1 bg-orange-50 px-2 py-1 rounded-lg font-mono">{s.detail}</code>
                ) : (
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{s.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex justify-end"
          style={{ borderTop: '1px solid rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.3)' }}
        >
          <button
            onClick={onClose}
            className="px-8 py-2.5 rounded-xl text-white text-sm font-semibold hover:scale-105 active:scale-95 transition-all shadow-md shadow-[#D97757]/30"
            style={{ background: 'linear-gradient(135deg, #FF6B00, #FF9340)' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Platform chips ────────────────────────────────────────────────────────────
type Action = 'open' | 'copy'
interface ChipDef {
  k: string; label: string; tooltip: string; action: Action
  href?: string; copyText?: string; tag?: string; logoId?: string
}

function PlatformChips({ onGuide }: { onGuide: (id: string) => void }) {
  const [done, setDone] = useState<string | null>(null)

  const fire = (chip: ChipDef) => {
    if (chip.action === 'copy') {
      navigator.clipboard.writeText(chip.copyText!)
      setDone(chip.k)
      setTimeout(() => setDone(x => (x === chip.k ? null : x)), 1800)
    } else {
      window.location.href = chip.href!
    }
  }

  const chips: ChipDef[] = [
    { k: 'cai',  label: 'claude.ai',   tooltip: 'Opens claude.ai Add Connector pre-filled', action: 'open', href: claudeWebLink, tag: 'deep link' },
    { k: 'vsc',  label: 'VS Code',     tooltip: "Opens VS Code's MCP install prompt",        action: 'open', href: vscodeLink,    tag: 'deep link', logoId: 'vscode' },
    { k: 'cur',  label: 'Cursor',      tooltip: "Opens Cursor's MCP install prompt",          action: 'open', href: cursorLink,    tag: 'deep link', logoId: 'cursor' },
    { k: 'cc',   label: 'Claude Code', tooltip: 'Copy CLI command — paste in terminal',       action: 'copy', copyText: claudeCodeCmd, tag: 'CLI copy', logoId: 'claude-code' },
    { k: 'cdx',  label: 'Codex',       tooltip: 'Copy codex mcp add command',                 action: 'copy', copyText: codexCmd, tag: 'CLI copy', logoId: 'codex' },
    { k: 'kiro', label: 'Kiro',        tooltip: 'Opens Kiro one-click MCP install',           action: 'open', href: kiroLink,      tag: 'deep link', logoId: 'kiro' },
    { k: 'ws',   label: 'Windsurf',    tooltip: 'Copy mcp_config.json snippet for Windsurf', action: 'copy', copyText: windsurfCfg, tag: 'config copy', logoId: 'windsurf' },
    { k: 'zed',  label: 'Zed',         tooltip: 'Copy context_servers JSON for Zed',          action: 'copy', copyText: zedCfg,   tag: 'config copy', logoId: 'zed' },
    { k: 'ag',   label: 'Antigravity', tooltip: 'Copy antigravity mcp add command',           action: 'copy', copyText: antigravityCmd, tag: 'CLI copy', logoId: 'antigravity' },
    { k: 'jsn',  label: 'JSON',        tooltip: 'Copy generic mcpServers JSON',               action: 'copy', copyText: genericCfg, tag: 'config copy', logoId: 'generic' },
  ]

  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Add to Your Agent</p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
        {chips.map(chip => {
          const isDone = done === chip.k
          return (
            <button
              key={chip.k}
              onClick={() => fire(chip)}
              title={chip.tooltip}
              className={`flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                isDone
                  ? 'border-green-300 bg-green-50 text-green-700 shadow-sm'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 hover:shadow-sm'
              }`}
            >
              {isDone ? (
                <Check className="w-4 h-4" />
              ) : chip.action === 'open' ? (
                <ExternalLink className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              <span className="text-center leading-tight">{chip.label}</span>
              {chip.tag && !isDone && (
                <span className="text-[9px] font-normal text-gray-300 leading-none">{chip.tag}</span>
              )}
            </button>
          )
        })}
      </div>
      <p className="text-[11px] text-gray-400 mt-2">
        <ExternalLink className="w-3 h-3 inline mr-1 -mt-px" />deep link opens the app pre-filled ·
        <Copy className="w-3 h-3 inline mx-1 -mt-px" />copies install command / config
      </p>
    </div>
  )
}

// ─── All clients accordion ────────────────────────────────────────────────────
interface ClientSection {
  id: string; title: string; kind: 'cmd' | 'json'; code: string; note: string; docNote?: string;
  categories: ('cli' | 'ide' | 'all')[];
}

const ALL_CLIENTS: ClientSection[] = [
  { id: 'antigravity', title: 'Antigravity CLI',      kind: 'cmd',  code: antigravityCmd, note: 'Adds ARGUS to your Antigravity agent configuration', categories: ['cli'] },
  { id: 'antigravity', title: 'Antigravity',      kind: 'cmd',  code: antigravityCmd, note: 'Adds ARGUS to your Antigravity agent configuration', categories: ['ide'] },
  { id: 'claude-code', title: 'Claude Code CLI',    kind: 'cmd',  code: claudeCodeCmd, note: 'Paste in your terminal — adds ARGUS as an HTTP MCP server to ~/.claude.json', docNote: 'No deep-link for MCP add exists. Run once; Claude Code remembers it.', categories: ['cli'] },
  { id: 'codex',       title: 'Codex CLI',     kind: 'cmd',  code: codexCmd,       note: 'Adds ARGUS to ~/.codex/config.toml under [mcp_servers.argus]', categories: ['cli'] },
  { id: 'cursor',      title: 'Cursor', kind: 'json', code: cursorCfg, note: 'Or click the Cursor chip above for one-click install', categories: ['ide'] },
  { id: 'codex',       title: 'Codex Desktop',     kind: 'json',  code: codexCmd,       note: 'Adds ARGUS to ~/.codex/config.toml under [mcp_servers.argus]', categories: ['ide'] },
  { id: 'claude-desktop', title: 'Claude Desktop', kind: 'json', code: desktopCfg, note: 'Connects via SSE — no OAuth needed. Quit and reopen Claude Desktop after saving.', docNote: 'macOS: ~/Library/Application Support/Claude/claude_desktop_config.json · Linux: ~/.config/Claude/claude_desktop_config.json', categories: ['ide'] },
  { id: 'vscode',      title: 'VS Code', kind: 'json', code: vscodeCfgStr, note: 'Or click the VS Code chip above for one-click install', categories: ['ide'] },
  { id: 'kiro',        title: 'Kiro', kind: 'json', code: kiroLink,   note: 'Open link in browser — Kiro launches its MCP install dialog pre-filled', categories: ['ide'] },
  { id: 'kiro',        title: 'Kiro CLI', kind: 'cmd', code: kiroLink,   note: 'Open link in browser — Kiro launches its MCP install dialog pre-filled', categories: ['cli'] },
  { id: 'windsurf',    title: 'Windsurf', kind: 'json', code: windsurfCfg, note: 'Merge into mcp_config.json — restart Windsurf after saving', docNote: 'macOS/Linux: ~/.codeium/windsurf/mcp_config.json · Windows: %USERPROFILE%\\.codeium\\windsurf\\mcp_config.json', categories: ['ide'] },
  { id: 'zed',         title: 'Zed', kind: 'json', code: zedCfg, note: 'Open Command Palette → "zed: open settings file" → merge this block', categories: ['ide'] },
  { id: 'generic',     title: 'Generic JSON', kind: 'json', code: genericCfg, note: 'Drop into any mcpServers-compatible config', categories: ['all'] },
]

function AllClientsTab({ onGuide, category }: { onGuide: (id: string) => void; category: 'cli' | 'ide' | 'all' }) {
  const visibleClients = ALL_CLIENTS.filter(c => c.categories.includes(category))
  const [expanded, setExpanded] = useState<string | null>(
    visibleClients.length === 1 ? visibleClients[0].id : null
  )

  return (
    <div className="space-y-2">
      {visibleClients.map(c => {
        const logo = LOGOS[c.id]
        const isOpen = expanded === c.id
        return (
          <div key={c.id} className="bg-white/60 backdrop-blur-md border border-white/60 rounded-xl overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.02)] transition-all hover:bg-white/80 hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
            <button
              className="w-full flex items-center justify-between px-4 py-3 transition-colors"
              onClick={() => setExpanded(prev => prev === c.id ? null : c.id)}
            >
              <div className="flex items-center gap-3 text-left min-w-0">
                {logo ? (
                  <div className="flex-shrink-0 w-7 h-7 rounded-lg overflow-hidden bg-white/70 backdrop-blur-sm border border-white/80 shadow-sm flex items-center justify-center">
                    <Image src={logo} alt={c.id} width={24} height={24} className="object-contain" />
                  </div>
                ) : (
                  <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Code className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{c.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{c.note}</p>
                </div>
              </div>
              {/* Badges */}
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  (category === 'ide' ? 'json' : c.kind) === 'cmd'
                    ? 'bg-orange-50 text-orange-600 border border-orange-200'
                    : 'bg-blue-50 text-blue-600 border border-blue-200'
                }`}>
                  {(category === 'ide' ? 'json' : c.kind) === 'cmd' ? 'CLI' : 'JSON'}
                </span>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-white/50 px-4 pb-4 pt-3 bg-white/40 space-y-3">
                {c.docNote && (
                  <p className="text-[11px] text-gray-400 font-mono">{c.docNote}</p>
                )}
                <CodeBox code={c.code} />

                {/* "How to configure" button */}
                {GUIDES[c.id] && (
                  <button
                    onClick={() => onGuide(c.id)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 text-xs font-semibold hover:bg-orange-100 transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    How to configure
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Session {
  id: string; client_name: string; client_version: string
  total_cost: number; tool_calls: number; budget_limit: number; blocked: boolean
}
interface ToolCall {
  tool: string; tool_index: number; cost: number; total: number
  budget: number; latency_ms: number; agent_id: string
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PluginsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [calls, setCalls]       = useState<ToolCall[]>([])
  const [live, setLive]         = useState(false)
  const [cost, setCost]         = useState(0)
  const [n, setN]               = useState(0)
  const [blocked, setBlocked]   = useState(false)
  const [tab, setTab]           = useState<'connect' | 'cli' | 'ide' | 'all'>('connect')
  const [guideId, setGuideId]   = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let ws: WebSocket, delay = 1000
    const conn = () => {
      ws = new WebSocket('wss://argus-xhgx.onrender.com/api/v1/argus/ws')
      ws.onopen  = () => { setLive(true); delay = 1000 }
      ws.onclose = () => { setLive(false); setTimeout(conn, delay); delay = Math.min(delay * 2, 30000) }
      ws.onmessage = (e) => {
        try {
          const m = JSON.parse(e.data)
          if (m.type === 'MCP_TOOL_CALL') { setCalls(p => [m, ...p].slice(0, 100)); setCost(m.total); setN(p => p + 1) }
          if (m.type === 'MCP_EVENT') {
            if (m.event === 'mcp_budget_exceeded') setBlocked(true)
            if (m.event === 'mcp_client_connected') { setBlocked(false); setCost(0); setN(0); setCalls([]) }
          }
        } catch {}
      }
    }
    conn()
    const poll = () =>
      fetch('/api/argus/mcp/sessions')
        .then(r => r.json())
        .then(d => setSessions(d.sessions ?? []))
        .catch(() => {})
    poll(); const t = setInterval(poll, 5000)
    return () => { ws?.close(); clearInterval(t) }
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [calls])

  return (
    <>
      {/* Guide modal (rendered outside animate-fadeIn so position: fixed centers in viewport) */}
      {guideId && <GuideModal clientId={guideId} onClose={() => setGuideId(null)} />}

      <div className="p-8 max-w-6xl mx-auto animate-fadeIn">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plugins</h1>
          <p className="text-sm text-gray-500 mt-1">
            Connect any AI agent to ARGUS - every tool call is governed, metered, and streamed live
          </p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
          live ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-green-500' : 'bg-red-500'}`} />
          {live ? 'Streaming Live' : 'Reconnecting…'}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { l: 'STATUS',     v: blocked ? 'Blocked' : n > 0 ? 'Active' : 'Idle', hi: blocked },
          { l: 'TOOL CALLS', v: String(n), hi: false },
          { l: 'TOTAL COST', v: `$${cost.toFixed(4)}`, hi: blocked },
          { l: 'BLOCKED',    v: String(sessions.filter(s => s.blocked).length), hi: sessions.some(s => s.blocked) },
        ].map(s => (
          <div key={s.l} className="stat-card">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">{s.l}</p>
            <p className={`text-2xl font-bold ${s.hi ? 'text-orange-600' : 'text-gray-900'}`}>{s.v}</p>
          </div>
        ))}
      </div>

      {blocked && (
        <div className="mb-6 flex items-center gap-3 px-5 py-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold">ARGUS Firewall: Budget Exceeded</p>
            <p className="text-xs text-red-500">Claude blocked after ${cost.toFixed(2)} in tool calls.</p>
          </div>
        </div>
      )}

      {/* Main card */}
      <div className="card overflow-hidden mb-5">
        {/* Tab bar */}
        <div className="border-b border-gray-100 flex bg-gray-50">
          {([
            { id: 'connect', label: 'Connect', sub: 'One click' },
            { id: 'cli',     label: 'CLI',     sub: 'Terminal' },
            { id: 'ide',     label: 'IDE',     sub: 'Editors' },
            { id: 'all',     label: 'For all', sub: 'Custom JSON' },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-6 py-3.5 text-sm font-medium flex flex-col items-start border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-orange-500 text-orange-700 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}>
              <span>{t.label}</span>
              <span className="text-[10px] text-gray-400 font-normal">{t.sub}</span>
            </button>
          ))}
        </div>

        <div className="p-7 space-y-6">

          {/* ── Connect tab ── */}
          {tab === 'connect' && (
            <>
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <span className="text-xs font-medium text-gray-500 flex-shrink-0">MCP Endpoint</span>
                <code className="flex-1 text-sm text-orange-600 font-mono truncate">{MCP_URL}</code>
                <CopyBtn text={MCP_URL} />
              </div>

              {/* ── Claude Web Hero CTA ── */}
              <div className="relative rounded-2xl border border-[#D97757]/20 bg-gradient-to-br from-[#FDF4F0] via-white to-[#FDF0EC]">
                {/* Background effects container (clips glow and shimmer) */}
                <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                  {/* Ambient radial glow */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: 'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(217,119,87,0.12) 0%, transparent 70%)',
                    }}
                  />
                  {/* Shimmer top border */}
                  <div
                    className="absolute top-0 left-0 right-0 h-px"
                    style={{
                      background: 'linear-gradient(90deg, transparent 0%, #D97757 30%, #FF9B6A 50%, #D97757 70%, transparent 100%)',
                      opacity: 0.6,
                    }}
                  />
                </div>

                {/* Info Tooltip Popover */}
                <div className="absolute top-4 right-4 z-30 group/info">
                  <button className="p-1.5 rounded-full text-gray-400 hover:text-[#D97757] hover:bg-white/60 transition-colors pointer-events-auto cursor-help">
                    <Info className="w-4 h-4" />
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-[340px] p-5 bg-white/70 backdrop-blur-xl border border-white/50 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all duration-300 translate-y-1 group-hover/info:translate-y-0 text-left pointer-events-none z-40">
                    <p className="text-gray-500 text-[11px] font-semibold uppercase tracking-widest mb-3">How Claude Web connects (OAuth 2.1)</p>
                    <div className="space-y-2">
                      {[
                        ['1.', 'Claude Web reads',      '/.well-known/oauth-authorization-server'],
                        ['2.', 'Claude registers →',    'POST /register → client_id'],
                        ['3.', 'You are redirected to', '/connect to approve + set budget'],
                        ['4.', 'ARGUS issues',           'rmt_at_… Bearer token via PKCE S256'],
                        ['5.', 'Every tool call →',      'POST /api/v1/mcp/bearer  Authorization: Bearer rmt_at_…'],
                      ].map(([n, a, b]) => (
                        <p key={n} className="text-[12px] leading-relaxed">
                          <span className="text-gray-800 font-medium">{n} </span>
                          <span className="text-gray-600">{a} </span>
                          <span className="text-[#FF6B00] font-medium">{b}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="relative px-8 py-8 flex flex-col items-center text-center gap-5">

                  {/* Claude logo */}
                  <div className="flex flex-col items-center gap-3">
                    <Image
                      src="/ai-logos/claude-writen.png"
                      alt="Claude"
                      width={180}
                      height={52}
                      className="w-auto h-auto object-contain select-none"
                      draggable={false}
                    />
                    <p className="text-[13px] text-gray-500 max-w-sm leading-relaxed">
                      Connect ARGUS to <span className="text-gray-700 font-medium">claude.ai</span> - every tool call your agent makes will be governed, metered, and controlled in real time.
                    </p>
                  </div>

                  {/* Hero CTA button */}
                  <a
                    href={claudeWebLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative inline-flex items-center gap-3 px-10 py-4 rounded-full text-white text-base font-semibold overflow-hidden transition-all hover:scale-[1.03] active:scale-[0.98] shadow-lg shadow-[#D97757]/30"
                    style={{ background: 'linear-gradient(135deg, #D97757 0%, #E8845A 50%, #C96740 100%)' }}
                  >
                    {/* Button shimmer sweep */}
                    <span
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.2) 50%, transparent 60%)' }}
                    />
                    <Image src="/ai-logos/claude-code.png" alt="" width={22} height={22} className="object-contain brightness-0 invert flex-shrink-0" />
                    <span>Connect Argus MCP to Claude</span>
                    <ExternalLink className="w-4 h-4 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </a>

                  {/* Sub-label */}
                  <p className="text-[11px] text-gray-400">
                    Opens <span className="font-medium text-gray-500">claude.ai → Integrations → Add Custom Connector</span> — already filled in. Just click <span className="font-semibold text-gray-600">Add</span>.
                  </p>
                </div>
              </div>

              <hr className="border-gray-100" />

              <PlatformChips onGuide={setGuideId} />


            </>
          )}


          {/* ── Client tabs ── */}
          {tab === 'cli' && <AllClientsTab onGuide={setGuideId} category="cli" />}
          {tab === 'ide' && <AllClientsTab onGuide={setGuideId} category="ide" />}
          {tab === 'all' && <AllClientsTab onGuide={setGuideId} category="all" />}

        </div>
      </div>

      {/* Sessions */}
      {sessions.length > 0 && (
        <div className="card overflow-hidden mb-5">
          <div className="px-5 py-3.5 border-b border-gray-100 flex justify-between">
            <div className="flex items-center gap-2">
              <Plug className="w-4 h-4 text-orange-600" />
              <h3 className="text-sm font-semibold text-gray-800">Active MCP Sessions</h3>
            </div>
            <span className="text-xs text-gray-400">{sessions.length} total</span>
          </div>
          <table className="data-table">
            <thead><tr>
              <th>Client</th><th>Session</th>
              <th className="text-right">Cost</th><th className="text-right">Calls</th>
              <th className="text-right">Budget</th><th className="text-center">Status</th>
            </tr></thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id}>
                  <td className="font-medium text-gray-800">
                    {s.client_name || <span className="text-gray-400 italic">Unknown</span>}
                    {s.client_version === 'claude-web' && (
                      <span className="ml-2 pill pill-orange text-[10px]">OAuth</span>
                    )}
                  </td>
                  <td className="font-mono text-xs text-gray-400">{s.id.slice(0, 18)}…</td>
                  <td className="text-right font-mono text-xs font-semibold text-orange-600">${(s.total_cost ?? 0).toFixed(4)}</td>
                  <td className="text-right text-xs text-gray-500">{s.tool_calls}</td>
                  <td className="text-right text-xs text-gray-500">${(s.budget_limit ?? 0).toFixed(0)}</td>
                  <td className="text-center">
                    <span className={`pill ${s.blocked ? 'pill-red' : 'pill-green'}`}>
                      <span className={`pill-dot ${s.blocked ? 'bg-red-500' : 'bg-green-500'}`} />
                      {s.blocked ? 'Blocked' : 'Live'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Live stream */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-800">Live Tool Call Stream</h3>
            {n > 0 && !blocked && (
              <span className="pill pill-green text-[10px]"><span className="pill-dot bg-green-500" />Live</span>
            )}
          </div>
          <span className="text-xs text-gray-400">{calls.length} events</span>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {calls.length === 0 ? (
            <div className="py-12 text-center">
              <Terminal className="w-7 h-7 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No tool calls yet</p>
              <p className="text-xs text-gray-300 mt-1">Connect any client to see live streaming here</p>
            </div>
          ) : (
            <div>
              {calls.map((c, i) => {
                const Icon = ICONS[c.tool] || Code
                const cls  = TOOL_COLOR[c.tool] || 'bg-gray-100 text-gray-600 border-gray-200'
                return (
                  <div key={i} className="px-5 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-gray-400 font-mono w-6">#{c.tool_index}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
                          <Icon className="w-3 h-3" />{c.tool}
                        </span>
                        <span className="text-xs text-gray-400 truncate max-w-[120px]">{c.agent_id?.slice(0, 16)}…</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">{c.latency_ms}ms</span>
                        <span className="text-xs font-mono font-semibold text-orange-600">+${c.cost?.toFixed(4)}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 progress-track h-1.5">
                        <div
                          className={`h-full rounded-full transition-all ${(c.total ?? 0) >= (c.budget ?? 5) ? 'bg-red-500' : 'bg-orange-500'}`}
                          style={{ width: `${Math.min(((c.total ?? 0) / (c.budget || 5)) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-gray-400 w-14 text-right">${c.total?.toFixed(4)}</span>
                    </div>
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>
          )}
        </div>
      </div>

    </div>
    </>
  )
}
