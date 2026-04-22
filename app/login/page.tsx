'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, BookOpen, Mail, Lock, ShieldCheck, CheckCircle2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2200)
    return () => clearTimeout(timer)
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error('Email atau password salah.')
      setLoading(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  /* ── Splash Screen ─────────────────────────────────────────── */
  if (showSplash) {
    return (
      <div
        className="min-h-screen flex items-center justify-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0c1a5e 0%, #1a3590 50%, #1e50c8 100%)' }}
      >
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-10 blur-3xl" style={{ background: 'radial-gradient(circle, #60a5fa, transparent)' }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-10 blur-3xl" style={{ background: 'radial-gradient(circle, #93c5fd, transparent)' }} />

        <div className="relative z-10 text-center space-y-10 px-8 animate-in fade-in zoom-in-95 duration-700">
          <div className="flex justify-center">
            <div
              className="w-28 h-28 rounded-[2.5rem] flex items-center justify-center shadow-2xl border-2 border-white/20 animate-bounce-gentle"
              style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}
            >
              <BookOpen className="text-white" style={{ width: '3.5rem', height: '3.5rem' }} />
            </div>
          </div>
          <div className="space-y-3">
            <h1 className="text-6xl font-black text-white tracking-tight">
              PRESENSI<br />
              <span className="text-blue-200">FILKOM</span>
            </h1>
            <div className="flex items-center justify-center gap-3">
              <div className="h-px w-12 bg-white/20" />
              <p className="text-blue-200/70 text-xs font-bold tracking-[0.3em] uppercase">Kuliah Umum & Chapel</p>
              <div className="h-px w-12 bg-white/20" />
            </div>
            <p className="text-blue-300/50 text-xs tracking-[0.2em] uppercase font-medium">Universitas Klabat</p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-blue-300/60 animate-progress-loading origin-left rounded-full" />
            </div>
            <p className="text-blue-300/40 text-[10px] font-bold tracking-[0.25em] uppercase">Memuat sistem...</p>
          </div>
        </div>
      </div>
    )
  }

  /* ── Login Page ────────────────────────────────────────────── */
  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden p-4"
      style={{ background: 'linear-gradient(135deg, #0c1a5e 0%, #1a3590 50%, #1e50c8 100%)' }}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      {/* Glowing orbs */}
      <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full opacity-15 blur-3xl" style={{ background: 'radial-gradient(circle, #60a5fa, transparent)' }} />
      <div className="absolute bottom-[-100px] left-[-100px] w-[400px] h-[400px] rounded-full opacity-10 blur-3xl" style={{ background: 'radial-gradient(circle, #93c5fd, transparent)' }} />

      {/* ── Main container ── */}
      <div className="relative z-10 w-full max-w-5xl flex rounded-3xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.4)]">

        {/* LEFT — Branding Panel */}
        <div
          className="hidden lg:flex flex-col justify-between p-12 flex-1"
          style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', borderRight: '1px solid rgba(255,255,255,0.12)' }}
        >
          {/* Top: Logo + Title */}
          <div className="space-y-8">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center border border-white/20 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}
              >
                <BookOpen className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-lg leading-tight tracking-tight">Presensi FILKOM</p>
                <p className="text-blue-200/60 text-xs font-medium tracking-wide">Universitas Klabat</p>
              </div>
            </div>

            {/* Headline */}
            <div className="space-y-4">
              <h1 className="text-5xl font-black text-white leading-[1.1] tracking-tight">
                Sistem Presensi<br />
                <span className="text-blue-200">Digital FILKOM</span>
              </h1>
              <p className="text-blue-200/60 text-base font-light leading-relaxed max-w-xs">
                Platform presensi digital terintegrasi untuk Kuliah Umum dan Chapel Universitas Klabat.
              </p>
            </div>

            {/* Features */}
            <div className="space-y-4 pt-2">
              {[
                { text: 'Presensi real-time dengan QR code & barcode', },
                { text: 'Rekap otomatis per semester & event', },
                { text: 'Export laporan Excel, CSV & PDF', },
                { text: 'Monitor kehadiran secara live', },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-300/80 shrink-0" />
                  <span className="text-blue-100/80 text-sm font-medium">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom: Badge */}
          <div className="flex items-center gap-2 mt-8">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-blue-200/50 text-xs font-medium">Sistem aktif & aman</span>
          </div>
        </div>

        {/* RIGHT — Login Form Panel */}
        <div className="w-full lg:w-[440px] lg:shrink-0 bg-white dark:bg-gray-900 flex flex-col justify-center p-10">
          {/* Mobile logo */}
          <div className="flex lg:hidden justify-center mb-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}
            >
              <BookOpen className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Header */}
          <div className="mb-8 space-y-2">
            <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Masuk</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Gunakan akun admin Anda untuk melanjutkan</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Email Admin
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@filkom.ac.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-12 pl-11 rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-12 pl-11 rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-12 rounded-xl text-sm font-bold text-white shadow-lg transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/25 active:scale-[0.99] mt-2"
              style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)' }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memverifikasi...
                </>
              ) : 'Masuk ke Dashboard →'}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900">
              <ShieldCheck className="h-4 w-4 text-blue-500 shrink-0" />
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Koneksi aman & terenkripsi dengan SSL</p>
            </div>
            <p className="text-xs text-center text-gray-400">
              © 2026 Fakultas Ilmu Komputer — Universitas Klabat
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
