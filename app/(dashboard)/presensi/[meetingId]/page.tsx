'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, XCircle, Users, Lock } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/types'
import type { Meeting, Attendance } from '@/lib/types'

import React from 'react'

interface AttendanceRow {
  id: string
  status: 'HADIR' | 'LATE' | 'TIDAK_HADIR'
  waktu_scan: string | null
  student: { no_regis: string; first_name: string; last_name: string; major: string }
}

export default function PresensMonitorPage({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = React.use(params)
  const supabase = createClient()

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [attendances, setAttendances] = useState<AttendanceRow[]>([])
  const [loadingInit, setLoadingInit] = useState(true)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [closing, setClosing] = useState(false)
  const [totalEnrolled, setTotalEnrolled] = useState<number | null>(null)

  const fetchAttendances = useCallback(async () => {
    const { data } = await supabase.from('attendances').select('id, status, waktu_scan, student:students(no_regis, first_name, last_name, major)').eq('meeting_id', meetingId).in('status', ['HADIR', 'LATE']).order('waktu_scan', { ascending: false })
    setAttendances((data ?? []) as any)
  }, [supabase, meetingId])

  useEffect(() => {
    async function init() {
      const { data: m } = await supabase.from('meetings').select('*').eq('id', meetingId).single()
      setMeeting(m)
      await fetchAttendances()
      if (m) {
        if (m.absenter_group_id) {
          const { count } = await supabase.from('absenter_group_members').select('id', { count: 'exact', head: true }).eq('group_id', m.absenter_group_id)
          setTotalEnrolled(count ?? null)
        } else {
          const { count } = await supabase.from('student_sections').select('id', { count: 'exact', head: true }).eq('semester_id', m.semester_id)
          setTotalEnrolled(count ?? null)
        }
      }
      setLoadingInit(false)
    }
    init()
  }, [supabase, meetingId, fetchAttendances])

  // Supabase Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`monitor-${meetingId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'attendances',
        filter: `meeting_id=eq.${meetingId}`,
      }, () => fetchAttendances())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, meetingId, fetchAttendances])

  async function handleClose() {
    setClosing(true)
    const res = await fetch(`/api/meetings/${meetingId}/close`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Gagal menutup event.')
    } else {
      toast.success(`Event ditutup. ${data.absent_inserted} mahasiswa dicatat TIDAK_HADIR.`)
      setMeeting(prev => prev ? { ...prev, status: 'DITUTUP' } : prev)
    }
    setClosing(false)
    setShowCloseConfirm(false)
  }

  const hadir = attendances.filter(a => a.status === 'HADIR').length
  const late = attendances.filter(a => a.status === 'LATE').length

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
          <div className="flex items-center gap-2 shrink-0">
            <Badge className={meeting.status === 'AKTIF' ? 'bg-green-600' : meeting.status === 'DRAFT' ? 'bg-gray-500' : 'bg-red-700'}>
              {meeting.status}
            </Badge>
            {meeting.status === 'AKTIF' && (
              <Button size="sm" variant="destructive" onClick={() => setShowCloseConfirm(true)}>
                <Lock className="h-3.5 w-3.5 mr-1" />Tutup Event
              </Button>
            )}
          </div>
        </div>

        {/* Live counter cards */}
        <div className="grid grid-cols-3 gap-3">
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
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-3xl font-bold text-blue-600">{hadir + late}</p>
              <p className="text-xs text-muted-foreground">{totalEnrolled !== null ? `dari ${totalEnrolled}` : 'Total'}</p>
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

        {/* Attendance list */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Riwayat Scan ({attendances.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {attendances.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">Belum ada scan</p>
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
                    {attendances.map((a, i) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="text-sm">{a.student.last_name}, {a.student.first_name}</TableCell>
                        <TableCell className="text-xs font-mono">{a.student.no_regis}</TableCell>
                        <TableCell className="text-xs">{a.student.major}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${STATUS_COLORS[a.status]}`}>{STATUS_LABELS[a.status]}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {a.waktu_scan ? new Date(a.waktu_scan).toLocaleTimeString('id-ID') : '—'}
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
            Event akan ditutup dan semua mahasiswa yang belum scan akan otomatis dicatat <strong>TIDAK_HADIR</strong>. Tindakan ini tidak dapat dibatalkan.
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
