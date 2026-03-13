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
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shrink-0 shadow-lg">
          <span className="text-white font-bold text-lg">F</span>
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm leading-tight text-gradient-primary">Presensi FILKOM</p>
          <p className="text-xs text-muted-foreground">Kuliah Umum / Chapel</p>
        </div>
      </div>

      <Separator className="mx-3" />

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                active
                  ? 'gradient-primary text-white shadow-md'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:translate-x-0.5'
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0 transition-transform duration-200", active && "scale-110")} />
              {label}
              {active && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />
              )}
            </Link>
          )
        })}
      </nav>

      <Separator className="mx-3" />

      {/* Share and Logout */}
      <div className="p-3 space-y-2">
        <Button
          variant="outline"
          className="w-full justify-start text-sm font-medium border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-900 dark:hover:bg-blue-900/40 rounded-xl transition-all duration-200"
          onClick={() => {
            const url = `${window.location.origin}/student`
            navigator.clipboard.writeText(url)
            toast.success('Link portal mahasiswa disalin!')
          }}
        >
          <LinkIcon className="h-4 w-4 mr-3" />
          Link Portal Mahasiswa
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all duration-200"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-3" />
          Keluar
        </Button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r bg-background h-screen sticky top-0 shrink-0 shadow-float">
        <NavContent />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 border-b bg-background/80 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">F</span>
          </div>
          <span className="font-bold text-sm text-gradient-primary">Presensi FILKOM</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOpen(!open)} className="rounded-lg">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile sidebar overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={cn(
          'md:hidden fixed top-0 left-0 z-50 h-full w-72 bg-background border-r shadow-2xl transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <NavContent />
      </aside>
    </>
  )
}
