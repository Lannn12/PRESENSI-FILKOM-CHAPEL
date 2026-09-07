'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, XCircle, Users, Lock, Download, FileSpreadsheet } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/types'
import type { Meeting, AttendanceStatus } from '@/lib/types'
import * as XLSX from 'xlsx'
import React from 'react'
import { useRouter } from 'next/navigation'

interface AttendanceRow {
  id: string
  status: AttendanceStatus
  waktu_scan: string | null
  student: { no_regis: string; first_name: string; last_name: string; major: string }
}

// Mahasiswa terdaftar yang belum scan sama sekali (tidak ada record attendance)
interface EnrolledStudent {
  id: string
  no_regis: string
  first_name: string
  last_name: string
  major: string
}

type ListFilter = 'SCAN' | 'ALL' | 'HADIR' | 'TIDAK_HADIR' | 'BELUM_SCAN'

function studentName(s: { first_name: string; last_name: string }) {
  return `${s.last_name}, ${s.first_name}`
}

/** Urutkan seperti data mahasiswa di sistem: last_name → first_name → no_regis */
function compareByStudentName(a: AttendanceRow, b: AttendanceRow) {
  const byLast = a.student.last_name.localeCompare(b.student.last_name, 'id', { sensitivity: 'base' })
  if (byLast !== 0) return byLast
  const byFirst = a.student.first_name.localeCompare(b.student.first_name, 'id', { sensitivity: 'base' })
  if (byFirst !== 0) return byFirst
  return a.student.no_regis.localeCompare(b.student.no_regis, 'id')
}

function sortByStudentName(rows: AttendanceRow[]) {
  return [...rows].sort(compareByStudentName)
}

function formatScanTime(waktu: string | null) {
  return waktu ? new Date(waktu).toLocaleTimeString('id-ID') : '—'
}

function toExportRows(rows: AttendanceRow[]) {
  return rows.map((a, i) => ({
    No: i + 1,
    'No. Reg': a.student.no_regis,
    Nama: studentName(a.student),
    Prodi: a.student.major,
    Status: STATUS_LABELS[a.status],
    'Waktu Scan': a.waktu_scan
      ? new Date(a.waktu_scan).toLocaleString('id-ID')
      : '—',
  }))
}

