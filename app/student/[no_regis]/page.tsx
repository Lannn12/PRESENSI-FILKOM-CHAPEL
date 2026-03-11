'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, BookOpen } from 'lucide-react'
import type { EventType, AttendanceStatus } from '@/lib/types'
import { EVENT_TYPE_LABELS, STATUS_LABELS } from '@/lib/types'

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  HADIR: 'bg-green-100 text-green-800',
  LATE: 'bg-yellow-100 text-yellow-800',
  TIDAK_HADIR: 'bg-red-100 text-red-800',
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

export default function StudentDetailPage() {
  const params = useParams<{ no_regis: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    student: StudentInfo
    stats: Stats
    attendances: AttRow[]
  } | null>(null)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/student?no_regis=${encodeURIComponent(params.no_regis)}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Terjadi kesalahan.')
      } else {
        setResult(data)
      }
      setLoading(false)
    }
    load()
  }, [params.no_regis])

  const pct = result && result.stats.total > 0
    ? Math.round(((result.stats.hadir + result.stats.late) / result.stats.total) * 100)
    : 0

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-base font-bold leading-tight">Kehadiran Kuliah Umum</h1>
          <p className="text-xs text-muted-foreground">FILKOM</p>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 max-w-xl mx-auto w-full space-y-4">
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-red-500">{error}</p>
            </CardContent>
          </Card>
        )}

        {result && (
          <div className="space-y-4">
            {/* Student info */}
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="font-semibold text-base">
                  {result.student.last_name}, {result.student.first_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {result.student.no_regis} &middot; {result.student.major}
                </p>
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Total', val: result.stats.total, cls: 'text-blue-700' },
                { label: 'Hadir', val: result.stats.hadir, cls: 'text-green-700' },
                { label: 'Late', val: result.stats.late, cls: 'text-yellow-700' },
                { label: 'Absen', val: result.stats.tidak_hadir, cls: 'text-red-700' },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="py-3">
                    <p className={`text-2xl font-bold ${s.cls}`}>{s.val}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Percentage bar */}
            <Card>
              <CardContent className="py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Persentase Kehadiran</span>
                  <span className="text-sm font-bold">{pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Attendance table */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Riwayat Kehadiran</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Event</TableHead>
                      <TableHead className="text-xs">Tanggal</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.attendances.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-6 text-sm">
                          Belum ada data kehadiran
                        </TableCell>
                      </TableRow>
                    ) : (
                      result.attendances.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs">
                            <div className="font-medium">{a.meeting?.nama_event ?? '—'}</div>
                            {a.meeting && (
                              <div className="text-muted-foreground text-xs">
                                {EVENT_TYPE_LABELS[a.meeting.event_type]}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{a.meeting?.tanggal ?? '—'}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_COLORS[a.status]}`}
                            >
                              {STATUS_LABELS[a.status]}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
