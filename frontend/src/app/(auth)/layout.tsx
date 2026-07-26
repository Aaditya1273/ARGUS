import React from 'react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-[#f5f5f7]">
      {/* Left side - Branding */}
      <div className="hidden md:flex flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-orange-50/30 to-white" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-200 to-transparent" />
        <div 
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage: 
              'linear-gradient(rgba(255,107,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,107,0,0.03) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center">
              <img src="/LOGO.png" alt="ARGUS Logo" className="h-10 w-auto" />
            </div>
            <div>
              <span className="text-lg font-bold gradient-text tracking-tight">ARGUS</span>
              <p className="text-[10px] text-gray-400 leading-none">Control Plane</p>
            </div>
          </div>
          
          <div className="mt-32 max-w-md">
            <h1 className="text-4xl font-bold leading-tight text-[#1d1d1f]">
              AI Runtime
              <br />
              <span className="gradient-text">Control Plane.</span>
            </h1>
            <p className="mt-6 text-base text-gray-500 leading-relaxed">
              Observe, detect, govern, and heal your AI agents in real time. Ensure compliance, 
              control costs, and prevent runaway agents before they do damage.
            </p>
            
            <div className="mt-10 space-y-4">
              {[
                { label: 'Real-time Governance', desc: 'Enforce policies on every agent action' },
                { label: 'Cost Firewall', desc: 'Prevent budget overruns automatically' },
                { label: 'Behavioral DNA', desc: 'Detect anomalies with behavioral baselines' },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B00]" />
                  <div>
                    <p className="text-sm font-medium text-[#1d1d1f]">{f.label}</p>
                    <p className="text-xs text-gray-400">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="relative z-10 text-sm text-gray-400">
          © {new Date().getFullYear()} ARGUS Enterprise. All rights reserved.
        </div>
      </div>
      
      {/* Right side - Forms */}
      <div className="flex items-center justify-center p-8 relative overflow-hidden bg-[#0A0A0A]">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img src="/image.png" alt="Background" className="w-full h-full object-cover object-center opacity-80 pointer-events-none" />
        </div>
        
        <div className="w-full max-w-md relative z-10">
          <div className="bg-white/80 backdrop-blur-2xl rounded-4xl border border-black/[0.04] shadow-xl p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
