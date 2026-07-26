'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Activity, BarChart3, AlertTriangle,
  Shield, FileCheck, Zap, CalendarClock, Settings, HelpCircle,
} from 'lucide-react'

const menuItems = [
  { label: 'Cost Firewall',   href: '/cost-firewall',    icon: LayoutDashboard },
  { label: 'Mission Control', href: '/mission-control',  icon: Activity },
  { label: 'Agent DNA',       href: '/agent-dna',        icon: BarChart3 },
  { label: 'Incidents',       href: '/incidents',        icon: AlertTriangle },
  { label: 'Policies',        href: '/policies',         icon: Shield },
  { label: 'Governance',      href: '/governance',       icon: FileCheck },
  { label: 'Plugins',         href: '/plugins',          icon: Zap },
  { label: 'Replay',          href: '/replay',           icon: CalendarClock },
]

import { useSession, signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'

const generalItems = [
  { label: 'Settings', href: '/settings', icon: Settings },
  { label: 'Help',     href: '/help',     icon: HelpCircle },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const NavItem = ({ label, href, icon: Icon }: { label: string; href: string; icon: React.ElementType }) => {
    const active = pathname === href
    return (
      <Link
        href={href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
          active
            ? 'bg-orange-50 text-orange-700'
            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
        }`}
      >
        <Icon
          className={`w-[18px] h-[18px] flex-shrink-0 ${active ? 'text-orange-600' : 'text-gray-400'}`}
          strokeWidth={active ? 2.5 : 2}
        />
        {label}
      </Link>
    )
  }

  return (
    <aside className="w-60 bg-[#f8f9fa] border-r border-gray-200 flex flex-col h-full shrink-0 select-none">
      {/* Logo */}
      <div className="h-[72px] flex items-center px-5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center shadow-sm flex-shrink-0">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
            </svg>
          </div>
          <span className="text-[17px] font-bold text-gray-900 tracking-tight">ARGUS</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest px-3 mb-2">Menu</p>
        {menuItems.map(item => <NavItem key={item.href} {...item} />)}

        <div className="pt-5 pb-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest px-3 mb-2">General</p>
        </div>
        {generalItems.map(item => <NavItem key={item.href} {...item} />)}
      </nav>

      {/* User Profile */}
      {session?.user && (
        <div className="p-4 border-t border-gray-200 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              {session.user.image ? (
                <img src={session.user.image} alt={session.user.name || "User"} className="w-9 h-9 rounded-full shrink-0 border border-gray-200" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                  <span className="text-sm font-medium text-gray-600">{session.user.name?.charAt(0) || 'U'}</span>
                </div>
              )}
              <div className="overflow-hidden">
                <p className="text-sm font-medium text-gray-900 truncate">{session.user.name}</p>
                <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}

