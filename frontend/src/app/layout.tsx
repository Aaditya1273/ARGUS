import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ARGUS — Autonomous Runtime Governance for AI Agents',
  description: 'Observe, detect, govern, and heal your AI agents in real time.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 text-gray-100 min-h-screen`}>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  )
}

function Sidebar() {
  const navItems = [
    { href: '/', label: 'Mission Control', icon: '⬡' },
    { href: '/mission-control', label: 'Live Agents', icon: '●' },
    { href: '/cost-firewall', label: 'Cost Firewall', icon: '$' },
    { href: '/agent-dna', label: 'Agent DNA', icon: '⬡' },
    { href: '/governance', label: 'Governance', icon: '⚖' },
    { href: '/incidents', label: 'Incidents', icon: '⚠' },
    { href: '/policies', label: 'Policies', icon: '📋' },
    { href: '/replay', label: 'Replay', icon: '⏪' },
    { href: '/settings', label: 'Settings', icon: '⚙' },
  ]

  return (
    <aside className="w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="px-5 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-white tracking-tight">ARGUS</span>
          <span className="text-xs bg-indigo-600 text-white px-1.5 py-0.5 rounded font-mono">v1</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">AI Runtime Control Plane</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <span className="w-4 text-center opacity-60">{item.icon}</span>
            {item.label}
          </a>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          <span className="text-xs text-gray-500">Control Plane Online</span>
        </div>
      </div>
    </aside>
  )
}
