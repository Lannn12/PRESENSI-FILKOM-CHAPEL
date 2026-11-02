'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import type { Student, Attendance, Meeting } from '@/lib/types'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/types'
import { formatStudentName } from '@/lib/utils'
import { BookOpen, User, Loader2, CalendarDays, XCircle } from 'lucide-react'

export default function StudentProfilePage() {
  const { no_regis } = useParams()
  const supabase = createClient()
  const [student, setStudent] = useState<Student | null>(null)
  const [attendances, setAttendances] = useState<(Attendance & { meeting: Meeting })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      if (!no_regis) return
      setLoading(true)
      const { data: stud } = await supabase.from('students').select('*').eq('no_regis', no_regis).single()
      if (stud) {
        setStudent(stud)
        const { data: atts } = await supabase
          .from('attendances')
          .select('*, meeting:meetings(*)')
          .eq('student_id', stud.id)
          .order('created_at', { ascending: false })
        setAttendances((atts ?? []) as any)
      }
      setLoading(false)
    }
    fetchData()
  }, [no_regis, supabase])

  if (loading) {
    return (
      <div className="tubes-canvas min-h-screen flex items-center justify-center">
        <div className="absolute inset-0 tubes-grain pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          <p className="at-label">Memuat data mahasiswa</p>
        </div>
      </div>
    )
  }

  if (!student) {
    return (
      <div className="tubes-canvas min-h-screen flex items-center justify-center px-4">
        <div className="absolute inset-0 tubes-grain pointer-events-none" />
        <div className="relative z-10 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-xl bg-rose-500/10 border border-rose-400/25 flex items-center justify-center">
            <XCircle className="h-6 w-6 text-rose-400" />
          </div>
          <p className="at-title text-lg">Mahasiswa tidak ditemukan</p>
          <p className="text-sm text-muted-foreground">Nomor registrasi {String(no_regis)} tidak terdaftar.</p>
        </div>
      </div>
    )
  }

  const stats = {
    hadir: attendances.filter(a => a.status === 'HADIR').length,
    late: attendances.filter(a => a.status === 'LATE').length,
    absent: attendances.filter(a => a.status === 'TIDAK_HADIR').length,
  }

  return (
    <div className="tubes-canvas min-h-screen">
      <div className="absolute inset-0 tubes-grain pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 bg-white/[0.03] backdrop-blur-xl border-b border-white/[0.09] px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-lg shrink-0">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold leading-tight text-gradient-primary truncate">
              {formatStudentName(student.first_name, student.last_name)}
            </h1>
            <p className="text-xs text-muted-foreground">
              {student.no_regis} &middot; {student.major}
            </p>
          </div>
        </div>
      </div>

      <div className="relative z-10 px-4 py-6 max-w-4xl mx-auto w-full space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Hadir', value: stats.hadir, tone: 'text-emerald-300', icon: User, ring: 'border-emerald-400/25 bg-emerald-500/[0.05]' },
            { label: 'Late', value: stats.late, tone: 'text-amber-300', icon: CalendarDays, ring: 'border-amber-400/25 bg-amber-500/[0.05]' },
            { label: 'Absen', value: stats.absent, tone: 'text-rose-300', icon: XCircle, ring: 'border-rose-400/25 bg-rose-500/[0.05]' },
          ].map(({ label, value, tone, icon: Icon, ring }) => (
            <Card key={label} className={`shadow-card border ${ring}`}>
              <CardContent className="py-4">
                <div className="text-center space-y-1">
                  <div className="flex items-center justify-center mb-0.5">
                    <Icon className={`h-4 w-4 ${tone} mr-1`} />
                  </div>
                  <p className={`text-2xl font-bold ${tone}`}>{value}</p>
                  <p className="text-xs text-muted-foreground font-medium">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Riwayat */}
        <Card className="shadow-card border-glow overflow-hidden">
          <CardHeader className="pb-3 border-b border-white/[0.09] bg-muted/20">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-400" />
              Riwayat Presensi
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-white/[0.02]">
                  <TableHead className="text-xs font-semibold">Pertemuan</TableHead>
                  <TableHead className="text-xs font-semibold">Tanggal</TableHead>
                  <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-10">
                      <div className="flex flex-col items-center gap-2">
                        <BookOpen className="h-8 w-8 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">Belum ada riwayat kehadiran.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  attendances.map((a) => (
                    <TableRow key={a.id} className="hover:bg-white/[0.02]">
                      <TableCell className="text-xs font-medium">{a.meeting?.nama_event ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.meeting?.tanggal ?? '—'}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className={STATUS_COLORS[a.status]}>
                          {STATUS_LABELS[a.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
