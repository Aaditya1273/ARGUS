'use client'

import React, { useState } from 'react'
import { signIn } from 'next-auth/react'
import { ArrowRight, Shield } from 'lucide-react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  
  const handleGoogleLogin = async () => {
    setLoading(true)
    try {
      await signIn('google', { callbackUrl: '/mission-control' })
    } catch (error) {
      console.error('Login failed:', error)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="w-14 h-14 rounded-3xl bg-[#FF6B00] flex items-center justify-center mx-auto mb-4 shadow-xl shadow-orange-200/50">
          <Shield className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-2xl font-bold gradient-text tracking-tight">Sign in to ARGUS</h2>
        <p className="mt-2 text-sm text-gray-500">Welcome back. Please select a provider to login.</p>
      </div>

      <div className="space-y-6">
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex justify-center items-center gap-3 py-3.5 px-4 text-sm font-semibold rounded-2xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all duration-300 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-[#FF6B00]/20 border-t-[#FF6B00] rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </>
          )}
        </button>
      </div>

    </div>
  )
}
