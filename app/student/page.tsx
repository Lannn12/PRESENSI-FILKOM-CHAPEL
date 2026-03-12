'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Search, BookOpen } from 'lucide-react'
import type { StudentInfo, AttendanceStats, AttendanceRow } from '@/lib/types'
import { EVENT_TYPE_LABELS, STATUS_LABELS, STATUS_COLORS } from '@/lib/types'

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-base font-bold leading-tight">Cek Kehadiran Kuliah Umum</h1>
          <p className="text-xs text-muted-foreground">FILKOM</p>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 max-w-xl mx-auto w-full space-y-4">
        {/* Search form */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            value={noReg}
            onChange={(e) => setNoReg(e.target.value)}
            placeholder="Masukkan No. Registrasi..."
            className="text-base h-11"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <Button type="submit" disabled={loading || !noReg.trim()} className="h-11 px-4">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </form>

        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        {result && (
          <div className="space-y-4">
            {/* Student info card */}
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
