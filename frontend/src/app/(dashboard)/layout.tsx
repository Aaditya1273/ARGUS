import { Sidebar } from '@/components/Sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9fa]">
      <Sidebar />
      <main className="flex-1 overflow-auto relative z-10 p-8">
        {children}
      </main>
    </div>
  )
}
