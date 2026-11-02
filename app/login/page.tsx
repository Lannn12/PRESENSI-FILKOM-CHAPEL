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
      <div className="tubes-canvas min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 tubes-grain" />

        <div className="relative z-10 text-center space-y-10 px-8 animate-in fade-in zoom-in-95 duration-700">
          <div className="flex justify-center">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 rounded-[2rem] gradient-primary opacity-70 blur-2xl" />
              <div className="relative w-24 h-24 rounded-[2rem] bg-[#0b0b0e] border border-white/10 flex items-center justify-center">
                <BookOpen className="text-white h-10 w-10" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="at-display text-6xl font-bold text-white tracking-[-0.04em] leading-[0.95]">
              PRESENSI
              <br />
              <span className="text-gradient">FILKOM</span>
            </h1>
            <div className="flex items-center justify-center gap-3">
              <div className="h-px w-12 bg-white/15" />
              <p className="text-white/50 text-[10px] font-semibold tracking-[0.35em] uppercase">Kuliah Umum & Chapel</p>
              <div className="h-px w-12 bg-white/15" />
            </div>
            <p className="text-white/25 text-[10px] tracking-[0.3em] uppercase font-medium">Universitas Klabat</p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="w-48 h-px bg-white/10 rounded-full overflow-hidden">
              <div className="h-full w-full gradient-primary animate-progress-loading origin-left rounded-full" />
            </div>
            <p className="text-white/25 text-[10px] font-semibold tracking-[0.25em] uppercase">Memuat sistem</p>
          </div>
        </div>
      </div>
    )
  }

  /* ── Login Page ────────────────────────────────────────────── */
  return (
    <div className="tubes-canvas min-h-screen flex items-center justify-center relative overflow-hidden p-4">
      <div className="absolute inset-0 tubes-grain" />

      {/* ── Main container ── */}
      <div className="relative z-10 w-full max-w-5xl flex rounded-2xl overflow-hidden border border-white/[0.08] shadow-float bg-[#08080a]/80 backdrop-blur-2xl">

        {/* LEFT — Branding Panel */}
        <div className="hidden lg:flex flex-col justify-between p-12 flex-1 relative">
          {/* Accent hairline di sisi kiri panel */}
          <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-blue-500/40 to-transparent" />

          {/* Top: Logo + Title */}
          <div className="space-y-12">
            <div className="flex items-center gap-4">
              <div className="relative w-12 h-12 flex items-center justify-center">
                <div className="absolute inset-0 rounded-xl gradient-primary opacity-80 blur-md" />
                <div className="relative w-12 h-12 rounded-xl bg-[#0b0b0e] border border-white/10 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <p className="at-title text-[15px]">Presensi FILKOM</p>
                <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-white/30 mt-1">Universitas Klabat</p>
              </div>
            </div>

            {/* Headline */}
            <div className="space-y-5">
              <h1 className="at-display text-5xl font-bold text-white leading-[1.05] tracking-[-0.035em]">
                Sistem Presensi
                <br />
                <span className="text-gradient">Digital FILKOM</span>
              </h1>
              <p className="text-white/45 text-[15px] font-light leading-relaxed max-w-sm">
                Platform presensi digital terintegrasi untuk Kuliah Umum dan Chapel Universitas Klabat.
              </p>
            </div>

            {/* Features */}
            <div className="space-y-3.5">
              <p className="at-label">Kapabilitas</p>
              {[
                'Presensi real-time dengan QR code & barcode',
                'Rekap otomatis per semester & event',
                'Export laporan Excel, CSV & PDF',
                'Monitor kehadiran secara live',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-blue-400/90 shrink-0" />
                  <span className="text-white/60 text-[13px] font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom: Badge */}
          <div className="flex items-center gap-2.5 mt-10">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/30 text-[10px] font-medium tracking-[0.18em] uppercase">Sistem aktif & aman</span>
          </div>
        </div>

        {/* RIGHT — Login Form Panel */}
        <div className="w-full lg:w-[440px] lg:shrink-0 bg-[#0b0b0e] flex flex-col justify-center p-10">
          {/* Mobile logo */}
          <div className="flex lg:hidden justify-center mb-8">
            <div className="relative w-14 h-14 flex items-center justify-center">
              <div className="absolute inset-0 rounded-xl gradient-primary opacity-80 blur-md" />
              <div className="relative w-14 h-14 rounded-xl bg-[#0b0b0e] border border-white/10 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          {/* Header */}
          <div className="mb-8 space-y-2.5">
            <p className="at-label">Administrasi</p>
            <h2 className="at-display text-3xl font-bold text-white tracking-[-0.03em]">Masuk</h2>
            <p className="text-white/40 text-sm">Gunakan akun admin Anda untuk melanjutkan</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="at-label">
                Email Admin
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@filkom.ac.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-12 pl-11 rounded-lg text-sm placeholder:text-white/20"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="at-label">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-12 pl-11 rounded-lg text-sm placeholder:text-white/20"
                />
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-12 rounded-lg text-[11px] font-semibold uppercase tracking-[0.18em] text-white overflow-hidden relative animate-sweep mt-2"
              style={{ background: 'linear-gradient(120deg, #4d6bff 0%, #8b5cf6 52%, #ff3d81 100%)' }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memverifikasi
                </>
              ) : (
                'Masuk ke Dashboard'
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-white/[0.03] border border-white/[0.07]">
              <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0" />
              <p className="text-[11px] text-white/40 font-medium">Koneksi aman & terenkripsi dengan SSL</p>
            </div>
            <p className="text-[10px] text-center text-white/20 tracking-[0.12em] uppercase">
              © 2026 Fakultas Ilmu Komputer — Universitas Klabat
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
