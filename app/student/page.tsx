'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Search, BookOpen, User, CheckCircle2, Clock, XCircle } from 'lucide-react'
import type { EventType, AttendanceStatus } from '@/lib/types'
import { EVENT_TYPE_LABELS, STATUS_LABELS } from '@/lib/types'

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  HADIR: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
  LATE: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
  TIDAK_HADIR: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30',
}

const STATUS_ICONS: Record<AttendanceStatus, React.ElementType> = {
  HADIR: CheckCircle2,
  LATE: Clock,
  TIDAK_HADIR: XCircle,
}

interface StudentInfo {
  no_regis: string
  first_name: string
  last_name: string
  major: string
  gender: string
}
interface Stats {
  total: number
  hadir: number
  late: number
  tidak_hadir: number
}
interface AttRow {
  id: string
  status: AttendanceStatus
  waktu_scan: string | null
  meeting: {
    nama_event: string
    tanggal: string
    event_type: EventType
    status: string
  } | null
}

export default function StudentPage() {
  const [noReg, setNoReg] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    student: StudentInfo
    stats: AttendanceStats
    attendances: AttendanceRow[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault()
    if (!noReg.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    const res = await fetch(`/api/student?no_regis=${encodeURIComponent(noReg.trim())}`)
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Terjadi kesalahan.')
    } else {
      setResult(data)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-900 dark:via-purple-900 dark:to-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-lg">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight text-gradient-primary">Cek Kehadiran Kuliah Umum</h1>
            <p className="text-xs text-muted-foreground">FILKOM - Universitas Klabat</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full space-y-4">
        {/* Search form */}
        <Card className="shadow-card border-glow">
          <CardContent className="pt-5">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={noReg}
                  onChange={(e) => setNoReg(e.target.value)}
                  placeholder="Masukkan No. Registrasi..."
                  className="text-base h-12 pl-11 rounded-xl border-border/50 focus:border-primary/50 focus:ring-primary/20"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              </div>
              <Button type="submit" disabled={loading || !noReg.trim()} className="h-12 px-6 rounded-xl gradient-primary shadow-lg">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
              </Button>
            </form>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Student info card */}
            <Card className="shadow-card border-glow overflow-hidden">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 gradient-primary rounded-2xl flex items-center justify-center shadow-lg">
                    <User className="h-7 w-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-lg text-gradient-primary">
                      {result.student.last_name}, {result.student.first_name}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {result.student.no_regis} &middot; {result.student.major}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-2">
              <Card className="shadow-card border-glow">
                <CardContent className="py-4">
                  <div className="text-center space-y-1">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{result.stats.total}</p>
                    <p className="text-xs text-muted-foreground font-medium">Total</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-card border-glow">
                <CardContent className="py-4">
                  <div className="text-center space-y-1">
                    <div className="flex items-center justify-center mb-0.5">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mr-1" />
                    </div>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{result.stats.hadir}</p>
                    <p className="text-xs text-muted-foreground font-medium">Hadir</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-card border-glow">
                <CardContent className="py-4">
                  <div className="text-center space-y-1">
                    <div className="flex items-center justify-center mb-0.5">
                      <Clock className="h-4 w-4 text-yellow-500 mr-1" />
                    </div>
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{result.stats.late}</p>
                    <p className="text-xs text-muted-foreground font-medium">Late</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-card border-glow">
                <CardContent className="py-4">
                  <div className="text-center space-y-1">
                    <div className="flex items-center justify-center mb-0.5">
                      <XCircle className="h-4 w-4 text-red-500 mr-1" />
                    </div>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{result.stats.tidak_hadir}</p>
                    <p className="text-xs text-muted-foreground font-medium">Absen</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Attendance table */}
            <Card className="shadow-card border-glow">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-500" />
                  Riwayat Kehadiran
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="rounded-b-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs font-semibold">Event</TableHead>
                        <TableHead className="text-xs font-semibold">Tanggal</TableHead>
                        <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.attendances.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8">
                            <div className="flex flex-col items-center gap-2">
                              <BookOpen className="h-8 w-8 text-muted-foreground/40" />
                              <p className="text-sm text-muted-foreground">Belum ada data kehadiran</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        result.attendances.map((a) => {
                          const StatusIcon = STATUS_ICONS[a.status]
                          return (
                            <TableRow key={a.id} className="hover:bg-muted/30">
                              <TableCell className="text-xs">
                                <div className="font-medium">{a.meeting?.nama_event ?? '—'}</div>
                                {a.meeting && (
                                  <div className="text-muted-foreground text-xs mt-0.5">
                                    {EVENT_TYPE_LABELS[a.meeting.event_type]}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{a.meeting?.tanggal ?? '—'}</TableCell>
                              <TableCell className="text-center">
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${STATUS_COLORS[a.status]}`}
                                >
                                  <StatusIcon className="h-3 w-3" />
                                  {STATUS_LABELS[a.status]}
                                </span>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
