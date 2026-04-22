import Sidebar from '@/components/layout/sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50/80 dark:bg-blue-950/20">
      <Sidebar />
      <main className="flex-1 min-w-0 md:pt-0 pt-14">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
