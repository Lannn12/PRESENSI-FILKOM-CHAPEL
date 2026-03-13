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
  <Card className="group relative overflow-hidden border-none shadow-card hover:shadow-float transition-all duration-500 bg-card/50 backdrop-blur-sm">
    <div className={`absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full opacity-10 blur-3xl transition-all duration-500 group-hover:scale-150 ${gradient}`} />
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">{title}</p>
          <p className="text-3xl font-extrabold tracking-tight text-gradient-primary">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground/80 font-medium">{subtitle}</p>}
        </div>
        <div className={`w-14 h-14 rounded-2xl ${gradient} flex items-center justify-center shadow-lg shadow-indigo-500/20 transform transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110`}>
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-4xl font-extrabold tracking-tight text-gradient-primary">Dashboard</h1>
        <p className="text-muted-foreground text-sm font-medium">Selamat datang di sistem manajemen presensi Kuliah Umum FILKOM</p>
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
        <Card className="group relative overflow-hidden border-none shadow-card hover:shadow-float transition-all duration-500 bg-card/50 backdrop-blur-sm">
          <div className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full opacity-10 blur-3xl transition-all duration-500 group-hover:scale-150 gradient-orange" />
          <CardContent className="p-6">
            <div className="space-y-4">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">Seating Preview</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/30 transition-colors hover:bg-blue-100/50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl gradient-blue flex items-center justify-center shadow-sm">
                      <span className="text-white text-xs font-bold">♂</span>
                    </div>
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">Male</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold text-blue-800 dark:text-blue-200">{seatingPreview.male.assigned}</span>
                    <span className="text-xs text-blue-600/60 dark:text-blue-400/60 font-medium"> / {seatingPreview.male.capacity}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-2xl bg-pink-50/50 dark:bg-pink-950/20 border border-pink-100/50 dark:border-pink-900/30 transition-colors hover:bg-pink-100/50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl gradient-purple flex items-center justify-center shadow-sm">
                      <span className="text-white text-xs font-bold">♀</span>
                    </div>
                    <span className="text-sm font-semibold text-pink-700 dark:text-pink-300">Female</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold text-pink-800 dark:text-pink-200">{seatingPreview.female.assigned}</span>
                    <span className="text-xs text-pink-600/60 dark:text-pink-400/60 font-medium"> / {seatingPreview.female.capacity}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Trend Chart */}
      <Card className="border-none shadow-card bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between p-6 pb-2">
          <div>
            <CardTitle className="text-lg font-bold tracking-tight">Attendance Trends</CardTitle>
            <p className="text-sm text-muted-foreground font-medium mt-0.5">Analisis visual kehadiran per event</p>
          </div>
          <Select value={chartFilter} onValueChange={(v) => setChartFilter(v as any)}>
            <SelectTrigger className="w-44 h-10 rounded-xl bg-background/50 border-none shadow-sm font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-none shadow-float">
              <SelectItem value="ALL">Semua Event</SelectItem>
              {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((t) => (
                <SelectItem key={t} value={t}>{EVENT_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-6">
          {loadingChart ? (
            <div className="flex items-center justify-center h-72">
              <Loader2 className="animate-spin h-8 w-8 text-primary/50" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-72 text-muted-foreground">
              <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
                <BarChart className="h-8 w-8 opacity-20" />
              </div>
              <p className="font-medium">Belum ada data event yang ditutup</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/50" />
                <XAxis 
                  dataKey="event" 
                  tick={{ fontSize: 11, fontWeight: 500 }} 
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                  className="fill-muted-foreground" 
                />
                <YAxis 
                  tick={{ fontSize: 11, fontWeight: 500 }} 
                  axisLine={false}
                  tickLine={false}
                  className="fill-muted-foreground" 
                />
                <Tooltip 
                  cursor={{ fill: 'hsl(var(--muted)/0.3)', radius: 8 }}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none',
                    boxShadow: '0 10px 40px -10px rgb(0 0 0 / 0.2)',
                    backgroundColor: 'hsl(var(--card))',
                    padding: '12px'
                  }}
                  itemStyle={{ fontSize: '12px', fontWeight: 600, padding: '2px 0' }}
                  labelStyle={{ fontWeight: 800, marginBottom: '8px', color: 'hsl(var(--foreground))' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '25px', fontSize: '12px', fontWeight: 500 }} />
                <Bar dataKey="HADIR" fill="url(#colorHadir)" radius={[6, 6, 0, 0]} barSize={24} />
                <Bar dataKey="LATE" fill="url(#colorLate)" radius={[6, 6, 0, 0]} barSize={24} />
                <Bar dataKey="TIDAK_HADIR" fill="url(#colorAbsent)" radius={[6, 6, 0, 0]} barSize={24} />
                <defs>
                  <linearGradient id="colorHadir" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#059669" stopOpacity={1}/>
                  </linearGradient>
                  <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#d97706" stopOpacity={1}/>
                  </linearGradient>
                  <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#dc2626" stopOpacity={1}/>
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Search & Edit Attendance */}
        <Card className="border-none shadow-card bg-card/50 backdrop-blur-sm overflow-hidden flex flex-col">
          <CardHeader className="p-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-blue flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Search className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold tracking-tight">Cari & Edit Kehadiran</CardTitle>
                <p className="text-sm text-muted-foreground font-medium">Pencarian cepat status mahasiswa</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0 space-y-5 flex-1">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="No. Reg atau nama..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="h-12 pl-10 rounded-xl bg-background/50 border-none shadow-inner"
                />
              </div>
              <Button onClick={handleSearch} disabled={searching} className="h-12 px-6 rounded-xl gradient-blue shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                {searching ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Cari'}
              </Button>
            </div>
            
            <div className="flex-1 min-h-[300px]">
              {searchResult && !searchResult.student && (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-red-50/30 dark:bg-red-950/10 rounded-3xl border border-red-100/50 dark:border-red-900/20">
                  <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                    <UserCheck className="h-8 w-8 text-red-500 opacity-50" />
                  </div>
                  <p className="text-red-700 dark:text-red-400 font-bold">Mahasiswa tidak ditemukan</p>
                  <p className="text-xs text-red-600/70 dark:text-red-500/70 mt-1">Cek kembali nomor registrasi atau ejaan nama</p>
                </div>
              )}
              
              {!searchResult && (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground opacity-50">
                  <div className="w-16 h-16 rounded-3xl bg-muted/50 flex items-center justify-center mb-4">
                    <Users className="h-8 w-8" />
                  </div>
                  <p className="text-sm font-medium">Mulai dengan mencari nama atau No. Reg</p>
                </div>
              )}

              {searchResult?.student && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className="p-5 rounded-3xl bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/10 border border-blue-200/20 dark:border-blue-800/20 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 gradient-blue opacity-5 blur-2xl group-hover:opacity-10 transition-opacity" />
                    <div className="flex items-center gap-4 relative">
                      <div className="w-14 h-14 rounded-2xl gradient-blue flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <span className="text-white font-extrabold text-xl">
                          {searchResult.student.first_name[0]}{searchResult.student.last_name[0]}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="font-extrabold text-lg tracking-tight">{searchResult.student.last_name}, {searchResult.student.first_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="bg-blue-100/50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-none font-bold text-[10px] tracking-wider uppercase">{searchResult.student.no_regis}</Badge>
                          <span className="text-xs text-muted-foreground font-medium">·</span>
                          <span className="text-xs text-muted-foreground font-medium">{searchResult.student.major}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-muted/50 overflow-hidden bg-background/30 backdrop-blur-sm">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30 border-none">
                          <TableHead className="text-[10px] font-bold uppercase tracking-widest h-10">Event</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-widest h-10 text-center">Status Kehadiran</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchResult.attendances.length === 0 && (
                          <TableRow><TableCell colSpan={2} className="text-center text-xs text-muted-foreground py-10 font-medium">Belum ada riwayat kehadiran</TableCell></TableRow>
                        )}
                        {searchResult.attendances.map((a) => (
                          <TableRow key={a.id} className="hover:bg-muted/20 border-muted/30">
                            <TableCell className="py-3.5">
                              <p className="text-sm font-bold tracking-tight">{(a as any).meeting?.nama_event ?? '-'}</p>
                              <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">{(a as any).meeting?.tanggal ?? '-'}</p>
                            </TableCell>
                            <TableCell className="py-3.5 text-center">
                              <Select value={a.status} onValueChange={(v) => handleUpdateAttendance(a.id, v as AttendanceStatus)}>
                                <SelectTrigger className={`h-8 text-[11px] font-bold px-3 rounded-full border-none shadow-sm mx-auto min-w-[110px] ${STATUS_COLORS[a.status]}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-none shadow-float">
                                  {(['HADIR', 'LATE', 'TIDAK_HADIR'] as AttendanceStatus[]).map((s) => (
                                    <SelectItem key={s} value={s} className="text-xs font-semibold">{STATUS_LABELS[s]}</SelectItem>
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
            </div>
          </CardContent>
        </Card>

        {/* Absent More Than */}
        <Card className="border-none shadow-card bg-card/50 backdrop-blur-sm overflow-hidden flex flex-col">
          <CardHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl gradient-red flex items-center justify-center shadow-lg shadow-red-500/20">
                  <XCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold tracking-tight">Batas Ketidakhadiran</CardTitle>
                  <p className="text-sm text-muted-foreground font-medium">Pantau mahasiswa yang sering absen</p>
                </div>
              </div>
              {absentPivotRows.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-xl border-none bg-background/50 shadow-sm hover:scale-[1.02] active:scale-[0.98]">
                      {exportingAbsent ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />}
                      Export
                      <ChevronDown className="h-3 w-3 ml-2 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl border-none shadow-float min-w-[160px]">
                    <DropdownMenuItem onClick={() => handleExportAbsent('xlsx')} className="py-2.5 font-medium">
                      <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />Excel (.xlsx)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportAbsent('csv')} className="py-2.5 font-medium">
                      <FileSpreadsheet className="h-4 w-4 mr-2 text-blue-600" />CSV (.csv)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0 space-y-5 flex-1">
            <div className="flex gap-3">
              <Input
                type="number"
                min={0}
                placeholder="Contoh: 3 kali absen"
                value={absentThreshold}
                onChange={(e) => setAbsentThreshold(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAbsentFilter()}
                className="h-12 rounded-xl bg-background/50 border-none shadow-inner"
              />
              <Button onClick={handleAbsentFilter} disabled={loadingAbsent} className="h-12 px-6 rounded-xl gradient-red shadow-lg shadow-red-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                {loadingAbsent ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Cari'}
              </Button>
            </div>

            <div className="flex-1 min-h-[300px]">
              {absentPivotRows.length > 0 && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between px-2">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Terdeteksi <span className="text-red-500">{absentPivotRows.length} Mahasiswa</span>
                    </p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      {absentMeetings.length} Total Event
                    </p>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-muted/50 bg-background/30 backdrop-blur-sm">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30 hover:bg-muted/30 border-none">
                            <TableHead className="sticky left-0 bg-muted/30 z-20 text-[10px] font-extrabold uppercase tracking-widest h-10 w-28">No. Reg</TableHead>
                            <TableHead className="sticky left-28 bg-muted/30 z-20 text-[10px] font-extrabold uppercase tracking-widest h-10 min-w-[180px]">Nama Mahasiswa</TableHead>
                            <TableHead className="text-[10px] font-extrabold uppercase tracking-widest h-10 text-center bg-red-500/10 dark:bg-red-950/20 text-red-600 dark:text-red-400 min-w-[100px]">Total</TableHead>
                            {absentMeetings.map(m => (
                              <TableHead key={m.id} className="px-3 text-center h-10 min-w-[100px]">
                                <p className="text-[10px] font-bold truncate max-w-[80px] mx-auto" title={m.nama_event}>{m.nama_event}</p>
                                <p className="text-[9px] text-muted-foreground font-medium">{m.tanggal}</p>
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {absentPivotRows.map(row => (
                            <TableRow key={row.student_id} className="hover:bg-muted/20 border-muted/30 group">
                              <TableCell className="sticky left-0 bg-card/90 backdrop-blur-md z-10 text-xs font-bold font-mono py-4 group-hover:bg-muted/10">{row.no_regis}</TableCell>
                              <TableCell className="sticky left-28 bg-card/90 backdrop-blur-md z-10 py-4 group-hover:bg-muted/10">
                                <p className="text-sm font-bold tracking-tight">{row.last_name}, {row.first_name}</p>
                                <p className="text-[10px] text-muted-foreground font-medium">{row.major}</p>
                              </TableCell>
                              <TableCell className="text-center bg-red-500/5 dark:bg-red-950/5 py-4">
                                <Badge className="bg-red-500 hover:bg-red-600 text-white border-none font-bold px-2 py-0.5 shadow-sm shadow-red-500/20">{row.absent_count}×</Badge>
                              </TableCell>
                              {absentMeetings.map(m => {
                                const status = row.attendance[m.id]
                                return (
                                  <TableCell key={m.id} className="px-2 py-4 text-center">
                                    {status === '—' ? (
                                      <span className="text-muted-foreground/30 font-bold text-xs">—</span>
                                    ) : (
                                      <div className={cn(
                                        "w-7 h-7 rounded-lg flex items-center justify-center mx-auto text-[11px] font-extrabold shadow-sm transition-transform hover:scale-110",
                                        status === 'TIDAK_HADIR' ? "gradient-red text-white" : 
                                        status === 'LATE' ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" : 
                                        "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                      )}>
                                        {status === 'TIDAK_HADIR' ? 'X' : status === 'LATE' ? 'L' : 'H'}
                                      </div>
                                    )}
                                  </TableCell>
                                )
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 text-[10px] font-bold text-muted-foreground px-2 pt-2 uppercase tracking-widest opacity-80">
                    <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-emerald-100 flex items-center justify-center text-emerald-700">H</span> HADIR</span>
                    <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-amber-100 flex items-center justify-center text-amber-700">L</span> LATE</span>
                    <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded gradient-red flex items-center justify-center text-white">X</span> TIDAK HADIR</span>
                    <span className="flex items-center gap-1.5"><span className="w-4 h-4 text-center">—</span> TIDAK ADA DATA</span>
                  </div>
                </div>
              )}

              {absentThreshold && absentPivotRows.length === 0 && !loadingAbsent && (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-emerald-50/30 dark:bg-emerald-950/10 rounded-3xl border border-emerald-100/50 dark:border-emerald-900/20">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                    <UserCheck className="h-8 w-8 text-emerald-500 opacity-50" />
                  </div>
                  <p className="text-emerald-700 dark:text-emerald-400 font-bold">Semua Aman!</p>
                  <p className="text-xs text-emerald-600/70 dark:text-emerald-500/70 mt-1">Tidak ada mahasiswa yang melebihi batas absen {absentThreshold}</p>
                </div>
              )}

              {!absentPivotRows.length && !absentThreshold && (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground opacity-50">
                  <div className="w-16 h-16 rounded-3xl bg-muted/50 flex items-center justify-center mb-4">
                    <XCircle className="h-8 w-8" />
                  </div>
                  <p className="text-sm font-medium">Cek mahasiswa bermasalah dengan batas absen</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
