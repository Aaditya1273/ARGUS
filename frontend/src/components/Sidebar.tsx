'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  CheckSquare, 
  Calendar, 
  BarChart3, 
  Users,
  Settings, 
  HelpCircle,
  Activity,
  AlertTriangle,
  Shield,
  FileCheck,
  Zap
} from 'lucide-react'

const navItems = [
  { name: 'Cost Firewall', href: '/cost-firewall', icon: LayoutDashboard },
  { name: 'Mission Control', href: '/mission-control', icon: Activity },
  { name: 'Agent DNA', href: '/agent-dna', icon: BarChart3 },
  { name: 'Incidents', href: '/incidents', icon: AlertTriangle },
  { name: 'Policies', href: '/policies', icon: Shield },
  { name: 'Governance', href: '/governance', icon: FileCheck },
  { name: 'Plugins', href: '/plugins', icon: Zap },
  { name: 'Replay', href: '/replay', icon: Calendar },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="w-64 bg-[#f8f9fa] border-r border-gray-200 flex flex-col h-full shrink-0">
      <div className="h-20 flex items-center px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center shadow-sm">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-xl font-bold text-gray-800 tracking-tight">ARGUS</span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-2">
          Menu
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'text-orange-700 bg-orange-50/50'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-orange-600' : 'text-gray-400'}`} strokeWidth={isActive ? 2.5 : 2} />
              {item.name}
            </Link>
          )
        })}

        <div className="mt-8 mb-4">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2">
            General
          </div>
        </div>

        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          <Settings className="w-5 h-5 text-gray-400" strokeWidth={2} />
          Settings
        </Link>
        <Link
          href="/help"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          <HelpCircle className="w-5 h-5 text-gray-400" strokeWidth={2} />
          Help
        </Link>
      </nav>
    </div>
  )
}
