'use client'

import { X } from 'lucide-react'
import { Space_Grotesk } from 'next/font/google'

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['600', '700'] })

export function AnnouncementBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="relative w-full bg-[#FF6B00] text-white z-50 overflow-hidden shadow-sm shadow-orange-500/20">
      {/* Subtle pulsing background effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent w-[200%] animate-[flowDash_3s_linear_infinite]" />
      
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-2 relative z-10 w-full">
        {/* Empty left spacer for perfect absolute centering */}
        <div className="w-8 flex-shrink-0" />
        
        <div className={`flex items-center justify-center gap-x-4 flex-1 overflow-hidden ${spaceGrotesk.className}`}>
          <p className="text-[15px] font-bold tracking-wide flex items-center whitespace-nowrap truncate uppercase">
            Limited      Offer     :  LifeTime      Free      Plan      for      first      1000     Users      |      Grab Now      !!!
          </p>
          <a
            href="/connect"
            className="flex-none rounded-full bg-white px-4 py-1 text-xs font-bold text-[#FF6B00] shadow-sm hover:bg-orange-50 transition-colors tracking-widest uppercase"
          >
            Claim Now <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
        
        <div className="flex w-8 justify-end flex-shrink-0">
          <button 
            type="button" 
            className="-m-1 p-1 hover:bg-white/10 rounded-full transition-colors"
            onClick={onDismiss}
          >
            <span className="sr-only">Dismiss</span>
            <X className="h-5 w-5 text-white" aria-hidden="true" />
          </button>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes flowDash {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0%); }
        }
      `}} />
    </div>
  )
}
