import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Donezo - Dashboard',
  description: 'Plan, prioritize and accomplish your task with ease.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-[#f8f9fa] text-gray-900 min-h-screen`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
