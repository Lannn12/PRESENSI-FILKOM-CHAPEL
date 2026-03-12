'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Loader2, Download, Filter, FileSpreadsheet, FileText, FileDown, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import type { Semester, Meeting, AttendanceStatus, EventType } from '@/lib/types'
import { EVENT_TYPE_LABELS, STATUS_LABELS } from '@/lib/types'

interface PivotRow {
  student_id: string
  no_regis: string
  nama: string
  major: string
  [meetingId: string]: string
}

const STATUS_BG: Record<AttendanceStatus, string> = {
  HADIR: 'bg-green-100 text-green-800',
  LATE: 'bg-yellow-100 text-yellow-800',
  TIDAK_HADIR: 'bg-red-100 text-red-800',
}

export default function RekapPage() {
  const supabase = createClient()
  const [activeSemester, setActiveSemester] = useState<Semester | null>(null)
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [pivotRows, setPivotRows] = useState<PivotRow[]>([])
  const [loading, setLoading] = useState(true)

  const [filterType, setFilterType] = useState<'ALL' | EventType>('ALL')
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'AKTIF' | 'DITUTUP'>('ALL')
  const [filterSearch, setFilterSearch] = useState('')
  const [exporting, setExporting] = useState(false)
  const [savingCell, setSavingCell] = useState<string | null>(null) // "studentId__meetingId"

  useEffect(() => {
    supabase.from('semesters').select('*').eq('is_active', true).single()
      .then(({ data }: { data: Semester | null }) => setActiveSemester(data))
  }, [supabase])

  const fetchData = useCallback(async () => {
    if (!activeSemester) return
    setLoading(true)

    let mQuery = supabase.from('meetings').select('*').eq('semester_id', activeSemester.id).in('status', ['AKTIF', 'DITUTUP']).order('tanggal')
    if (filterType !== 'ALL') mQuery = mQuery.eq('event_type', filterType)
    if (filterStatus !== 'ALL') mQuery = mQuery.eq('status', filterStatus)
    const { data: mData } = await mQuery
    const filteredMeetings = mData ?? []
    setMeetings(filteredMeetings)

    if (!filteredMeetings.length) { setPivotRows([]); setLoading(false); return }

    const meetingIds = filteredMeetings.map((m: { id: string }) => m.id)
    const { data: studs } = await supabase.from('students').select('id, no_regis, first_name, last_name, major').order('last_name')
    const { data: atts } = await supabase.from('attendances').select('student_id, meeting_id, status').in('meeting_id', meetingIds)

    // Build lookup map
    const attMap = new Map<string, AttendanceStatus>()
    for (const a of atts ?? []) {
      attMap.set(`${a.student_id}__${a.meeting_id}`, a.status as AttendanceStatus)
    }

    const rows: PivotRow[] = (studs ?? []).map((s: { id: string; no_regis: string; first_name: string; last_name: string; major: string }) => {
      const row: PivotRow = {
        student_id: s.id,
        no_regis: s.no_regis,
        nama: `${s.last_name}, ${s.first_name}`,
        major: s.major,
      }
      for (const m of filteredMeetings) {
        row[m.id] = attMap.get(`${s.id}__${m.id}`) ?? '—'
      }
      return row
    })
    setPivotRows(rows)
    setLoading(false)
  }, [supabase, activeSemester, filterType, filterStatus])

  useEffect(() => { fetchData() }, [fetchData])

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

  // Export helpers
  function getExportData() {
    const headers = ['No. Reg', 'Nama', 'Prodi', ...meetings.map((m: Meeting) => `${m.nama_event} (${m.tanggal})`)]
    const rows = displayRows.map((r: PivotRow) => [
      r.no_regis,
      r.nama,
      r.major,
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
    setExporting(true)
    try {
      const { headers, rows } = getExportData()

      if (format === 'xlsx' || format === 'csv') {
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
        ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 20 }, ...meetings.map(() => ({ wch: 14 }))]
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Rekap Presensi')
        XLSX.writeFile(wb, getFileName(format), { bookType: format })
        toast.success(`File ${format.toUpperCase()} berhasil diexport!`)
      } else if (format === 'pdf') {
        const { default: jsPDF } = await import('jspdf')
        const autoTable = (await import('jspdf-autotable')).default
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
        doc.setFontSize(12)
        doc.text(`Rekap Presensi — ${activeSemester?.nama ?? ''}`, 14, 15)
        doc.setFontSize(8)
        doc.text(`Diekspor: ${new Date().toLocaleDateString('id-ID')}`, 14, 20)
        autoTable(doc, {
          head: [headers],
          body: rows,
          startY: 24,
          styles: { fontSize: 6, cellPadding: 1.5 },
          headStyles: { fillColor: [59, 130, 246], fontSize: 6 },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 35 }, 2: { cellWidth: 25 } },
        })
        doc.save(getFileName('pdf'))
        toast.success('File PDF berhasil diexport!')
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
          <p className="text-sm text-muted-foreground">Rekap presensi semua mahasiswa per event</p>
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
            <SelectItem value="ALL">Semua Status</SelectItem>
            <SelectItem value="AKTIF">Aktif</SelectItem>
            <SelectItem value="DITUTUP">Ditutup</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{displayRows.length} mahasiswa — {meetings.length} event</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : meetings.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Belum ada event yang aktif atau ditutup{filterType !== 'ALL' ? ` untuk tipe "${EVENT_TYPE_LABELS[filterType]}"` : ''}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="sticky left-0 bg-muted/50 px-3 py-2 text-left font-medium text-xs w-28">No. Reg</th>
                    <th className="sticky left-28 bg-muted/50 px-3 py-2 text-left font-medium text-xs min-w-44">Nama</th>
                    <th className="px-3 py-2 text-left font-medium text-xs min-w-32">Prodi</th>
                    {meetings.map((m: Meeting) => (
                      <th key={m.id} className="px-2 py-2 text-center font-medium text-xs min-w-24">
                        <div className="truncate max-w-24" title={m.nama_event}>{m.nama_event}</div>
                        <div className="text-muted-foreground font-normal">{m.tanggal}</div>
                        {m.status === 'AKTIF' && <span className="inline-block mt-0.5 rounded-full bg-green-100 text-green-700 px-1.5 py-0 text-[10px] font-medium">Aktif</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {displayRows.map((row: PivotRow) => (
                    <tr key={row.student_id} className="hover:bg-accent/50">
                      <td className="sticky left-0 bg-white px-3 py-2 text-xs font-mono">{row.no_regis}</td>
                      <td className="sticky left-28 bg-white px-3 py-2 text-xs">{row.nama}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{row.major}</td>
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
      </div>
    </div>
  )
}
