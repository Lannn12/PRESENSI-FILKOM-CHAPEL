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
  Users, CalendarDays, TrendingUp, Search, Loader2, UserCheck, Clock, XCircle,
} from 'lucide-react'
import type { Meeting, Attendance, EventType, AttendanceStatus } from '@/lib/types'
import { EVENT_TYPE_LABELS, STATUS_LABELS, STATUS_COLORS } from '@/lib/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { FileSpreadsheet, ChevronDown } from 'lucide-react'
import * as XLSX from 'xlsx'

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

interface AbsentPivotRow extends StudentAbsentRow {
  attendance: Record<string, AttendanceStatus | '—'> // meeting_id -> status
}

const STATUS_BG: Record<AttendanceStatus, string> = {
  HADIR: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
  LATE: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
  TIDAK_HADIR: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30',
}

const StatCard = ({ 
  title, 
  value, 
  icon: Icon, 
  gradient,
  subtitle 
}: { 
  title: string
  value: string | number
  icon: React.ElementType
  gradient: string
  subtitle?: string
}) => (
  <Card className="shadow-card hover:shadow-float transition-all duration-300 border-glow overflow-hidden">
    <CardContent className="p-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
          <p className="text-3xl font-bold text-gradient-primary">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={`w-14 h-14 rounded-2xl ${gradient} flex items-center justify-center shadow-lg`}>
          <Icon className="h-7 w-7 text-white" />
        </div>
      </div>
    </CardContent>
  </Card>
)

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
  const [absentPivotRows, setAbsentPivotRows] = useState<AbsentPivotRow[]>([])
  const [absentMeetings, setAbsentMeetings] = useState<Meeting[]>([])
  const [loadingAbsent, setLoadingAbsent] = useState(false)
  const [exportingAbsent, setExportingAbsent] = useState(false)

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

  // Absent more than - connected to Rekap data
  async function handleAbsentFilter() {
    const threshold = parseInt(absentThreshold)
    if (isNaN(threshold) || threshold < 0) return
    setLoadingAbsent(true)

    try {
      // Get active semester
      const { data: activeSemester } = await supabase.from('semesters').select('id').eq('is_active', true).single()
      if (!activeSemester) {
        setAbsentRows([])
        setAbsentPivotRows([])
        setAbsentMeetings([])
        setLoadingAbsent(false)
        return
      }

      // Get all meetings in active semester (same as Rekap)
      const { data: meetings } = await supabase.from('meetings')
        .select('*')
        .eq('semester_id', activeSemester.id)
        .in('status', ['AKTIF', 'DITUTUP'])
        .order('tanggal')

      if (!meetings?.length) {
        setAbsentRows([])
        setAbsentPivotRows([])
        setAbsentMeetings([])
        setLoadingAbsent(false)
        toast.info('Belum ada event di semester aktif')
        return
      }

      setAbsentMeetings(meetings)
      const meetingIds = meetings.map((m: { id: string }) => m.id)

      // Get all students
      const { data: students } = await supabase.from('students')
        .select('id, no_regis, first_name, last_name, major')
        .order('last_name')

      if (!students?.length) {
        setAbsentRows([])
        setAbsentPivotRows([])
        setLoadingAbsent(false)
        return
      }

      // Get all attendances for those meetings
      const { data: attendances } = await supabase.from('attendances')
        .select('student_id, meeting_id, status')
        .in('meeting_id', meetingIds)

      // Build attendance map per student
      const studentAbsenceMap = new Map<string, { 
        student: StudentAbsentRow
        absentCount: number
        attendance: Record<string, AttendanceStatus | '—'>
      }>()

      // Initialize all students with 0 absences
      for (const s of students) {
        const attendance: Record<string, AttendanceStatus | '—'> = {}
        for (const m of meetings) {
          attendance[m.id] = '—'
        }
        studentAbsenceMap.set(s.id, {
          student: {
            student_id: s.id,
            no_regis: s.no_regis,
            first_name: s.first_name,
            last_name: s.last_name,
            major: s.major,
            absent_count: 0,
          },
          absentCount: 0,
          attendance,
        })
      }

      // Fill in actual attendance and count TIDAK_HADIR
      for (const att of attendances ?? []) {
        const entry = studentAbsenceMap.get(att.student_id)
        if (entry) {
          entry.attendance[att.meeting_id] = att.status as AttendanceStatus
          if (att.status === 'TIDAK_HADIR') {
            entry.absentCount += 1
            entry.student.absent_count = entry.absentCount
          }
        }
      }

      // Filter students with absent count > threshold and sort
      const filteredRows = Array.from(studentAbsenceMap.values())
        .filter(entry => entry.absentCount > threshold)
        .sort((a, b) => b.absentCount - a.absentCount)

      setAbsentRows(filteredRows.map(entry => entry.student))
      setAbsentPivotRows(filteredRows.map(entry => ({
        ...entry.student,
        attendance: entry.attendance,
      })))

      if (filteredRows.length === 0) {
        toast.info(`Tidak ada mahasiswa dengan absent > ${threshold}`)
      } else {
        toast.success(`Ditemukan ${filteredRows.length} mahasiswa dengan absent > ${threshold}`)
      }
    } catch (error) {
      console.error('Error fetching absent data:', error)
      toast.error('Gagal mengambil data absent')
      setAbsentRows([])
      setAbsentPivotRows([])
      setAbsentMeetings([])
    } finally {
      setLoadingAbsent(false)
    }
  }

  // Export absent students to Excel
  async function handleExportAbsent(format: 'xlsx' | 'csv') {
    if (!absentPivotRows.length || !absentMeetings.length) return
    setExportingAbsent(true)

    try {
      const headers = ['No. Reg', 'Nama', 'Prodi', 'Total Absent', ...absentMeetings.map(m => `${m.nama_event} (${m.tanggal})`)]
      const rows = absentPivotRows.map(r => [
        r.no_regis,
        `${r.last_name}, ${r.first_name}`,
        r.major,
        r.absent_count,
        ...absentMeetings.map(m => {
          const status = r.attendance[m.id]
          return status === 'HADIR' ? 'H' : status === 'LATE' ? 'L' : status === 'TIDAK_HADIR' ? 'X' : ''
        }),
      ])

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
      ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 20 }, { wch: 12 }, ...absentMeetings.map(() => ({ wch: 14 }))]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Absent Students')
      
      const filename = `Absent_MoreThan_${absentThreshold}_${new Date().toISOString().slice(0, 10)}.${format}`
      XLSX.writeFile(wb, filename, { bookType: format })
      toast.success(`File ${format.toUpperCase()} berhasil diexport!`)
    } catch {
      toast.error('Gagal export.')
    } finally {
      setExportingAbsent(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-gradient-primary">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Ringkasan presensi kuliah umum FILKOM</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Mahasiswa"
          value={summaryStats.totalStudents}
          icon={Users}
          gradient="gradient-blue"
        />
        <StatCard
          title="Total Events"
          value={summaryStats.totalEvents}
          icon={CalendarDays}
          gradient="gradient-purple"
        />
        <StatCard
          title="Rata-rata Hadir"
          value={`${summaryStats.avgAttendance}%`}
          icon={TrendingUp}
          gradient="gradient-green"
        />
        <Card className="shadow-card hover:shadow-float transition-all duration-300 border-glow overflow-hidden">
          <CardContent className="p-5">
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Seating Preview</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg gradient-blue flex items-center justify-center">
                      <span className="text-white text-sm font-bold">♂</span>
                    </div>
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Male</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-blue-700 dark:text-blue-300">{seatingPreview.male.assigned}</span>
                    <span className="text-xs text-blue-600/70 dark:text-blue-400/70"> / {seatingPreview.male.capacity}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-pink-50 dark:bg-pink-950/30">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg gradient-purple flex items-center justify-center">
                      <span className="text-white text-sm font-bold">♀</span>
                    </div>
                    <span className="text-sm font-medium text-pink-700 dark:text-pink-300">Female</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-pink-700 dark:text-pink-300">{seatingPreview.female.assigned}</span>
                    <span className="text-xs text-pink-600/70 dark:text-pink-400/70"> / {seatingPreview.female.capacity}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Trend Chart */}
      <Card className="shadow-card border-glow">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">Attendance Trends</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Statistik kehadiran per event</p>
          </div>
          <Select value={chartFilter} onValueChange={(v) => setChartFilter(v as any)}>
            <SelectTrigger className="w-36 h-9 text-sm">
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
              <div className="text-center space-y-2">
                <BarChart className="h-12 w-12 mx-auto opacity-30" />
                <p>Belum ada data event yang ditutup</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="event" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none',
                    boxShadow: '0 4px 16px -4px rgb(0 0 0 / 0.15)',
                    backgroundColor: 'hsl(var(--card))',
                  }}
                  labelStyle={{ fontWeight: 600, marginBottom: '8px' }}
                />
                <Legend wrapperStyle={{ paddingTop: '12px' }} />
                <Bar dataKey="HADIR" fill="#22c55e" radius={[6, 6, 0, 0]} className="transition-all duration-300" />
                <Bar dataKey="LATE" fill="#eab308" radius={[6, 6, 0, 0]} className="transition-all duration-300" />
                <Bar dataKey="TIDAK_HADIR" fill="#ef4444" radius={[6, 6, 0, 0]} className="transition-all duration-300" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Search & Edit Attendance */}
        <Card className="shadow-card border-glow">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Search className="h-4 w-4 text-blue-500" />
              Cari & Edit Kehadiran
            </CardTitle>
            <p className="text-xs text-muted-foreground">Cari mahasiswa dan edit status kehadiran</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="No. Reg atau nama mahasiswa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="h-11"
              />
              <Button onClick={handleSearch} disabled={searching} size="icon" className="h-11 w-11">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {searchResult && !searchResult.student && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                <p className="text-sm text-red-600 dark:text-red-400 text-center font-medium">Mahasiswa tidak ditemukan.</p>
              </div>
            )}
            {searchResult?.student && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/50 dark:border-blue-800/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full gradient-blue flex items-center justify-center">
                      <span className="text-white font-bold text-sm">
                        {searchResult.student.first_name[0]}{searchResult.student.last_name[0]}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{searchResult.student.last_name}, {searchResult.student.first_name}</p>
                      <p className="text-xs text-muted-foreground">{searchResult.student.no_regis} · {searchResult.student.major}</p>
                    </div>
                  </div>
                </div>
                <div className="max-h-52 overflow-y-auto rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs font-medium">Event</TableHead>
                        <TableHead className="text-xs font-medium">Tanggal</TableHead>
                        <TableHead className="text-xs font-medium text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searchResult.attendances.length === 0 && (
                        <TableRow><TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-4">Belum ada data</TableCell></TableRow>
                      )}
                      {searchResult.attendances.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs py-2 font-medium">{(a as any).meeting?.nama_event ?? '-'}</TableCell>
                          <TableCell className="text-xs py-2 text-muted-foreground">{(a as any).meeting?.tanggal ?? '-'}</TableCell>
                          <TableCell className="py-2">
                            <Select value={a.status} onValueChange={(v) => handleUpdateAttendance(a.id, v as AttendanceStatus)}>
                              <SelectTrigger className={`h-7 text-xs px-2 rounded-full border-0 mx-auto min-w-[100px] ${STATUS_COLORS[a.status]}`}>
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
        <Card className="shadow-card border-glow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  Absent More Than
                </CardTitle>
                <p className="text-xs text-muted-foreground">Cari mahasiswa dengan ketidakhadiran melebihi batas</p>
              </div>
              {absentPivotRows.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    disabled={exportingAbsent}
                    className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-xs hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                  >
                    {exportingAbsent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                    Export
                    <ChevronDown className="h-3 w-3" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleExportAbsent('xlsx')}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />Excel (.xlsx)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportAbsent('csv')}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />CSV (.csv)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
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
                className="h-11"
              />
              <Button onClick={handleAbsentFilter} disabled={loadingAbsent} className="h-11 px-4">
                {loadingAbsent ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cari'}
              </Button>
            </div>

            {absentPivotRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-2">
                  <span>{absentPivotRows.length} mahasiswa dengan absent &gt; {absentThreshold}</span>
                  <span>{absentMeetings.length} event</span>
                </div>
                <div className="overflow-x-auto rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="sticky left-0 bg-muted/50 z-10 font-semibold text-xs w-28">No. Reg</TableHead>
                        <TableHead className="sticky left-28 bg-muted/50 z-10 font-semibold text-xs min-w-44">Nama</TableHead>
                        <TableHead className="font-semibold text-xs min-w-32">Prodi</TableHead>
                        <TableHead className="font-semibold text-xs text-center min-w-20 bg-red-50 dark:bg-red-950/20">Total Absent</TableHead>
                        {absentMeetings.map(m => (
                          <TableHead key={m.id} className="px-2 py-2 text-center font-medium text-xs min-w-24">
                            <div className="truncate max-w-24" title={m.nama_event}>{m.nama_event}</div>
                            <div className="text-muted-foreground font-normal text-[10px]">{m.tanggal}</div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {absentPivotRows.map(row => (
                        <TableRow key={row.student_id} className="hover:bg-muted/30">
                          <TableCell className="sticky left-0 bg-white z-10 text-xs font-mono">{row.no_regis}</TableCell>
                          <TableCell className="sticky left-28 bg-white z-10 text-xs">
                            <div className="font-medium">{row.last_name}, {row.first_name}</div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{row.major}</TableCell>
                          <TableCell className="text-center bg-red-50/50 dark:bg-red-950/10">
                            <Badge variant="destructive" className="text-xs font-semibold shadow-sm">{row.absent_count}×</Badge>
                          </TableCell>
                          {absentMeetings.map(m => {
                            const status = row.attendance[m.id]
                            return (
                              <TableCell key={m.id} className="px-1 py-1 text-center">
                                {status === '—' ? (
                                  <span className="text-gray-300 text-xs">—</span>
                                ) : status === 'TIDAK_HADIR' ? (
                                  <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_BG.TIDAK_HADIR}`}>
                                    X
                                  </span>
                                ) : status === 'LATE' ? (
                                  <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_BG.LATE}`}>
                                    L
                                  </span>
                                ) : (
                                  <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_BG.HADIR}`}>
                                    H
                                  </span>
                                )}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground px-2">
                  <span className="flex items-center gap-1">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_BG.HADIR}`}>H</span> HADIR
                  </span>
                  <span className="flex items-center gap-1">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_BG.LATE}`}>L</span> LATE
                  </span>
                  <span className="flex items-center gap-1">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_BG.TIDAK_HADIR}`}>X</span> TIDAK HADIR
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-gray-300 text-xs">—</span> Tidak ada data
                  </span>
                </div>
              </div>
            )}

            {absentThreshold && absentPivotRows.length === 0 && !loadingAbsent && (
              <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
                <p className="text-sm text-green-600 dark:text-green-400 text-center font-medium">
                  Tidak ada mahasiswa dengan absent &gt; {absentThreshold}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
