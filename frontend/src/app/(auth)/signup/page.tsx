'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Lock, Mail, Building, User, Shield } from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      router.push('/mission-control')
    }, 800)
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-200">
          <Shield className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-2xl font-bold gradient-text tracking-tight">Create your account</h2>
        <p className="mt-2 text-sm text-gray-500">Start securing your AI runtime in minutes.</p>
      </div>

      <form onSubmit={handleSignup} className="space-y-6">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">First name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-gray-400" />
                </div>
                <input type="text" required className="glass-input w-full pl-11 pr-4 py-3 text-sm" placeholder="Jane" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Last name</label>
              <input type="text" required className="glass-input w-full px-4 py-3 text-sm" placeholder="Doe" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Organization</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Building className="h-4 w-4 text-gray-400" />
              </div>
              <input type="text" required className="glass-input w-full pl-11 pr-4 py-3 text-sm" placeholder="Acme Corp" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Work Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-gray-400" />
              </div>
              <input type="email" required className="glass-input w-full pl-11 pr-4 py-3 text-sm" placeholder="jane@acme.com" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-gray-400" />
              </div>
              <input type="password" required className="glass-input w-full pl-11 pr-4 py-3 text-sm" placeholder="••••••••" />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center items-center gap-2 py-3.5 px-4 text-sm font-semibold rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 transition-all duration-300 shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Create Account
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="text-center">
        <p className="text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-indigo-500 hover:text-indigo-600 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
