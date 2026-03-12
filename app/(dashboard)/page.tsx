'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  Users, CalendarDays, TrendingUp, Search, Loader2,
} from 'lucide-react'
import type { Meeting, Attendance, EventType, AttendanceStatus } from '@/lib/types'
import { EVENT_TYPE_LABELS, STATUS_LABELS, STATUS_COLORS } from '@/lib/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface ChartData {
  event: string
  HADIR: number
  LATE: number
  TIDAK_HADIR: number
}

interface StudentAbsentRow {
  student_id: string
  no_regis: string
  first_name: string
  last_name: string
  major: string
  absent_count: number
}

export default function DashboardPage() {
  const supabase = createClient()

  const [summaryStats, setSummaryStats] = useState({ totalStudents: 0, totalEvents: 0, avgAttendance: 0 })
  const [seatingPreview, setSeatingPreview] = useState({ male: { assigned: 0, capacity: 0 }, female: { assigned: 0, capacity: 0 } })
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [chartFilter, setChartFilter] = useState<'ALL' | EventType>('ALL')
  const [loadingChart, setLoadingChart] = useState(true)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState<{ student: { no_regis: string; first_name: string; last_name: string; major: string } | null; attendances: (Attendance & { meeting: Meeting })[] } | null>(null)
  const [searching, setSearching] = useState(false)

  const [absentThreshold, setAbsentThreshold] = useState('')
  const [absentRows, setAbsentRows] = useState<StudentAbsentRow[]>([])
  const [loadingAbsent, setLoadingAbsent] = useState(false)

  // Fetch summary stats
  const fetchStats = useCallback(async () => {
    const { count: totalStudents } = await supabase.from('students').select('*', { count: 'exact', head: true })
    const { data: activeSemester } = await supabase.from('semesters').select('id').eq('is_active', true).single()
    const { count: totalEvents } = await supabase.from('meetings').select('*', { count: 'exact', head: true }).eq('semester_id', activeSemester?.id ?? '')
    const { count: totalHadir } = await supabase.from('attendances').select('*', { count: 'exact', head: true }).eq('status', 'HADIR')
    const { count: totalAttendances } = await supabase.from('attendances').select('*', { count: 'exact', head: true })

    setSummaryStats({
      totalStudents: totalStudents ?? 0,
      totalEvents: totalEvents ?? 0,
      avgAttendance: totalAttendances ? Math.round(((totalHadir ?? 0) / totalAttendances) * 100) : 0,
    })

    // Seating preview
    const { data: sections } = await supabase.from('sections').select('gender, capacity').eq('semester_id', activeSemester?.id ?? '')
    const { data: assignments } = await supabase.from('student_sections').select('section_id, sections(gender)').eq('semester_id', activeSemester?.id ?? '')
    const maleCapacity = (sections ?? []).filter((s: { gender: string; capacity: number }) => s.gender === 'MALE').reduce((a: number, s: { gender: string; capacity: number }) => a + s.capacity, 0)
    const femaleCapacity = (sections ?? []).filter((s: { gender: string; capacity: number }) => s.gender === 'FEMALE').reduce((a: number, s: { gender: string; capacity: number }) => a + s.capacity, 0)
    const maleAssigned = (assignments ?? []).filter((a: Record<string, unknown>) => (a.sections as Record<string, unknown> | null)?.gender === 'MALE').length
    const femaleAssigned = (assignments ?? []).filter((a: Record<string, unknown>) => (a.sections as Record<string, unknown> | null)?.gender === 'FEMALE').length
    setSeatingPreview({ male: { assigned: maleAssigned, capacity: maleCapacity }, female: { assigned: femaleAssigned, capacity: femaleCapacity } })
  }, [supabase])

  // Fetch chart data
  const fetchChartData = useCallback(async () => {
    setLoadingChart(true)
    const { data: activeSemester } = await supabase.from('semesters').select('id').eq('is_active', true).single()
    if (!activeSemester) { setLoadingChart(false); return }

    let query = supabase.from('meetings').select('id, nama_event, tanggal, event_type').eq('semester_id', activeSemester.id).eq('status', 'DITUTUP').order('tanggal')
    if (chartFilter !== 'ALL') query = query.eq('event_type', chartFilter)
    const { data: meetings } = await query

    if (!meetings?.length) { setChartData([]); setLoadingChart(false); return }

    const meetingIds = meetings.map((m: { id: string }) => m.id)
    const { data: attendances } = await supabase.from('attendances').select('meeting_id, status').in('meeting_id', meetingIds)

    const data: ChartData[] = meetings.map((m: { id: string; nama_event: string }) => {
      const rows = (attendances ?? []).filter((a: { meeting_id: string }) => a.meeting_id === m.id)
      return {
        event: m.nama_event.length > 14 ? m.nama_event.slice(0, 14) + '…' : m.nama_event,
        HADIR: rows.filter((r: { status: string }) => r.status === 'HADIR').length,
        LATE: rows.filter((r: { status: string }) => r.status === 'LATE').length,
        TIDAK_HADIR: rows.filter((r: { status: string }) => r.status === 'TIDAK_HADIR').length,
      }
    })
    setChartData(data)
    setLoadingChart(false)
  }, [supabase, chartFilter])

  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { fetchChartData() }, [fetchChartData])

  // Search student attendance
  async function handleSearch() {
    if (!searchQuery.trim()) return
    setSearching(true)
    const { data: student } = await supabase.from('students').select('no_regis, first_name, last_name, major').or(`no_regis.eq.${searchQuery.trim()},first_name.ilike.%${searchQuery.trim()}%,last_name.ilike.%${searchQuery.trim()}%`).limit(1).single()
    if (!student) { setSearchResult({ student: null, attendances: [] }); setSearching(false); return }
    const { data: attendances } = await supabase.from('attendances').select('*, meeting:meetings(*)').eq('student_id', (await supabase.from('students').select('id').eq('no_regis', student.no_regis).single()).data?.id ?? '').order('created_at', { ascending: false })
    setSearchResult({ student, attendances: (attendances ?? []) as any })
    setSearching(false)
  }

  async function handleUpdateAttendance(attendanceId: string, newStatus: AttendanceStatus) {
    await supabase.from('attendances').update({ status: newStatus }).eq('id', attendanceId)
    if (searchResult?.student) handleSearch()
  }

  // Absent more than
  async function handleAbsentFilter() {
    const threshold = parseInt(absentThreshold)
    if (isNaN(threshold) || threshold < 0) return
    setLoadingAbsent(true)
    let data: unknown = null
    try {
      const result = await supabase.rpc('get_students_absent_more_than', { threshold_count: threshold })
      data = result.data
    } catch (err) {
      console.error('[Dashboard] RPC get_students_absent_more_than failed:', err)
    }
    if (!data) {
      // Fallback: manual query
      const { data: allAtt } = await supabase.from('attendances').select('student_id, status, student:students(no_regis, first_name, last_name, major)')
      const map = new Map<string, StudentAbsentRow>()
      for (const a of allAtt ?? []) {
        if (a.status === 'TIDAK_HADIR') {
          const st = (a as any).student
          if (!st) continue
          const prev = map.get(a.student_id) ?? { student_id: a.student_id, no_regis: st.no_regis, first_name: st.first_name, last_name: st.last_name, major: st.major, absent_count: 0 }
          map.set(a.student_id, { ...prev, absent_count: prev.absent_count + 1 })
        }
      }
      setAbsentRows([...map.values()].filter((r) => r.absent_count > threshold).sort((a, b) => b.absent_count - a.absent_count))
    } else {
      setAbsentRows((data as StudentAbsentRow[]).filter((r) => r.absent_count > threshold))
    }
    setLoadingAbsent(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Ringkasan presensi kuliah umum FILKOM</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{summaryStats.totalStudents}</p>
                <p className="text-xs text-muted-foreground">Total Mahasiswa</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-8 w-8 text-indigo-500" />
              <div>
                <p className="text-2xl font-bold">{summaryStats.totalEvents}</p>
                <p className="text-xs text-muted-foreground">Total Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{summaryStats.avgAttendance}%</p>
                <p className="text-xs text-muted-foreground">Rata-rata Hadir</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Seating</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-600 font-semibold">♂ Male</span>
                <span className="font-bold">{seatingPreview.male.assigned}/{seatingPreview.male.capacity}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-pink-600 font-semibold">♀ Female</span>
                <span className="font-bold">{seatingPreview.female.assigned}/{seatingPreview.female.capacity}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Trend Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Attendance Trends</CardTitle>
          <Select value={chartFilter} onValueChange={(v) => setChartFilter(v as any)}>
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Events</SelectItem>
              {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((t) => (
                <SelectItem key={t} value={t}>{EVENT_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loadingChart ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              Belum ada data event yang ditutup
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="event" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="HADIR" fill="#22c55e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="LATE" fill="#eab308" radius={[3, 3, 0, 0]} />
                <Bar dataKey="TIDAK_HADIR" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Search & Edit Attendance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cari & Edit Kehadiran Mahasiswa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="No. Reg atau nama mahasiswa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={searching} size="icon">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {searchResult && !searchResult.student && (
              <p className="text-sm text-red-500">Mahasiswa tidak ditemukan.</p>
            )}
            {searchResult?.student && (
              <div className="space-y-2">
                <div className="p-2 bg-muted rounded-md text-sm">
                  <span className="font-semibold">{searchResult.student.last_name}, {searchResult.student.first_name}</span>
                  <span className="text-muted-foreground ml-2">— {searchResult.student.no_regis} · {searchResult.student.major}</span>
                </div>
                <div className="max-h-52 overflow-y-auto rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Event</TableHead>
                        <TableHead className="text-xs">Tanggal</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searchResult.attendances.length === 0 && (
                        <TableRow><TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-4">Belum ada data</TableCell></TableRow>
                      )}
                      {searchResult.attendances.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs py-1.5">{(a as any).meeting?.nama_event ?? '-'}</TableCell>
                          <TableCell className="text-xs py-1.5">{(a as any).meeting?.tanggal ?? '-'}</TableCell>
                          <TableCell className="py-1.5">
                            <Select value={a.status} onValueChange={(v) => handleUpdateAttendance(a.id, v as AttendanceStatus)}>
                              <SelectTrigger className={`h-6 text-xs px-2 rounded-full border-0 ${STATUS_COLORS[a.status]}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(['HADIR', 'LATE', 'TIDAK_HADIR'] as AttendanceStatus[]).map((s) => (
                                  <SelectItem key={s} value={s} className="text-xs">{STATUS_LABELS[s]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Absent More Than */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Absent More Than</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                placeholder="Masukkan batas (contoh: 3)"
                value={absentThreshold}
                onChange={(e) => setAbsentThreshold(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAbsentFilter()}
              />
              <Button onClick={handleAbsentFilter} disabled={loadingAbsent}>
                {loadingAbsent ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cari'}
              </Button>
            </div>
            {absentRows.length > 0 && (
              <div className="max-h-52 overflow-y-auto rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Nama</TableHead>
                      <TableHead className="text-xs">Prodi</TableHead>
                      <TableHead className="text-xs text-right">Absent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {absentRows.map((r) => (
                      <TableRow key={r.student_id}>
                        <TableCell className="text-xs py-1.5">
                          <div>{r.last_name}, {r.first_name}</div>
                          <div className="text-muted-foreground">{r.no_regis}</div>
                        </TableCell>
                        <TableCell className="text-xs py-1.5">{r.major}</TableCell>
                        <TableCell className="text-right py-1.5">
                          <Badge variant="destructive" className="text-xs">{r.absent_count}×</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {absentThreshold && absentRows.length === 0 && !loadingAbsent && (
              <p className="text-sm text-muted-foreground text-center py-2">Tidak ada mahasiswa dengan absent &gt; {absentThreshold}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
