'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import type { Student, Attendance, Meeting } from '@/lib/types'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/types'

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

  if (loading) return <div className="p-10 text-center">Memuat...</div>
  if (!student) return <div className="p-10 text-center">Mahasiswa tidak ditemukan.</div>

  const stats = {
    hadir: attendances.filter(a => a.status === 'HADIR').length,
    late: attendances.filter(a => a.status === 'LATE').length,
    absent: attendances.filter(a => a.status === 'TIDAK_HADIR').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-6">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Profil Mahasiswa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm text-muted-foreground uppercase font-semibold">Nama Lengkap</p>
              <p className="text-xl font-bold">{student.first_name} {student.last_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground uppercase font-semibold">No. Registrasi</p>
              <p className="text-lg font-mono font-bold">{student.no_regis}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground uppercase font-semibold">Program Studi</p>
              <p className="font-medium">{student.major}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:w-80">
          <CardHeader>
            <CardTitle>Ringkasan Kehadiran</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center font-bold">
              <span>Hadir</span>
              <span className="text-green-600">{stats.hadir}</span>
            </div>
            <div className="flex justify-between items-center font-bold">
              <span>Terlambat</span>
              <span className="text-yellow-600">{stats.late}</span>
            </div>
            <div className="flex justify-between items-center font-bold">
              <span>Tidak Hadir</span>
              <span className="text-red-600">{stats.absent}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Presensi</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Pertemuan</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead className="pr-6 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-10 text-muted-foreground italic">Belum ada riwayat kehadiran.</TableCell>
                </TableRow>
              ) : (
                attendances.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="pl-6 font-medium">{a.meeting?.nama_event}</TableCell>
                    <TableCell>{a.meeting?.tanggal}</TableCell>
                    <TableCell className="pr-6 text-right">
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
  )
}
