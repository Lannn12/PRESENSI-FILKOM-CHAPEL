'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Loader2, Download, Filter, FileSpreadsheet, FileText, FileDown, ChevronDown, UserX } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import type { Semester, Meeting, AttendanceStatus, EventType, StudentStatus } from '@/lib/types'
import { EVENT_TYPE_LABELS, STATUS_LABELS, STUDENT_STATUS_LABELS } from '@/lib/types'

interface PivotRow {
  student_id: string
  no_regis: string
  nama: string
  major: string
  student_status: StudentStatus
  [meetingId: string]: string
}

interface AttendanceLite {
  student_id: string
  meeting_id: string
  status: AttendanceStatus
}

const STATUS_BG: Record<AttendanceStatus, string> = {
  HADIR: 'bg-green-100 text-green-800',
  LATE: 'bg-yellow-100 text-yellow-800',
  TIDAK_HADIR: 'bg-red-100 text-red-800',
}

const PAGE_SIZE = 1000
const ID_CHUNK = 150

async function fetchAllAttendances(
  supabase: ReturnType<typeof createClient>,
  meetingIds: string[],
): Promise<AttendanceLite[]> {
  const all: AttendanceLite[] = []
  // Chunk meeting ids too — long IN lists can break PostgREST
  for (let i = 0; i < meetingIds.length; i += 50) {
    const chunk = meetingIds.slice(i, i + 50)
    let from = 0
    for (;;) {
      const { data, error } = await supabase
        .from('attendances')
        .select('student_id, meeting_id, status')
        .in('meeting_id', chunk)
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw error
      const rows = (data ?? []) as AttendanceLite[]
      all.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }
  return all
}

async function fetchStudentsByIds(
  supabase: ReturnType<typeof createClient>,
  studentIds: string[],
) {
  const studs: {
    id: string
    no_regis: string
    first_name: string
    last_name: string
    major: string
    status: StudentStatus
  }[] = []

  for (let i = 0; i < studentIds.length; i += ID_CHUNK) {
    const chunk = studentIds.slice(i, i + ID_CHUNK)
    const { data, error } = await supabase
      .from('students')
      .select('id, no_regis, first_name, last_name, major, status')
      .in('id', chunk)
      .order('last_name')
    if (error) throw error
    studs.push(...(data ?? []))
  }

  // Keep consistent A–Z by last_name across chunks
  studs.sort((a, b) => {
    const byLast = a.last_name.localeCompare(b.last_name, 'id', { sensitivity: 'base' })
    if (byLast !== 0) return byLast
    return a.first_name.localeCompare(b.first_name, 'id', { sensitivity: 'base' })
  })
  return studs
}

export default function RekapPage() {
  const supabase = createClient()
  const [activeSemester, setActiveSemester] = useState<Semester | null>(null)
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [pivotRows, setPivotRows] = useState<PivotRow[]>([])
  const [loading, setLoading] = useState(true)

  // Default: fokus event yang sudah ditutup agar status lengkap (H/L/X) langsung terlihat
  const [filterType, setFilterType] = useState<'ALL' | EventType>('ALL')
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'AKTIF' | 'DITUTUP' | 'ARCHIVED' | 'SEMUA'>('DITUTUP')
  const [filterSearch, setFilterSearch] = useState('')
  const [showAllStudents, setShowAllStudents] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [savingCell, setSavingCell] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<{ totalMeetings: number; filteredMeetings: number } | null>(null)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchGeneration = useRef(0)

  // Bulk mark kosong → TIDAK_HADIR
  // confirmTarget: { type: 'meeting', id, label } | { type: 'student', id, nama }
  const [confirmTarget, setConfirmTarget] = useState<
    | { type: 'meeting'; id: string; label: string }
    | { type: 'student'; id: string; nama: string }
    | null
  >(null)
  const [bulkSaving, setBulkSaving] = useState(false)

  useEffect(() => {
    supabase.from('semesters').select('*').eq('is_active', true).single()
      .then(({ data }: { data: Semester | null }) => setActiveSemester(data))
  }, [supabase])

  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!activeSemester) return
    const gen = ++fetchGeneration.current
    if (!opts?.silent) setLoading(true)

    try {
      const { count: totalMeetingsCount } = await supabase
        .from('meetings')
        .select('*', { count: 'exact', head: true })
        .eq('semester_id', activeSemester.id)

      let mQuery = supabase.from('meetings').select('*').eq('semester_id', activeSemester.id).order('tanggal')

      if (filterStatus === 'ALL') {
        mQuery = mQuery.in('status', ['AKTIF', 'DITUTUP'])
      } else if (filterStatus === 'SEMUA') {
        // no status filter
      } else {
        mQuery = mQuery.eq('status', filterStatus)
      }

      if (filterType !== 'ALL') mQuery = mQuery.eq('event_type', filterType)
      const { data: mData } = await mQuery
      if (gen !== fetchGeneration.current) return

      const filteredMeetings = mData ?? []
      setMeetings(filteredMeetings)
      setDebugInfo({
        totalMeetings: totalMeetingsCount ?? 0,
        filteredMeetings: filteredMeetings.length,
      })

      if (!filteredMeetings.length) {
        setPivotRows([])
        return
      }

      const meetingIds = filteredMeetings.map((m: { id: string }) => m.id)
      const atts = await fetchAllAttendances(supabase, meetingIds)
      if (gen !== fetchGeneration.current) return

      const attMap = new Map<string, AttendanceStatus>()
      for (const a of atts) {
        attMap.set(`${a.student_id}__${a.meeting_id}`, a.status)
      }

      let studs: Awaited<ReturnType<typeof fetchStudentsByIds>> = []

      if (showAllStudents) {
        const { data: allStudents } = await supabase
          .from('students')
          .select('id, no_regis, first_name, last_name, major, status')
          .order('last_name')
        studs = allStudents ?? []
      } else {
        const uniqueStudentIds = [...new Set(atts.map(a => a.student_id))]
        if (uniqueStudentIds.length === 0) {
          setPivotRows([])
          return
        }
        studs = await fetchStudentsByIds(supabase, uniqueStudentIds)
      }

      if (gen !== fetchGeneration.current) return

      const rows: PivotRow[] = studs.map(s => {
        const row: PivotRow = {
          student_id: s.id,
          no_regis: s.no_regis,
          nama: `${s.last_name}, ${s.first_name}`,
          major: s.major,
          student_status: s.status,
        }
        for (const m of filteredMeetings) {
          row[m.id] = attMap.get(`${s.id}__${m.id}`) ?? '—'
        }
        return row
      })
      setPivotRows(rows)
    } catch (e: unknown) {
      toast.error('Gagal memuat rekap: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      if (gen === fetchGeneration.current) setLoading(false)
    }
  }, [supabase, activeSemester, filterType, filterStatus, showAllStudents])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh saat event ditutup / attendance di-generate (TIDAK_HADIR)
  useEffect(() => {
    if (!activeSemester) return

    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      // Debounce: close meeting insert banyak baris sekaligus
      refreshTimer.current = setTimeout(() => {
        fetchData({ silent: true })
      }, 600)
    }

    const channel = supabase
      .channel(`rekap-live-${activeSemester.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendances' },
        scheduleRefresh,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'meetings' },
        scheduleRefresh,
      )
      .subscribe()

    const onFocus = () => scheduleRefresh()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') scheduleRefresh()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      supabase.removeChannel(channel)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [supabase, activeSemester, fetchData])

  const displayRows = pivotRows.filter((r: PivotRow) =>
    !filterSearch || r.no_regis.toLowerCase().includes(filterSearch.toLowerCase()) || r.nama.toLowerCase().includes(filterSearch.toLowerCase()) || r.major.toLowerCase().includes(filterSearch.toLowerCase())
  )

  // Inline edit: update attendance status
  async function updateAttendance(studentId: string, meetingId: string, newStatus: AttendanceStatus | 'HAPUS') {
    const cellKey = `${studentId}__${meetingId}`
    setSavingCell(cellKey)
    try {
      if (newStatus === 'HAPUS') {
        const { error } = await supabase
          .from('attendances')
          .delete()
          .eq('student_id', studentId)
          .eq('meeting_id', meetingId)
        if (error) throw error
        setPivotRows(prev => prev.map((r: PivotRow) =>
          r.student_id === studentId ? { ...r, [meetingId]: '—' } : r
        ))
        toast.success('Status dihapus')
      } else {
        // Upsert: try update first, if no rows updated then insert
        const { data: existing } = await supabase
          .from('attendances')
          .select('id')
          .eq('student_id', studentId)
          .eq('meeting_id', meetingId)
          .single()

        if (existing) {
          const { error } = await supabase
            .from('attendances')
            .update({ status: newStatus })
            .eq('student_id', studentId)
            .eq('meeting_id', meetingId)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('attendances')
            .insert({ student_id: studentId, meeting_id: meetingId, status: newStatus })
          if (error) throw error
        }

        setPivotRows(prev => prev.map((r: PivotRow) =>
          r.student_id === studentId ? { ...r, [meetingId]: newStatus } : r
        ))
        toast.success(`Status diubah ke ${STATUS_LABELS[newStatus]}`)
      }
    } catch (e: unknown) {
      toast.error('Gagal update: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSavingCell(null)
    }
  }

  // Bulk: tandai semua "—" di satu kolom event sebagai TIDAK_HADIR
  async function handleBulkMarkAbsent() {
    if (!confirmTarget) return
    setBulkSaving(true)

    try {
      let inserts: { student_id: string; meeting_id: string; status: string }[] = []

      if (confirmTarget.type === 'meeting') {
        // Semua baris yang nilai di kolom ini masih "—"
        inserts = pivotRows
          .filter(r => r[confirmTarget.id] === '—')
          .map(r => ({ student_id: r.student_id, meeting_id: confirmTarget.id, status: 'TIDAK_HADIR' }))
      } else {
        // Semua kolom meeting di baris mahasiswa ini yang masih "—"
        const row = pivotRows.find(r => r.student_id === confirmTarget.id)
        if (row) {
          inserts = meetings
            .filter(m => row[m.id] === '—')
            .map(m => ({ student_id: confirmTarget.id, meeting_id: m.id, status: 'TIDAK_HADIR' }))
        }
      }

      if (inserts.length === 0) {
        toast.info('Tidak ada status kosong untuk diubah.')
        setConfirmTarget(null)
        setBulkSaving(false)
        return
      }

      // Insert in chunks of 200
      const CHUNK = 200
      for (let i = 0; i < inserts.length; i += CHUNK) {
        const { error } = await supabase
          .from('attendances')
          .insert(inserts.slice(i, i + CHUNK))
        if (error) throw error
      }

      // Update local state tanpa refetch
      setPivotRows(prev => prev.map(r => {
        if (confirmTarget.type === 'meeting') {
          if (r[confirmTarget.id] !== '—') return r
          return { ...r, [confirmTarget.id]: 'TIDAK_HADIR' }
        } else {
          if (r.student_id !== confirmTarget.id) return r
          const updated = { ...r }
          for (const m of meetings) {
            if (updated[m.id] === '—') updated[m.id] = 'TIDAK_HADIR'
          }
          return updated
        }
      }))

      toast.success(`${inserts.length} status berhasil diubah ke Tidak Hadir.`)
    } catch (e: unknown) {
      toast.error('Gagal: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setBulkSaving(false)
      setConfirmTarget(null)
    }
  }

  // Export helpers — selalu export pivotRows (semua data), bukan displayRows yang sudah difilter search
  function getExportData(sourceRows: PivotRow[] = pivotRows) {
    const headers = ['No. Reg', 'Nama', 'Prodi', 'Status', ...meetings.map((m: Meeting) => `${m.nama_event} (${m.tanggal})`)]
    const rows = sourceRows.map((r: PivotRow) => [
      r.no_regis,
      r.nama,
      r.major,
      STUDENT_STATUS_LABELS[r.student_status] ?? r.student_status,
      ...meetings.map((m: Meeting) => {
        const val = r[m.id]
        return val === 'HADIR' ? 'H' : val === 'LATE' ? 'L' : val === 'TIDAK_HADIR' ? 'X' : ''
      }),
    ])
    return { headers, rows }
  }

  function getFileName(ext: string) {
    return `Rekap_Presensi_${activeSemester?.nama ?? 'export'}_${new Date().toISOString().slice(0, 10)}.${ext}`
  }

  async function handleExport(format: 'xlsx' | 'csv' | 'pdf') {
    // Jika search filter aktif, export semua data (pivotRows), bukan hanya yang terfilter
    const isSearchActive = filterSearch.trim().length > 0
    const exportRows = pivotRows // selalu semua data
    if (isSearchActive) {
      toast.info(`Mengexport semua ${pivotRows.length} mahasiswa (filter pencarian diabaikan saat export).`, { duration: 4000 })
    }

    setExporting(true)
    try {
      const { headers, rows } = getExportData(exportRows)

      if (format === 'xlsx' || format === 'csv') {
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
        ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 20 }, { wch: 12 }, ...meetings.map(() => ({ wch: 14 }))]
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Rekap Presensi')
        XLSX.writeFile(wb, getFileName(format), { bookType: format })
        toast.success(`File ${format.toUpperCase()} berhasil diexport! (${rows.length} mahasiswa)`)
      } else if (format === 'pdf') {
        const { default: jsPDF } = await import('jspdf')
        const autoTable = (await import('jspdf-autotable')).default
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
        doc.setFontSize(12)
        doc.text(`Rekap Presensi — ${activeSemester?.nama ?? ''}`, 14, 15)
        doc.setFontSize(8)
        doc.text(`Diekspor: ${new Date().toLocaleDateString('id-ID')} · ${rows.length} mahasiswa`, 14, 20)
        autoTable(doc, {
          head: [headers],
          body: rows,
          startY: 24,
          styles: { fontSize: 6, cellPadding: 1.5 },
          headStyles: { fillColor: [59, 130, 246], fontSize: 6 },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 35 }, 2: { cellWidth: 25 }, 3: { cellWidth: 18 } },
        })
        doc.save(getFileName('pdf'))
        toast.success(`File PDF berhasil diexport! (${rows.length} mahasiswa)`)
      }
    } catch {
      toast.error('Gagal export.')
    }
    setExporting(false)
  }

  if (!activeSemester) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Rekap & Export</h1>
        <Card><CardContent className="py-10 text-center text-muted-foreground">Tidak ada semester aktif.</CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rekap & Export</h1>
          <p className="text-sm text-muted-foreground">
            Rekap otomatis terbarui setelah event ditutup (status Hadir / Late / Tidak Hadir).
          </p>
          {debugInfo && debugInfo.totalMeetings > debugInfo.filteredMeetings && (
            <p className="text-xs text-orange-600 font-medium mt-1">
              ⚠️ Menampilkan {debugInfo.filteredMeetings} dari {debugInfo.totalMeetings} event. Beberapa event tersembunyi karena filter status.
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={exporting || !meetings.length}
            className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export
            <ChevronDown className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport('xlsx')}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('csv')}>
              <FileText className="h-4 w-4 mr-2" />CSV (.csv)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('pdf')}>
              <FileDown className="h-4 w-4 mr-2" />PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Input placeholder="Cari mahasiswa / prodi..." value={filterSearch} onChange={e => setFilterSearch(e.target.value)} className="pl-8" />
          <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        </div>
        <Select value={filterType} onValueChange={v => setFilterType(v as any)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Tipe</SelectItem>
            {(Object.entries(EVENT_TYPE_LABELS) as [EventType, string][]).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={v => setFilterStatus(v as any)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Aktif & Ditutup</SelectItem>
            <SelectItem value="AKTIF">Aktif</SelectItem>
            <SelectItem value="DITUTUP">Ditutup (lengkap)</SelectItem>
            <SelectItem value="ARCHIVED">Arsip</SelectItem>
            <SelectItem value="SEMUA">🔍 Semua (termasuk Draft)</SelectItem>
          </SelectContent>
        </Select>
        
        {/* Toggle: Tampilkan Semua Mahasiswa */}
        <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-background">
          <Switch 
            id="show-all-students" 
            checked={showAllStudents} 
            onCheckedChange={setShowAllStudents}
          />
          <Label htmlFor="show-all-students" className="text-sm cursor-pointer whitespace-nowrap">
            Tampilkan semua mahasiswa
          </Label>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{displayRows.length} mahasiswa — {meetings.length} event</CardTitle>
          <p className="text-xs text-muted-foreground">
            {showAllStudents 
              ? 'Menampilkan semua mahasiswa (termasuk yang tidak pernah hadir)'
              : 'Hanya menampilkan mahasiswa yang memiliki data kehadiran di event yang dipilih'
            }
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : meetings.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Belum ada event untuk filter ini{filterType !== 'ALL' ? ` (tipe "${EVENT_TYPE_LABELS[filterType]}")` : ''}.
              {filterStatus === 'DITUTUP' && (
                <p className="text-xs mt-2">Tutup event di monitor presensi agar status lengkap muncul di sini.</p>
              )}
            </div>
          ) : displayRows.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              <p className="font-medium">Tidak ada data kehadiran untuk ditampilkan.</p>
              <p className="text-xs mt-2">Setelah event ditutup, status Hadir / Late / Tidak Hadir akan muncul otomatis.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="sticky left-0 bg-muted/50 px-3 py-2 text-left font-medium text-xs w-28">No. Reg</th>
                    <th className="sticky left-28 bg-muted/50 px-3 py-2 text-left font-medium text-xs min-w-44">Nama</th>
                    <th className="px-3 py-2 text-left font-medium text-xs min-w-32">Prodi</th>
                    <th className="px-3 py-2 text-center font-medium text-xs min-w-20">Status</th>
                    {meetings.map((m: Meeting) => {
                      // Hitung berapa "—" di kolom ini
                      const emptyCount = pivotRows.filter(r => r[m.id] === '—').length
                      return (
                        <th key={m.id} className="px-2 py-2 text-center font-medium text-xs min-w-24">
                          <div className="truncate max-w-24" title={m.nama_event}>{m.nama_event}</div>
                          <div className="text-muted-foreground font-normal">{m.tanggal}</div>
                          {m.status === 'AKTIF' && <span className="inline-block mt-0.5 rounded-full bg-green-100 text-green-700 px-1.5 py-0 text-[10px] font-medium">Aktif</span>}
                          {m.status === 'DITUTUP' && <span className="inline-block mt-0.5 rounded-full bg-blue-100 text-blue-700 px-1.5 py-0 text-[10px] font-medium">Ditutup</span>}
                          {/* Tombol bulk mark per kolom event */}
                          {emptyCount > 0 && (
                            <button
                              onClick={() => setConfirmTarget({ type: 'meeting', id: m.id, label: m.nama_event })}
                              className="mt-1 flex items-center gap-0.5 mx-auto rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors"
                              title={`Tandai ${emptyCount} yang kosong sebagai Tidak Hadir`}
                            >
                              <UserX className="h-2.5 w-2.5" />
                              {emptyCount} kosong → X
                            </button>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {displayRows.map((row: PivotRow) => (
                    <tr key={row.student_id} className="hover:bg-accent/50">
                      <td className="sticky left-0 bg-white px-3 py-2 text-xs font-mono">{row.no_regis}</td>
                      <td className="sticky left-28 bg-white px-3 py-2 text-xs">{row.nama}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{row.major}</td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${row.student_status === 'MAGANG' ? 'bg-orange-100 text-orange-800 border-orange-500/30' : 'bg-green-100 text-green-800 border-green-500/30'}`}>
                          {row.student_status === 'MAGANG' ? '🏢 Magang' : 'Aktif'}
                        </Badge>
                        {/* Tombol bulk mark per baris mahasiswa */}
                        {meetings.some(m => row[m.id] === '—') && (
                          <button
                            onClick={() => setConfirmTarget({ type: 'student', id: row.student_id, nama: row.nama })}
                            className="mt-1 flex items-center gap-0.5 mx-auto rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors"
                            title="Tandai semua yang kosong sebagai Tidak Hadir"
                          >
                            <UserX className="h-2.5 w-2.5" />
                            Isi kosong → X
                          </button>
                        )}
                      </td>
                      {meetings.map((m: Meeting) => {
                        const val = row[m.id] as string
                        const status = val as AttendanceStatus
                        const cellKey = `${row.student_id}__${m.id}`
                        const isSaving = savingCell === cellKey
                        return (
                          <td key={m.id} className="px-1 py-1 text-center">
                            {isSaving ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-muted-foreground" />
                            ) : (
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  className="rounded px-1.5 py-0.5 text-xs font-medium cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50"
                                  title="Klik untuk edit status"
                                >
                                    {val && val !== '—' ? (
                                      <span className={`inline-block rounded px-1.5 py-0.5 ${STATUS_BG[status]}`}>
                                        {val === 'HADIR' ? 'H' : val === 'LATE' ? 'L' : 'X'}
                                      </span>
                                    ) : (
                                      <span className="text-gray-300 text-xs hover:text-gray-500">—</span>
                                    )}
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="center" className="min-w-28">
                                  <DropdownMenuItem onClick={() => updateAttendance(row.student_id, m.id, 'HADIR')} disabled={val === 'HADIR'}>
                                    <span className="inline-block rounded px-1.5 py-0.5 bg-green-100 text-green-800 text-xs font-medium mr-2">H</span> Hadir
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateAttendance(row.student_id, m.id, 'LATE')} disabled={val === 'LATE'}>
                                    <span className="inline-block rounded px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium mr-2">L</span> Late
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateAttendance(row.student_id, m.id, 'TIDAK_HADIR')} disabled={val === 'TIDAK_HADIR'}>
                                    <span className="inline-block rounded px-1.5 py-0.5 bg-red-100 text-red-800 text-xs font-medium mr-2">X</span> Tidak Hadir
                                  </DropdownMenuItem>
                                  {val && val !== '—' && (
                                    <DropdownMenuItem onClick={() => updateAttendance(row.student_id, m.id, 'HAPUS')} className="text-muted-foreground">
                                      <span className="mr-2">🗑</span> Hapus
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block rounded px-1.5 py-0.5 bg-green-100 text-green-800 font-medium">H</span> HADIR</span>
        <span className="flex items-center gap-1"><span className="inline-block rounded px-1.5 py-0.5 bg-yellow-100 text-yellow-800 font-medium">L</span> LATE</span>
        <span className="flex items-center gap-1"><span className="inline-block rounded px-1.5 py-0.5 bg-red-100 text-red-800 font-medium">X</span> TIDAK HADIR</span>
        <span className="flex items-center gap-1 text-red-400"><UserX className="h-3 w-3" /> tombol merah = isi status kosong (—) → Tidak Hadir</span>
      </div>

      {/* Dialog konfirmasi bulk mark */}
      <Dialog open={!!confirmTarget} onOpenChange={(open) => { if (!open && !bulkSaving) setConfirmTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-red-500" />
              Tandai Kosong sebagai Tidak Hadir?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            {confirmTarget?.type === 'meeting' ? (
              <p>
                Semua mahasiswa yang statusnya <strong>kosong (—)</strong> di event{' '}
                <strong className="text-foreground">"{confirmTarget.label}"</strong> akan diubah menjadi{' '}
                <span className="inline-block rounded px-1.5 py-0.5 bg-red-100 text-red-800 text-xs font-medium">X Tidak Hadir</span>.
              </p>
            ) : (
              <p>
                Semua event yang statusnya <strong>kosong (—)</strong> untuk mahasiswa{' '}
                <strong className="text-foreground">"{confirmTarget?.nama}"</strong> akan diubah menjadi{' '}
                <span className="inline-block rounded px-1.5 py-0.5 bg-red-100 text-red-800 text-xs font-medium">X Tidak Hadir</span>.
              </p>
            )}
            <p className="text-xs">Status yang sudah terisi (H / L / X) tidak akan terpengaruh.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmTarget(null)} disabled={bulkSaving}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleBulkMarkAbsent} disabled={bulkSaving}>
              {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserX className="h-4 w-4 mr-1" />}
              Ya, Tandai Tidak Hadir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
