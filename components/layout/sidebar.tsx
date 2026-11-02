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
  { href: '/mahasiswa', label: 'Mahasiswa', icon: Users },
  { href: '/seating', label: 'Seating', icon: Grid3X3 },
  { href: '/pertemuan', label: 'Events', icon: CalendarDays },
  { href: '/rekap', label: 'Rekap', icon: BarChart3 },
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

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[228px] h-screen sticky top-0 shrink-0 border-r border-white/[0.07]">
        <NavContent pathname={pathname} onNavigate={() => setOpen(false)} onLogout={handleLogout} />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 border-b border-white/[0.07] bg-[#08080a]/95 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#0d0d11] border border-white/10 flex items-center justify-center">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <span className="at-title text-[13px]">Presensi FILKOM</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOpen(!open)} className="rounded-lg text-white hover:bg-white/10">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={cn(
          'md:hidden fixed top-0 left-0 z-50 h-full w-72 border-r border-white/[0.07] transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <NavContent pathname={pathname} onNavigate={() => setOpen(false)} onLogout={handleLogout} />
      </aside>
    </>
  )
}

/**
 * Konten navigasi. Defined di luar Sidebar agar tidak di-remount pada
 * setiap render (reactive: static-components).
 */
function NavContent({
  pathname,
  onNavigate,
  onLogout,
}: {
  pathname: string
  onNavigate: () => void
  onLogout: () => void
}) {
  return (
    <div className="flex flex-col h-full bg-[#08080a]">
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-white/[0.07]">
        <div className="relative w-9 h-9 flex items-center justify-center shrink-0">
          <div className="absolute inset-0 rounded-xl gradient-primary opacity-90 blur-[6px]" />
          <div className="relative w-9 h-9 rounded-xl bg-[#0d0d11] border border-white/10 flex items-center justify-center">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
        </div>
        <div className="min-w-0">
          <p className="at-title text-[13px] leading-tight truncate">Presensi</p>
          <p className="text-[10px] font-medium tracking-[0.18em] uppercase text-muted-foreground mt-0.5 truncate">FILKOM</p>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        <p className="at-label px-3 pb-3">Menu</p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200',
                active
                  ? 'text-white bg-white/[0.05]'
                  : 'text-muted-foreground hover:text-white hover:bg-white/[0.03]'
              )}
            >
              {/* Active rail — neon gradient bar */}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-full gradient-primary" />
              )}
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-all duration-200',
                  active ? 'text-white' : 'text-muted-foreground group-hover:text-white'
                )}
              />
              <span className={cn('tracking-wide', active && 'text-white')}>{label}</span>
            </Link>
          )
        })}
      </nav>

      <Separator className="bg-white/[0.07]" />

      {/* Footer Actions */}
      <div className="p-3 space-y-1.5">
        <button
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-white hover:bg-white/[0.03] transition-all duration-200"
          onClick={() => {
            const url = `${window.location.origin}/student`
            navigator.clipboard.writeText(url)
            toast.success('Link portal mahasiswa disalin!')
          }}
        >
          <LinkIcon className="h-4 w-4" />
          Portal Mahasiswa
        </button>
        <button
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/10 transition-all duration-200"
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4" />
          Keluar
        </button>
      </div>

      {/* Version tag */}
      <div className="px-5 pb-5">
        <p className="text-[10px] text-white/20 font-medium tracking-[0.25em] uppercase">v1.0</p>
      </div>
    </div>
  )
}
