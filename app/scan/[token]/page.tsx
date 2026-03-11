'use client'

import React from 'react'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { CheckCircle2, XCircle, AlertCircle, Loader2, Clock, ScanLine, Camera, CameraOff } from 'lucide-react'

interface RecentScan {
  id: string
  status: 'HADIR' | 'LATE'
  waktu_scan: string
  student: { no_regis: string; first_name: string; last_name: string } | null
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

  const [noReg, setNoReg] = useState('')
  const [isLate, setIsLate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState>(null)

  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
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

  // Load meeting info
  const loadMeeting = useCallback(async () => {
    const res = await fetch(`/api/scan?token=${encodeURIComponent(token)}`)
    const data = await res.json()
    if (!res.ok) { setInitError(data.error); setLoadingInit(false); return }
    setMeeting(data.meeting)
    setRecentScans(data.recent)
    setLoadingInit(false)
  }, [token])

  useEffect(() => { loadMeeting() }, [loadMeeting])

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

  // submitNim — stable function, uses refs for mutable values
  const submitNim = useCallback(async (nim: string) => {
    if (!nim.trim() || submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)

    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenRef.current, no_regis: nim.trim(), is_late: isLateRef.current }),
    })
    const data = await res.json()
    submittingRef.current = false
    setSubmitting(false)

    if (data.success) {
      setFeedback({ type: 'success', message: data.message })
      addRecentScan({
        id: Date.now().toString(),
        status: data.status,
        waktu_scan: new Date().toISOString(),
        student: data.student ? {
          no_regis: data.student.no_regis,
          first_name: data.student.first_name,
          last_name: data.student.last_name,
        } : null,
      })
    } else if (data.warning) {
      setFeedback({ type: 'warning', message: data.message })
    } else {
      setFeedback({ type: 'error', message: data.error ?? 'Terjadi kesalahan.' })
    }
  // Stable: only addRecentScan (which is also stable)
  }, [addRecentScan])

  if (loadingInit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    )
  }

  if (initError || !meeting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
        <div className="text-center text-white space-y-2">
          <XCircle className="h-12 w-12 mx-auto text-red-400" />
          <p className="text-lg font-semibold">Halaman tidak ditemukan</p>
          <p className="text-sm text-gray-400">{initError ?? 'Token scanner tidak valid.'}</p>
        </div>
      </div>
    )
  }

  const isActive = meeting.status === 'AKTIF'

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="px-4 pt-6 pb-3 border-b border-gray-800">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">{meeting.nama_event}</h1>
              <p className="text-sm text-gray-400">{meeting.tanggal} · {meeting.start_time}{meeting.end_time ? `–${meeting.end_time}` : ''}</p>
            </div>
            <Badge className={meeting.status === 'AKTIF' ? 'bg-green-600' : meeting.status === 'DRAFT' ? 'bg-gray-600' : 'bg-red-700'}>
              {meeting.status}
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 max-w-md mx-auto w-full space-y-4">
        {/* Feedback Banner */}
        {feedback && (
          <div className={`flex items-center gap-3 rounded-xl p-4 text-sm font-medium animate-in slide-in-from-top-2 ${
            feedback.type === 'success' ? 'bg-green-700/80' :
            feedback.type === 'warning' ? 'bg-yellow-600/80' :
            'bg-red-700/80'
          }`}>
            {feedback.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> :
             feedback.type === 'warning' ? <AlertCircle className="h-5 w-5 shrink-0" /> :
             <XCircle className="h-5 w-5 shrink-0" />}
            {feedback.message}
          </div>
        )}

        {/* Scanner Form */}
        {!isActive ? (
          <div className="bg-gray-800 rounded-2xl p-6 text-center space-y-2">
            <Clock className="h-8 w-8 mx-auto text-gray-500" />
            <p className="text-gray-400 text-sm">Event belum aktif atau sudah ditutup.</p>
            <p className="text-xs text-gray-500">Status: {meeting.status}</p>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-2xl p-4 space-y-4">
            {/* Camera region — always in DOM, hidden when not active to prevent unmount race */}
            <div className={cameraActive ? 'block' : 'hidden'}>
              <div id={cameraRegionId} className="w-full rounded-xl overflow-hidden" />
              <p className="text-xs text-gray-400 text-center mt-1">Arahkan kamera ke barcode / QR kartu mahasiswa</p>
            </div>

            {cameraError && (
              <p className="text-xs text-red-400 text-center">{cameraError}</p>
            )}

            <form onSubmit={e => { e.preventDefault(); const v = noReg.trim(); if (v) { setNoReg(''); submitNim(v) } }} className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <ScanLine className="h-4 w-4" />
                <span>Scan atau ketik No. Registrasi</span>
              </div>
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={noReg}
                  onChange={e => setNoReg(e.target.value)}
                  placeholder="No. Registrasi / scan barcode"
                  className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 text-base h-12 flex-1 rounded-xl"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  disabled={submitting}
                />
                <Button
                  type="button"
                  variant="outline"
                  className={`h-12 w-12 shrink-0 rounded-xl border-gray-600 ${cameraActive ? 'bg-blue-700 border-blue-500 text-white' : 'bg-gray-700 text-gray-300'}`}
                  title={cameraActive ? 'Matikan kamera' : 'Nyalakan kamera'}
                  onClick={() => { setCameraError(null); setCameraActive(v => !v) }}
                >
                  {cameraActive ? <CameraOff className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch id="late-toggle" checked={isLate} onCheckedChange={setIsLate} />
                  <Label htmlFor="late-toggle" className={`text-sm font-medium ${isLate ? 'text-yellow-400' : 'text-gray-400'}`}>
                    {isLate ? '⏰ LATE' : 'HADIR'}
                  </Label>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" className="text-gray-400 hover:text-white h-9 px-3" onClick={() => { setNoReg(''); inputRef.current?.focus() }}>
                    Clear
                  </Button>
                  <Button type="submit" disabled={submitting || !noReg.trim()} className="h-9 bg-blue-600 hover:bg-blue-700 px-4">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Scan'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Recent Scans */}
        <div className="space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Terakhir Scan ({recentScans.length})</p>
          {recentScans.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-4">Belum ada scan</p>
          ) : recentScans.map((scan, i) => (
            <div key={scan.id} className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${i === 0 ? 'bg-gray-700' : 'bg-gray-800/50'}`}>
              <div>
                {scan.student ? (
                  <>
                    <p className="text-sm font-medium">{scan.student.last_name}, {scan.student.first_name}</p>
                    <p className="text-xs text-gray-500">{scan.student.no_regis}</p>
                  </>
                ) : <p className="text-sm text-gray-400">—</p>}
              </div>
              <div className="text-right">
                <Badge className={`text-xs ${scan.status === 'HADIR' ? 'bg-green-700' : 'bg-yellow-600'}`}>{scan.status}</Badge>
                <p className="text-xs text-gray-500 mt-0.5">{new Date(scan.waktu_scan).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
