'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Download, Filter } from 'lucide-react'
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
  const [filterSearch, setFilterSearch] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    supabase.from('semesters').select('*').eq('is_active', true).single()
      .then(({ data }) => setActiveSemester(data))
  }, [supabase])

  const fetchData = useCallback(async () => {
    if (!activeSemester) return
    setLoading(true)

    let mQuery = supabase.from('meetings').select('*').eq('semester_id', activeSemester.id).eq('status', 'DITUTUP').order('tanggal')
    if (filterType !== 'ALL') mQuery = mQuery.eq('event_type', filterType)
    const { data: mData } = await mQuery
    const filteredMeetings = mData ?? []
    setMeetings(filteredMeetings)

    if (!filteredMeetings.length) { setPivotRows([]); setLoading(false); return }

    const meetingIds = filteredMeetings.map(m => m.id)
    const { data: studs } = await supabase.from('students').select('id, no_regis, first_name, last_name, major').order('last_name')
    const { data: atts } = await supabase.from('attendances').select('student_id, meeting_id, status').in('meeting_id', meetingIds)

    // Build lookup map
    const attMap = new Map<string, AttendanceStatus>()
    for (const a of atts ?? []) {
      attMap.set(`${a.student_id}__${a.meeting_id}`, a.status as AttendanceStatus)
    }

    const rows: PivotRow[] = (studs ?? []).map(s => {
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
  }, [supabase, activeSemester, filterType])

  useEffect(() => { fetchData() }, [fetchData])

  const displayRows = pivotRows.filter(r =>
    !filterSearch || r.no_regis.toLowerCase().includes(filterSearch.toLowerCase()) || r.nama.toLowerCase().includes(filterSearch.toLowerCase()) || r.major.toLowerCase().includes(filterSearch.toLowerCase())
  )

  async function handleExport() {
    setExporting(true)
    try {
      const headers = ['No. Reg', 'Nama', 'Prodi', ...meetings.map(m => `${m.nama_event}\n${m.tanggal}`)]
      const rows = displayRows.map(r => [
        r.no_regis,
        r.nama,
        r.major,
        ...meetings.map(m => {
          const val = r[m.id]
          return val === 'HADIR' ? 'H' : val === 'LATE' ? 'L' : val === 'TIDAK_HADIR' ? 'X' : ''
        }),
      ])

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
      // Column widths
      ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 20 }, ...meetings.map(() => ({ wch: 14 }))]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Rekap Presensi')
      XLSX.writeFile(wb, `Rekap_Presensi_${activeSemester?.nama ?? 'export'}_${new Date().toISOString().slice(0, 10)}.xlsx`)
      toast.success('File Excel berhasil diexport!')
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
        <Button onClick={handleExport} disabled={exporting || !meetings.length}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
          Export Excel
        </Button>
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
              Belum ada event yang ditutup{filterType !== 'ALL' ? ` untuk tipe "${EVENT_TYPE_LABELS[filterType]}"` : ''}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="sticky left-0 bg-muted/50 px-3 py-2 text-left font-medium text-xs w-28">No. Reg</th>
                    <th className="sticky left-28 bg-muted/50 px-3 py-2 text-left font-medium text-xs min-w-44">Nama</th>
                    <th className="px-3 py-2 text-left font-medium text-xs min-w-32">Prodi</th>
                    {meetings.map(m => (
                      <th key={m.id} className="px-2 py-2 text-center font-medium text-xs min-w-24">
                        <div className="truncate max-w-24" title={m.nama_event}>{m.nama_event}</div>
                        <div className="text-muted-foreground font-normal">{m.tanggal}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {displayRows.map(row => (
                    <tr key={row.student_id} className="hover:bg-accent/50">
                      <td className="sticky left-0 bg-white px-3 py-2 text-xs font-mono">{row.no_regis}</td>
                      <td className="sticky left-28 bg-white px-3 py-2 text-xs">{row.nama}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{row.major}</td>
                      {meetings.map(m => {
                        const val = row[m.id] as string
                        const status = val as AttendanceStatus
                        return (
                          <td key={m.id} className="px-2 py-1.5 text-center">
                            {val && val !== '—' ? (
                              <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_BG[status]}`}>
                                {val === 'HADIR' ? 'H' : val === 'LATE' ? 'L' : 'X'}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
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
