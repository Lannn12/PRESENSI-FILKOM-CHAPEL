'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, GraduationCap, Mail, Lock } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center gradient-hero p-4 relative overflow-hidden">
      {/* Animated background shapes */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-500" />
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/15 rounded-full blur-3xl animate-pulse delay-700" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/15 rounded-full blur-3xl animate-pulse delay-300" />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:32px]" />

      <Card className="w-full max-w-md shadow-2xl border-white/20 backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 relative z-10 overflow-hidden">
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 gradient-primary" />
        
        <CardHeader className="space-y-4 text-center pb-6 pt-8">
          <div className="flex justify-center">
            <div className="w-20 h-20 gradient-primary rounded-3xl flex items-center justify-center shadow-2xl transform hover:scale-105 transition-all duration-300 group">
              <GraduationCap className="w-11 h-11 text-white group-hover:scale-110 transition-transform duration-300" />
            </div>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-4xl font-bold text-gradient tracking-tight">Presensi FILKOM</CardTitle>
            <CardDescription className="text-base text-muted-foreground font-light">
              Sistem Presensi Kuliah Umum / Chapel
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pb-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <Mail className="w-4 h-4" />
                Email
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@filkom.ac.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-12 rounded-xl border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all pl-10"
                />
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <Lock className="w-4 h-4" />
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-12 rounded-xl border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all pl-10"
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-12 rounded-xl gradient-primary hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-purple-500/25 text-base font-medium"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Masuk...
                </>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Masuk ke Dashboard
                  <Mail className="w-4 h-4 rotate-45" />
                </span>
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Universitas Klabat</span>
            </div>
          </div>

          <div className="pt-4 text-center">
            <p className="text-xs text-muted-foreground/70">
              © 2026 Fakultas Ilmu Komputer
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
