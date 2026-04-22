'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  LayoutDashboard,
  Users,
  Grid3X3,
  CalendarDays,
  BarChart3,
  LogOut,
  Menu,
  X,
  GraduationCap,
  Link as LinkIcon,
  BookOpen,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/semester', label: 'Semester', icon: GraduationCap },
  { href: '/mahasiswa', label: 'Kelola Mahasiswa', icon: Users },
  { href: '/seating', label: 'Seating', icon: Grid3X3 },
  { href: '/pertemuan', label: 'Events', icon: CalendarDays },
  { href: '/rekap', label: 'Rekap & Export', icon: BarChart3 },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Berhasil keluar')
    router.push('/login')
    router.refresh()
  }

  const NavContent = () => (
    <div className="flex flex-col h-full" style={{ background: 'linear-gradient(180deg, #1e3a8a 0%, #1d3070 50%, #172154 100%)' }}>
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-blue-700/40">
        <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center shrink-0 shadow-lg border border-white/20">
          <BookOpen className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm leading-tight text-white tracking-tight">Presensi FILKOM</p>
          <p className="text-xs text-blue-200/70 mt-0.5 font-medium">Universitas Klabat</p>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
                active
                  ? 'bg-white text-blue-700 shadow-md'
                  : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon className={cn(
                "h-4 w-4 shrink-0 transition-all duration-150",
                active ? "text-blue-600" : "text-blue-200/70 group-hover:text-white"
              )} />
              <span className={active ? 'font-semibold' : ''}>{label}</span>
              {active && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />
              )}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-blue-700/40" />

      {/* Footer Actions */}
      <div className="p-3 space-y-1.5">
        <button
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-100/80 hover:bg-white/10 hover:text-white transition-all duration-150"
          onClick={() => {
            const url = `${window.location.origin}/student`
            navigator.clipboard.writeText(url)
            toast.success('Link portal mahasiswa disalin!')
          }}
        >
          <LinkIcon className="h-4 w-4 text-blue-200/70" />
          Link Portal Mahasiswa
        </button>
        <button
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-300/80 hover:bg-red-500/15 hover:text-red-200 transition-all duration-150"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Keluar
        </button>
      </div>

      {/* Version tag */}
      <div className="px-5 pb-4">
        <p className="text-[10px] text-blue-300/40 font-medium tracking-widest uppercase">v1.0 · FILKOM</p>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 shrink-0 shadow-xl">
        <NavContent />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 border-b border-blue-100 bg-white/95 backdrop-blur-xl shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm" style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)' }}>
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="font-bold text-sm text-blue-800">Presensi FILKOM</span>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOpen(!open)} className="rounded-lg text-blue-700 hover:bg-blue-50">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-blue-950/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={cn(
          'md:hidden fixed top-0 left-0 z-50 h-full w-72 shadow-2xl transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <NavContent />
      </aside>
    </>
  )
}
