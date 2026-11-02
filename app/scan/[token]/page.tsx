'use client'

import React from 'react'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { CheckCircle2, XCircle, AlertCircle, Loader2, Clock, ScanLine, Camera, CameraOff, Lock, Users, BookOpen } from 'lucide-react'

interface RecentScan {
  id: string
  status: 'HADIR' | 'LATE'
  waktu_scan: string
  student: { no_regis: string; first_name: string; last_name: string } | null
  student_status: string | null
  section_title: string | null
  seat_label: string | null
}

interface MeetingInfo {
  id: string
  nama_event: string
  tanggal: string
  start_time: string
  end_time: string | null
  status: string
  event_type: string
}

type FeedbackState = { type: 'success' | 'warning' | 'error'; message: string } | null

export default function ScannerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = React.use(params)
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraRegionId = 'qr-camera-region'

  const [meeting, setMeeting] = useState<MeetingInfo | null>(null)
  const [recentScans, setRecentScans] = useState<RecentScan[]>([])
  const [loadingInit, setLoadingInit] = useState(true)
  const [initError, setInitError] = useState<string | null>(null)
  const [showSplash, setShowSplash] = useState(true)
  const [splashMinDone, setSplashMinDone] = useState(false)

  const [noReg, setNoReg] = useState('')
  const [isLate, setIsLate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState>(null)

  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [counts, setCounts] = useState({ hadir: 0, late: 0 })
  const [requiresPin, setRequiresPin] = useState(false)
  const [pinVerified, setPinVerified] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [verifyingPin, setVerifyingPin] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null)
  const lastScannedRef = useRef<string>('')

  // Refs so camera callback always reads latest values without stale closure
  const isLateRef = useRef(isLate)
  useEffect(() => { isLateRef.current = isLate }, [isLate])
  const submittingRef = useRef(false)
  const tokenRef = useRef(token)
  useEffect(() => { tokenRef.current = token }, [token])
  const addRecentScan = useCallback((scan: RecentScan) => {
    setRecentScans(prev => [scan, ...prev.slice(0, 29)])
  }, [])
  const incrementCount = useCallback((status: 'HADIR' | 'LATE') => {
    setCounts(prev => ({
      hadir: prev.hadir + (status === 'HADIR' ? 1 : 0),
      late: prev.late + (status === 'LATE' ? 1 : 0),
    }))
  }, [])

  // Load meeting info
  const loadMeeting = useCallback(async () => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const res = await fetch(`/api/scan?token=${encodeURIComponent(token)}`, { signal: controller.signal })
      clearTimeout(timeout)
      let data: Record<string, unknown>
      try { data = await res.json() } catch { data = {} }
      if (!res.ok) {
        let debugInfo = ''
        if (data.debug) {
          const d = data.debug as Record<string, unknown>
          debugInfo = ` [${d.code}: ${d.message}] (Total meetings: ${d.total_meetings_in_db}, Token: ${d.token_received})`
        }
        setInitError(((data.error as string) ?? `Server error (${res.status})`) + debugInfo)
        setLoadingInit(false)
        return
      }
      setMeeting(data.meeting as MeetingInfo)
      setRecentScans((data.recent as RecentScan[]) ?? [])
      setCounts((data.counts as { hadir: number; late: number }) ?? { hadir: 0, late: 0 })
      const needsPin = data.requires_pin as boolean
      setRequiresPin(needsPin)
      // Check if PIN was already verified in this session
      if (needsPin) {
        const savedPin = sessionStorage.getItem(`scan_pin_${token}`)
        if (savedPin) {
          setPinVerified(true)
          pinRef.current = savedPin // Set PIN ref for barcode scanning
        }
      } else {
        setPinVerified(true)
      }
      setLoadingInit(false)
    } catch (err: unknown) {
      const msg = err instanceof Error && err.name === 'AbortError'
        ? 'Request timeout — server tidak merespons. Cek env var di Vercel.'
        : (err instanceof Error ? err.message : 'Gagal memuat data event.')
      setInitError(msg)
      setLoadingInit(false)
    }
  }, [token])

  useEffect(() => { loadMeeting() }, [loadMeeting])

  // Splash minimum display timer — show splash for at least 2.5s
  useEffect(() => {
    const t = setTimeout(() => setSplashMinDone(true), 2500)
    return () => clearTimeout(t)
  }, [])

  // Dismiss splash once both: min time elapsed AND data loaded
  useEffect(() => {
    if (splashMinDone && !loadingInit) {
      const t = setTimeout(() => setShowSplash(false), 300)
      return () => clearTimeout(t)
    }
  }, [splashMinDone, loadingInit])

  // Auto-focus input
  useEffect(() => {
    if (!loadingInit && meeting?.status === 'AKTIF') {
      inputRef.current?.focus()
    }
  }, [loadingInit, meeting])

  // Auto-clear feedback
  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => {
      setFeedback(null)
      if (!cameraActive) inputRef.current?.focus()
    }, 2500)
    return () => clearTimeout(t)
  }, [feedback, cameraActive])

  // Poll meeting status & counts every 30s — detect if admin closes/activates the meeting
  useEffect(() => {
    if (loadingInit || initError) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/scan?token=${encodeURIComponent(token)}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.meeting) setMeeting(data.meeting as MeetingInfo)
        if (data.counts) setCounts(data.counts as { hadir: number; late: number })
      } catch { /* silent — polling failure is non-critical */ }
    }, 30000)
    return () => clearInterval(interval)
  }, [token, loadingInit, initError])

  // Camera scanner lifecycle
  useEffect(() => {
    if (!cameraActive) return
    let mounted = true

    async function startCamera() {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (!mounted) return
      const scanner = new Html5Qrcode(cameraRegionId)
      scannerRef.current = scanner
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 120 } },
          (decodedText: string) => {
            const text = decodedText.trim()
            if (!text || text === lastScannedRef.current) return
            // Set cooldown immediately — before async submit — so rapid scans skip
            lastScannedRef.current = text
            if (submittingRef.current) {
              // Already processing; release cooldown quickly so retry is possible
              setTimeout(() => { lastScannedRef.current = '' }, 800)
              return
            }
            submitNim(text)
            setTimeout(() => { lastScannedRef.current = '' }, 3000)
          },
          () => { /* scan frame error — silent */ }
        )
      } catch (err: unknown) {
        if (mounted) {
          const msg = err instanceof Error ? err.message : String(err)
          setCameraError('Kamera tidak dapat diakses: ' + msg)
          setCameraActive(false)
        }
      }
    }

    startCamera()
    return () => {
      mounted = false
      const s = scannerRef.current
      scannerRef.current = null
      if (s) {
        s.stop().catch(() => {}).finally(() => { try { s.clear() } catch { /* ignore */ } })
      }
    }
  // submitNim is stable (no state in deps), safe to include
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraActive])

  // PIN refs for camera callback - already loaded in loadMeeting()
  const pinRef = useRef('')

  // Verify PIN
  async function handleVerifyPin() {
    if (!pinInput.trim()) return
    setVerifyingPin(true)
    setPinError(null)
    try {
      const res = await fetch('/api/scan/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, pin: pinInput.trim() }),
      })
      const data = await res.json()
      if (data.valid) {
        sessionStorage.setItem(`scan_pin_${token}`, pinInput.trim())
        pinRef.current = pinInput.trim()
        setPinVerified(true)
      } else {
        setPinError(data.error ?? 'PIN tidak valid.')
      }
    } catch {
      setPinError('Gagal verifikasi PIN. Cek koneksi internet.')
    }
    setVerifyingPin(false)
  }

  // submitNim — stable function, uses refs for mutable values
  const submitNim = useCallback(async (nim: string) => {
    if (!nim.trim() || submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenRef.current, no_regis: nim.trim(), is_late: isLateRef.current, pin: pinRef.current }),
      })
      let data: Record<string, unknown>
      try { data = await res.json() } catch { data = {} }
      submittingRef.current = false
      setSubmitting(false)

      if (data.success) {
        const seatInfo = data.seat_label ? ` · 🪑${data.seat_label}` : ''
        const sectionLabel = data.section_title ? ` · 📍${data.section_title}${seatInfo}` : ''
        const magangLabel = (data.student as Record<string, unknown>)?.status === 'MAGANG' ? ' · 🏢 MAGANG' : ''
        setFeedback({ type: 'success', message: `${data.message as string}${sectionLabel}${magangLabel}` })
        addRecentScan({
          id: Date.now().toString(),
          status: data.status as 'HADIR' | 'LATE',
          waktu_scan: new Date().toISOString(),
          student: data.student ? {
            no_regis: (data.student as { no_regis: string }).no_regis,
            first_name: (data.student as { first_name: string }).first_name,
            last_name: (data.student as { last_name: string }).last_name,
          } : null,
          student_status: (data.student as Record<string, unknown>)?.status as string ?? null,
          section_title: (data.section_title as string) ?? null,
          seat_label: (data.seat_label as string) ?? null,
        })
        incrementCount(data.status as 'HADIR' | 'LATE')
      } else if (data.warning) {
        const seatInfo = data.seat_label ? ` · 🪑${data.seat_label}` : ''
        const sectionLabel = data.section_title ? ` · 📍${data.section_title}${seatInfo}` : ''
        const magangLabel = (data.student as Record<string, unknown>)?.status === 'MAGANG' ? ' · 🏢 MAGANG' : ''
        setFeedback({ type: 'warning', message: `${data.message as string}${sectionLabel}${magangLabel}` })
      } else {
        setFeedback({ type: 'error', message: (data.error as string) ?? 'Terjadi kesalahan.' })
      }
    } catch {
      submittingRef.current = false
      setSubmitting(false)
      setFeedback({ type: 'error', message: 'Gagal mengirim — cek koneksi internet.' })
    }
  // Stable: only addRecentScan + incrementCount (both stable)
  }, [addRecentScan, incrementCount])

  /* ── Splash Screen — premium branding intro ───────────────── */
  if (showSplash || loadingInit) {
    return (
      <div className="tubes-canvas min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 tubes-grain" />

        <div className="relative z-10 text-center space-y-10 px-8 animate-in fade-in zoom-in-95 duration-700">
          {/* Animated Logo */}
          <div className="flex justify-center">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 rounded-[2rem] gradient-primary opacity-70 blur-2xl" />
              <div className="relative w-24 h-24 rounded-[2rem] bg-[#0b0b0e] border border-white/10 flex items-center justify-center animate-bounce-gentle">
                <ScanLine className="text-white h-10 w-10" />
              </div>
            </div>
          </div>

          {/* Branding */}
          <div className="space-y-4">
            <h1 className="at-display text-5xl font-bold text-white tracking-[-0.04em] leading-[0.95]">
              PRESENSI<br />
              <span className="text-gradient">FILKOM</span>
            </h1>
            <div className="flex items-center justify-center gap-3">
              <div className="h-px w-12 bg-white/15" />
              <p className="text-white/50 text-[10px] font-semibold tracking-[0.35em] uppercase">Kuliah Umum & Chapel</p>
              <div className="h-px w-12 bg-white/15" />
            </div>
            <p className="text-white/25 text-[10px] tracking-[0.3em] uppercase font-medium">Universitas Klabat</p>
          </div>

          {/* Scanner badge */}
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.04] backdrop-blur-xl border border-white/[0.09]">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/55 text-[11px] font-semibold uppercase tracking-[0.2em]">Scanner Mode</span>
          </div>

          {/* Progress bar */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-48 h-px bg-white/10 rounded-full overflow-hidden">
              <div className="h-full w-full gradient-primary animate-progress-loading origin-left rounded-full" />
            </div>
            <p className="text-white/25 text-[10px] font-semibold tracking-[0.25em] uppercase">Menyiapkan scanner...</p>
          </div>
        </div>
      </div>
    )
  }

  if (initError || !meeting) {
    return (
      <div className="tubes-canvas min-h-screen flex items-center justify-center px-4">
        <div className="absolute inset-0 tubes-grain" />
        <div className="relative z-10 text-center text-white space-y-4 max-w-sm">
          <div className="w-20 h-20 mx-auto bg-white/[0.04] backdrop-blur-xl rounded-xl border border-white/[0.08] flex items-center justify-center">
            <XCircle className="h-10 w-10 text-rose-400" />
          </div>
          <div className="space-y-2">
            <p className="at-title">Halaman tidak ditemukan</p>
            <p className="text-sm text-white/50">{initError ?? 'Token scanner tidak valid.'}</p>
          </div>
          <Button
            variant="outline"
            className="mt-4 text-white border-white/[0.14] bg-white/[0.03] hover:bg-white/[0.07] rounded-lg"
            onClick={() => { setInitError(null); setLoadingInit(true); loadMeeting() }}
          >
            Coba Lagi
          </Button>
        </div>
      </div>
    )
  }

  // PIN Gate — show PIN form before scanner
  if (requiresPin && !pinVerified) {
    return (
      <div className="tubes-canvas min-h-screen flex items-center justify-center px-4">
        <div className="absolute inset-0 tubes-grain" />
        <div className="relative z-10 w-full max-w-xs space-y-6 text-center">
          <div className="space-y-3">
            <div className="w-20 h-20 mx-auto bg-white/[0.04] backdrop-blur-xl rounded-xl border border-white/[0.08] flex items-center justify-center">
              <Lock className="h-10 w-10 text-blue-300" />
            </div>
            <div className="space-y-1">
              <h1 className="at-title text-lg">{meeting.nama_event}</h1>
              <p className="text-sm text-white/45">{meeting.tanggal} · {meeting.start_time}</p>
            </div>
            <p className="text-[13px] text-white/60 bg-white/[0.03] backdrop-blur-xl border border-white/[0.07] rounded-lg p-3">Masukkan PIN untuk mengakses scanner</p>
          </div>
          <form onSubmit={e => { e.preventDefault(); handleVerifyPin() }} className="space-y-4">
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={pinInput}
              onChange={e => { setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6)); setPinError(null) }}
              className="bg-white/[0.03] border-white/[0.09] text-white text-center text-3xl tracking-[0.5em] h-16 rounded-lg placeholder:text-white/15 placeholder:text-xl placeholder:tracking-normal focus:border-ring focus:ring-ring/30"
              autoComplete="off"
              autoFocus
            />
            {pinError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-400/25">
                <p className="text-sm text-rose-300">{pinError}</p>
              </div>
            )}
            <Button
              type="submit"
              disabled={verifyingPin || pinInput.length < 6}
              className="w-full h-12 text-[11px] font-semibold uppercase tracking-[0.18em] text-white rounded-lg overflow-hidden relative animate-sweep"
            >
              {verifyingPin ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Verifikasi PIN'}
            </Button>
          </form>
        </div>
      </div>
    )
  }

  const isActive = meeting.status === 'AKTIF'

  return (
    <div className="tubes-canvas min-h-screen text-white flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 tubes-grain pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 px-4 pt-6 pb-4 border-b border-white/[0.07] backdrop-blur-xl bg-white/[0.02]">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h1 className="at-title text-base">{meeting.nama_event}</h1>
              <p className="text-[11px] text-white/40">{meeting.tanggal} · {meeting.start_time}{meeting.end_time ? `–${meeting.end_time}` : ''}</p>
            </div>
            <Badge className={`${
              meeting.status === 'AKTIF' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/25' : 
              meeting.status === 'DRAFT' ? 'bg-white/[0.06] text-white/60 border border-white/[0.09]' : 
              'bg-rose-500/15 text-rose-300 border border-rose-400/25'
            } rounded-full px-3 py-1`}>
              {meeting.status}
            </Badge>
          </div>
          <div className="flex gap-2 mt-3">
            <div className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg bg-emerald-500/[0.07] border border-emerald-400/15">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-300">{counts.hadir}</p>
                <p className="text-[10px] text-emerald-400/60 uppercase tracking-[0.15em]">Hadir</p>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg bg-amber-500/[0.07] border border-amber-400/15">
              <Clock className="h-4 w-4 text-amber-400" />
              <div className="text-center">
                <p className="text-lg font-bold text-amber-300">{counts.late}</p>
                <p className="text-[10px] text-amber-400/60 uppercase tracking-[0.15em]">Late</p>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.09]">
              <Users className="h-4 w-4 text-white/70" />
              <div className="text-center">
                <p className="text-lg font-bold text-white/85">{counts.hadir + counts.late}</p>
                <p className="text-[10px] text-white/35 uppercase tracking-[0.15em]">Total</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex-1 px-4 py-4 max-w-md mx-auto w-full space-y-4">
        {/* Feedback Banner */}
        {feedback && (
          <div className={`flex items-center gap-3 rounded-xl p-4 text-sm font-medium animate-in slide-in-from-top-2 backdrop-blur-xl border ${
            feedback.type === 'success' ? 'bg-emerald-500/12 border-emerald-400/30 text-emerald-200' :
            feedback.type === 'warning' ? 'bg-amber-500/12 border-amber-400/30 text-amber-200' :
            'bg-rose-500/12 border-rose-400/30 text-rose-200'
          }`}>
            {feedback.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> :
             feedback.type === 'warning' ? <AlertCircle className="h-5 w-5 shrink-0" /> :
             <XCircle className="h-5 w-5 shrink-0" />}
            <span className="flex-1">{feedback.message}</span>
          </div>
        )}

        {/* Scanner Form */}
        {!isActive ? (
          <div className="bg-white/[0.03] backdrop-blur-xl rounded-xl p-8 text-center space-y-3 border border-white/[0.07]">
            <div className="w-16 h-16 mx-auto bg-white/[0.05] rounded-xl border border-white/[0.07] flex items-center justify-center">
              <Clock className="h-8 w-8 text-white/50" />
            </div>
            <div className="space-y-1">
              <p className="text-white/80 text-sm font-medium">Event belum aktif atau sudah ditutup</p>
              <Badge className={`${
                meeting.status === 'AKTIF' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/25' : 
                meeting.status === 'DRAFT' ? 'bg-white/[0.06] text-white/60 border border-white/[0.09]' : 
                'bg-rose-500/15 text-rose-300 border border-rose-400/25'
              } rounded-full text-xs`}>
                Status: {meeting.status}
              </Badge>
            </div>
          </div>
        ) : (
          <div className="bg-white/[0.03] backdrop-blur-xl rounded-xl p-4 space-y-4 border border-white/[0.07]">
            {/* Camera region */}
            <div className={cameraActive ? 'block' : 'hidden'}>
              <div id={cameraRegionId} className="w-full rounded-xl overflow-hidden border border-white/[0.07]" />
              <p className="text-xs text-white/50 text-center mt-2">Arahkan kamera ke barcode / QR kartu mahasiswa</p>
            </div>

            {cameraError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-400/25">
                <p className="text-xs text-rose-300 text-center">{cameraError}</p>
              </div>
            )}

            <form onSubmit={e => { e.preventDefault(); const v = noReg.trim(); if (v) { setNoReg(''); submitNim(v) } }} className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] text-white/35 uppercase tracking-[0.18em]">
                <ScanLine className="h-4 w-4" />
                <span>Scan atau ketik No. Registrasi</span>
              </div>
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={noReg}
                  onChange={e => setNoReg(e.target.value)}
                  placeholder="No. Registrasi / scan barcode"
                  className="bg-white/[0.04] border-white/[0.09] text-white placeholder:text-white/20 text-base h-12 flex-1 rounded-lg focus:border-ring focus:ring-ring/30"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  disabled={submitting}
                />
                <Button
                  type="button"
                  variant="outline"
                  className={`h-12 w-12 shrink-0 rounded-xl border-white/20 backdrop-blur-xl transition-all duration-300 ${
                    cameraActive 
                      ? 'bg-blue-500/15 border-blue-400 text-white shadow-lg shadow-blue-500/30' 
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                  title={cameraActive ? 'Matikan kamera' : 'Nyalakan kamera'}
                  onClick={() => { setCameraError(null); setCameraActive(v => !v) }}
                >
                  {cameraActive ? <CameraOff className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.07]">
                <div className="flex items-center gap-3">
                  <Switch 
                    id="late-toggle" 
                    checked={isLate} 
                    onCheckedChange={setIsLate}
                    className="data-[state=checked]:bg-amber-500"
                  />
                  <Label htmlFor="late-toggle" className={`text-sm font-medium cursor-pointer transition-colors ${
                    isLate ? 'text-amber-400' : 'text-white/60'
                  }`}>
                    {isLate ? (
                      <span className="flex items-center gap-2">
                        <Clock className="h-4 w-4" /> LATE
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" /> HADIR
                      </span>
                    )}
                  </Label>
                </div>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="text-white/50 hover:text-white hover:bg-white/[0.07] h-9 px-3 rounded-lg" 
                    onClick={() => { setNoReg(''); inputRef.current?.focus() }}
                  >
                    Clear
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={submitting || !noReg.trim()} 
                    className="h-9 px-5 rounded-lg text-[10px] font-semibold uppercase tracking-[0.16em] text-white overflow-hidden relative animate-sweep"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Scan'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Recent Scans */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-2">
            <ScanLine className="h-3.5 w-3.5 text-white/40" />
            <p className="text-xs text-white/50 uppercase tracking-wider font-semibold">Terakhir Scan ({recentScans.length})</p>
          </div>
          {recentScans.length === 0 ? (
            <div className="p-6 rounded-xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.07] text-center">
              <ScanLine className="h-8 w-8 mx-auto text-white/20 mb-2" />
              <p className="text-sm text-white/40">Belum ada scan</p>
            </div>
          ) : recentScans.map((scan, i) => (
            <div 
              key={scan.id} 
              className={`flex items-center justify-between rounded-xl px-3 py-2.5 backdrop-blur-xl border transition-all duration-300 ${
                i === 0 
                  ? 'bg-white/[0.06] border-white/[0.13] scale-[1.02]'
                  : 'bg-white/[0.02] border-white/[0.07]'
              }`}
            >
              <div className="flex-1 min-w-0">
                {scan.student ? (
                  <>
                    <p className="text-[13px] font-medium truncate">
                      {scan.student.last_name}, {scan.student.first_name}
                      {scan.student_status === 'MAGANG' && (
                        <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/25 text-orange-300 text-[10px] font-bold uppercase tracking-wider">🏢 Magang</span>
                      )}
                    </p>
                    <p className="text-[11px] text-white/40 mt-0.5">
                      {scan.student.no_regis}
                      {(scan.section_title || scan.seat_label) && (
                        <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-400/25 text-blue-300 text-xs font-mono">
                          {scan.section_title ? `📍 ${scan.section_title}` : ''}
                          {scan.section_title && scan.seat_label ? ' · ' : ''}
                          {scan.seat_label ? `🪑 ${scan.seat_label}` : ''}
                        </span>
                      )}
                    </p>
                  </>
                ) : <p className="text-sm text-white/40">—</p>}
              </div>
              <div className="text-right flex items-center gap-2 ml-3">
                <Badge className={`text-xs font-semibold rounded-full px-2.5 py-1 shadow-lg ${
                  scan.status === 'HADIR' 
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/25'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-400/25'
                }`}>
                  {scan.status}
                </Badge>
                <p className="text-[11px] text-white/35 font-mono">
                  {new Date(scan.waktu_scan).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
