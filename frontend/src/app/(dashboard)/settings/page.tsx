'use client'
import React from 'react'
import { Users, Key, Shield, Bell, ChevronRight } from 'lucide-react'

const navItems = [
  { name: 'Members', icon: Users, description: 'Manage workspace members and roles' },
  { name: 'Service Accounts', icon: Key, description: 'API keys and service tokens' },
  { name: 'Security', icon: Shield, description: 'SSO, 2FA, and access policies' },
  { name: 'Notifications', icon: Bell, description: 'Alert channels and webhooks' },
]

const mockMembers = [
  { name: 'John Doe', email: 'john@acme.com', role: 'Admin', initials: 'JD' },
  { name: 'Alice Smith', email: 'alice@acme.com', role: 'Viewer', initials: 'AS' },
  { name: 'Bob Jones', email: 'bob@acme.com', role: 'Editor', initials: 'BJ' },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = React.useState(0)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-fadeIn">
      <div><h1 className="text-2xl font-bold tracking-tight"><span className="gradient-text">Settings</span></h1><p className="text-sm text-gray-500 mt-0.5">Manage organization, members, and service accounts</p></div>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-3 space-y-1">
          {navItems.map((item, i) => (
            <button key={item.name} onClick={() => setActiveTab(i)}
              className={`w-full group relative flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-3xl transition-all duration-200 ${activeTab === i ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
              {activeTab === i && <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 to-white rounded-3xl border border-indigo-100" />}
              <div className={`relative z-10 w-8 h-8 rounded-2xl flex items-center justify-center transition-all duration-300 ${activeTab === i ? 'bg-gradient-to-br from-indigo-100 to-purple-50 scale-110' : 'bg-black/[0.02] group-hover:bg-black/[0.04]'}`}>
                <item.icon className={`w-4 h-4 ${activeTab === i ? 'text-indigo-500' : 'text-gray-500'}`} />
              </div>
              <div className="relative z-10">
                <p className={activeTab === i ? 'gradient-text text-sm font-semibold' : ''}>{item.name}</p>
                <p className="text-[10px] text-gray-500">{item.description}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="col-span-9 space-y-6">
          <div className="bg-white/80 backdrop-blur-2xl rounded-3xl border border-black/[0.04] overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-black/[0.04] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" />
                <div><h3 className="text-sm font-medium text-[#1d1d1f]">Organization Members</h3><p className="text-xs text-gray-500">Users with access to this workspace</p></div>
              </div>
              <button className="px-4 py-2 text-xs font-semibold rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-gray-900 hover:from-indigo-500 hover:to-purple-500 transition-all duration-300 shadow-md shadow-indigo-200 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />Invite Member</button>
            </div>
            <div className="divide-y divide-black/[0.03]">
              {mockMembers.map((user) => (
                <div key={user.email} className="px-6 py-4 flex items-center justify-between hover:bg-black/[0.01] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-50 border border-indigo-200 flex items-center justify-center">
                      <span className="text-xs font-bold gradient-text">{user.initials}</span>
                    </div>
                    <div><p className="text-sm font-medium text-[#1d1d1f]">{user.name}</p><p className="text-xs text-gray-500">{user.email}</p></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-2xl text-xs font-medium border ${user.role === 'Admin' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-black/[0.02] text-gray-500 border-black/[0.04]'}`}>{user.role}</span>
                    <button className="text-gray-500 hover:text-gray-600 transition-colors"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
