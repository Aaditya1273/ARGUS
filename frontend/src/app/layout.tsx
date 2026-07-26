import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ARGUS — AI Runtime Governance & Control Plane',
  description:
    'ARGUS intercepts every AI tool call before execution, evaluates enterprise policies in milliseconds, and automatically blocks unsafe, expensive, or non-compliant behaviour.',
  openGraph: {
    title: 'ARGUS — AI Runtime Governance & Control Plane',
    description:
      'Observe, govern, and enforce policies on your AI agents in real time. The enterprise runtime control plane for AI tool calls.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-white text-black min-h-screen antialiased`} suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