export default function PresensMonitorPage({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = React.use(params)
  const supabase = createClient()
  const router = useRouter()

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [attendances, setAttendances] = useState<AttendanceRow[]>([])
  // Semua mahasiswa terdaftar untuk event ini (dari absenter_group / student_sections / semua students)
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([])
  const [loadingInit, setLoadingInit] = useState(true)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [closing, setClosing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [listFilter, setListFilter] = useState<ListFilter>('SCAN')

  const isClosed = meeting?.status === 'DITUTUP' || meeting?.status === 'ARCHIVED'
  // Total enrolled = jumlah mahasiswa terdaftar (sama dengan logika closeMeeting)
  const totalEnrolled = enrolledStudents.length > 0 ? enrolledStudents.length : null

  const fetchAttendances = useCallback(async (closed?: boolean) => {
    const includeAbsent = closed ?? false
    let query = supabase
      .from('attendances')
      .select('id, status, waktu_scan, student:students(no_regis, first_name, last_name, major)')
      .eq('meeting_id', meetingId)

    if (includeAbsent) {
      query = query.in('status', ['HADIR', 'LATE', 'TIDAK_HADIR'])
    } else {
      query = query.in('status', ['HADIR', 'LATE'])
    }

    const { data } = await query.order('waktu_scan', { ascending: false })
    setAttendances((data ?? []) as AttendanceRow[])
  }, [supabase, meetingId])

  // Ambil daftar semua mahasiswa terdaftar untuk event ini
  // Logika identik dengan closeMeeting di lib/meetings.ts
  const fetchEnrolledStudents = useCallback(async (m: Meeting) => {
    let students: EnrolledStudent[] = []

    if (m.absenter_group_id) {
      // Event pakai absenter group → ambil members group ini
      const { data: members } = await supabase
        .from('absenter_group_members')
        .select('student:students(id, no_regis, first_name, last_name, major)')
        .eq('group_id', m.absenter_group_id)
      students = ((members ?? []).map((mem: any) => mem.student).filter(Boolean)) as EnrolledStudent[]
    } else {
      // Event tanpa absenter group → semua mahasiswa di DB
      // (student_sections hanya untuk seating, bukan enrollment presensi)
      const { data: all } = await supabase
        .from('students')
        .select('id, no_regis, first_name, last_name, major')
        .order('last_name')
      students = (all ?? []) as EnrolledStudent[]
    }

    setEnrolledStudents(students)
  }, [supabase])

  useEffect(() => {
    async function init() {
      const { data: m } = await supabase.from('meetings').select('*').eq('id', meetingId).single()
      setMeeting(m)
      const closed = m?.status === 'DITUTUP' || m?.status === 'ARCHIVED'
      if (closed) setListFilter('ALL')
      // Jalankan paralel: fetch attendances + enrolled students
      await Promise.all([
        fetchAttendances(closed),
        m ? fetchEnrolledStudents(m) : Promise.resolve(),
      ])
      setLoadingInit(false)
    }
    init()
  }, [supabase, meetingId, fetchAttendances, fetchEnrolledStudents])

  // Supabase Realtime subscription (only while event is active)
  useEffect(() => {
    if (meeting?.status !== 'AKTIF') return

    const channel = supabase
      .channel(`monitor-${meetingId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'attendances',
        filter: `meeting_id=eq.${meetingId}`,
      }, () => fetchAttendances(false))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, meetingId, fetchAttendances, meeting?.status])

  async function handleClose() {
    setClosing(true)
    const res = await fetch(`/api/meetings/${meetingId}/close`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Gagal menutup event.')
    } else {
      toast.success(`Event ditutup. ${data.absent_inserted} mahasiswa dicatat TIDAK_HADIR.`, {
        action: {
          label: 'Lihat Rekap',
          onClick: () => router.push('/rekap'),
        },
        duration: 8000,
      })
      setMeeting(prev => prev ? { ...prev, status: 'DITUTUP' } : prev)
      setListFilter('ALL')
      await fetchAttendances(true)
    }
    setClosing(false)
    setShowCloseConfirm(false)
  }

  const hadir = attendances.filter(a => a.status === 'HADIR').length
  const late = attendances.filter(a => a.status === 'LATE').length
  const tidakHadir = attendances.filter(a => a.status === 'TIDAK_HADIR').length
  const presentRows = useMemo(
    () => attendances.filter(a => a.status === 'HADIR' || a.status === 'LATE'),
    [attendances],
  )
  const absentRows = useMemo(
    () => attendances.filter(a => a.status === 'TIDAK_HADIR'),
    [attendances],
  )

  // Mahasiswa terdaftar yang BELUM scan sama sekali (belum ada di tabel attendances)
  const belumScanRows = useMemo(() => {
    const scannedIds = new Set(attendances.map(a => a.student.no_regis))
    return enrolledStudents
      .filter(s => !scannedIds.has(s.no_regis))
      .sort((a, b) => a.last_name.localeCompare(b.last_name, 'id', { sensitivity: 'base' }))
  }, [attendances, enrolledStudents])

  const displayedRows = useMemo(() => {
    if (!isClosed) {
      // Live: tampilkan yang sudah scan (urut waktu terbaru)
      if (listFilter === 'BELUM_SCAN') return [] // handled separately
      return presentRows
    }
    // Closed: tampilkan berdasarkan filter
    if (listFilter === 'SCAN') return presentRows
    if (listFilter === 'HADIR') return sortByStudentName(presentRows)
    if (listFilter === 'TIDAK_HADIR') return sortByStudentName(absentRows)
    if (listFilter === 'BELUM_SCAN') return [] // handled separately
    return sortByStudentName([...presentRows, ...absentRows])
  }, [isClosed, listFilter, presentRows, absentRows])

  function handleExport(format: 'xlsx' | 'csv') {
    if (!meeting || !isClosed) {
      toast.error('Export tersedia setelah event ditutup.')
      return
    }
    if (attendances.length === 0) {
      toast.error('Belum ada data presensi untuk diexport.')
      return
    }

    setExporting(true)
    try {
      const safeName = meeting.nama_event.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40)
      const datePart = meeting.tanggal
      const filename = `Presensi_${safeName}_${datePart}.${format}`

      // Semua sheet/CSV: nama berurutan A–Z (last_name, first_name) seperti data mahasiswa
      const presentSorted = sortByStudentName(presentRows)
      const absentSorted = sortByStudentName(absentRows)
      const allSorted = sortByStudentName([...presentRows, ...absentRows])

      if (format === 'csv') {
        const headers = ['No', 'No. Reg', 'Nama', 'Prodi', 'Status', 'Waktu Scan']
        const rows = allSorted.map((a, i) => [
          i + 1,
          a.student.no_regis,
          studentName(a.student),
          a.student.major,
          STATUS_LABELS[a.status],
          a.waktu_scan ? new Date(a.waktu_scan).toLocaleString('id-ID') : '—',
        ])
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Presensi')
        XLSX.writeFile(wb, filename, { bookType: 'csv' })
      } else {
        const wb = XLSX.utils.book_new()

        const ringkasan = [
          ['Event', meeting.nama_event],
          ['Tanggal', meeting.tanggal],
          ['Waktu', `${meeting.start_time}${meeting.end_time ? `–${meeting.end_time}` : ''}`],
          ['Status', meeting.status],
          [],
          ['HADIR', hadir],
          ['LATE', late],
          ['TIDAK HADIR', tidakHadir],
          ['Total hadir (H+L)', hadir + late],
          ['Total peserta', totalEnrolled ?? hadir + late + tidakHadir],
        ]
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ringkasan), 'Ringkasan')

        const allSheet = XLSX.utils.json_to_sheet(toExportRows(allSorted))
        allSheet['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 28 }, { wch: 18 }, { wch: 12 }, { wch: 20 }]
        XLSX.utils.book_append_sheet(wb, allSheet, 'Semua')

        const presentSheet = XLSX.utils.json_to_sheet(toExportRows(presentSorted))
        presentSheet['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 28 }, { wch: 18 }, { wch: 12 }, { wch: 20 }]
        XLSX.utils.book_append_sheet(wb, presentSheet, 'Hadir')

        const absentSheet = XLSX.utils.json_to_sheet(toExportRows(absentSorted))
        absentSheet['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 28 }, { wch: 18 }, { wch: 12 }, { wch: 20 }]
        XLSX.utils.book_append_sheet(wb, absentSheet, 'Tidak Hadir')

        XLSX.writeFile(wb, filename)
      }

      toast.success(`File ${format.toUpperCase()} berhasil diexport!`)
    } catch (e: unknown) {
      toast.error('Gagal export: ' + (e instanceof Error ? e.message : 'unknown'))
    } finally {
      setExporting(false)
    }
  }

  if (loadingInit) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  if (!meeting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <XCircle className="h-10 w-10 text-red-400" />
        <p>Event tidak ditemukan.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{meeting.nama_event}</h1>
            <p className="text-sm text-muted-foreground">{meeting.tanggal} &middot; {meeting.start_time}{meeting.end_time ? `–${meeting.end_time}` : ''}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <Badge className={meeting.status === 'AKTIF' ? 'bg-green-600' : meeting.status === 'DRAFT' ? 'bg-gray-500' : 'bg-red-700'}>
              {meeting.status}
            </Badge>
            {isClosed && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={exporting || attendances.length === 0}
                  className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-border bg-background px-2.5 text-[0.8rem] font-medium shadow-xs hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                >
                  {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Export
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport('xlsx')}>
                    <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
                    Excel (.xlsx) — Hadir & Tidak Hadir
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('csv')}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    CSV (semua status)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {meeting.status === 'AKTIF' && (
              <Button size="sm" variant="destructive" onClick={() => setShowCloseConfirm(true)}>
                <Lock className="h-3.5 w-3.5 mr-1" />Tutup Event
              </Button>
            )}
          </div>
        </div>

        {/* Live counter cards */}
        <div className={`grid gap-3 ${isClosed ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-4'}`}>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-3xl font-bold text-green-600">{hadir}</p>
              <p className="text-xs text-muted-foreground">HADIR</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-3xl font-bold text-yellow-600">{late}</p>
              <p className="text-xs text-muted-foreground">LATE</p>
            </CardContent>
          </Card>
          {isClosed && (
            <Card>
              <CardContent className="py-3 text-center">
                <p className="text-3xl font-bold text-red-600">{tidakHadir}</p>
                <p className="text-xs text-muted-foreground">TIDAK HADIR</p>
              </CardContent>
            </Card>
          )}
          {!isClosed && (
            <Card className={belumScanRows.length > 0 ? 'border-orange-200' : ''}>
              <CardContent className="py-3 text-center">
                <p className="text-3xl font-bold text-orange-500">{belumScanRows.length}</p>
                <p className="text-xs text-muted-foreground">BELUM SCAN</p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-3xl font-bold text-blue-600">{hadir + late}</p>
              <p className="text-xs text-muted-foreground">{totalEnrolled !== null ? `dari ${totalEnrolled}` : 'Total hadir'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Realtime badge */}
        {meeting.status === 'AKTIF' && (
          <div className="flex items-center gap-2 text-sm text-green-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600"></span>
            </span>
            Live monitoring aktif
          </div>
        )}

        {isClosed && (
          <p className="text-sm text-muted-foreground">
            Event sudah ditutup. Gunakan <strong>Export</strong> untuk mengunduh daftar hadir dan tidak hadir.
          </p>
        )}

        {/* Attendance list */}
        <Card>
          <CardHeader className="pb-2 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                {listFilter === 'BELUM_SCAN'
                  ? `Belum Scan (${belumScanRows.length})`
                  : isClosed
                    ? `Data Presensi (${displayedRows.length})`
                    : `Riwayat Scan (${presentRows.length})`}
              </CardTitle>
              <div className="flex flex-wrap gap-1.5">
                {/* Tab saat AKTIF: Sudah Scan + Belum Scan */}
                {!isClosed && (
                  <>
                    <Button
                      size="sm"
                      variant={listFilter === 'SCAN' ? 'default' : 'outline'}
                      className="h-7 text-xs"
                      onClick={() => setListFilter('SCAN')}
                    >
                      Sudah Scan ({presentRows.length})
                    </Button>
                    <Button
                      size="sm"
                      variant={listFilter === 'BELUM_SCAN' ? 'default' : 'outline'}
                      className={`h-7 text-xs ${listFilter !== 'BELUM_SCAN' && belumScanRows.length > 0 ? 'border-orange-300 text-orange-600 hover:bg-orange-50' : ''}`}
                      onClick={() => setListFilter('BELUM_SCAN')}
                    >
                      Belum Scan ({belumScanRows.length})
                    </Button>
                  </>
                )}
                {/* Tab saat DITUTUP: Semua, Hadir, Tidak Hadir */}
                {isClosed && (
                  (
                    [
                      { key: 'ALL', label: 'Semua' },
                      { key: 'HADIR', label: 'Hadir' },
                      { key: 'TIDAK_HADIR', label: 'Tidak Hadir' },
                    ] as const
                  ).map(f => (
                    <Button
                      key={f.key}
                      size="sm"
                      variant={listFilter === f.key ? 'default' : 'outline'}
                      className="h-7 text-xs"
                      onClick={() => setListFilter(f.key)}
                    >
                      {f.label}
                    </Button>
                  ))
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Tab Belum Scan */}
            {listFilter === 'BELUM_SCAN' ? (
              belumScanRows.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  🎉 Semua mahasiswa terdaftar sudah scan!
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>No. Reg</TableHead>
                        <TableHead>Prodi</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {belumScanRows.map((s, i) => (
                        <TableRow key={s.id} className="bg-orange-50/50">
                          <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="text-sm">{studentName(s)}</TableCell>
                          <TableCell className="text-xs font-mono">{s.no_regis}</TableCell>
                          <TableCell className="text-xs">{s.major}</TableCell>
                          <TableCell>
                            <Badge className="text-xs bg-orange-100 text-orange-700 border-orange-200">
                              Belum Scan
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            ) : displayedRows.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                {isClosed ? 'Tidak ada data untuk filter ini.' : 'Belum ada scan'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>No. Reg</TableHead>
                      <TableHead>Prodi</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Waktu</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedRows.map((a, i) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="text-sm">{studentName(a.student)}</TableCell>
                        <TableCell className="text-xs font-mono">{a.student.no_regis}</TableCell>
                        <TableCell className="text-xs">{a.student.major}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${STATUS_COLORS[a.status]}`}>{STATUS_LABELS[a.status]}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatScanTime(a.waktu_scan)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Close confirm dialog */}
      <Dialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tutup Event?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Event akan ditutup dan semua mahasiswa yang belum scan akan otomatis dicatat <strong>TIDAK_HADIR</strong>. Setelah ditutup, Anda dapat mengexport data hadir dan tidak hadir. Tindakan ini tidak dapat dibatalkan.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseConfirm(false)}>Batal</Button>
            <Button variant="destructive" onClick={handleClose} disabled={closing}>
              {closing && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Tutup & Generate Absen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
