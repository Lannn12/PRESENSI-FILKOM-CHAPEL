'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Loader2, Link2, QrCode, Eye, Trash2, ExternalLink, KeyRound, Archive, ArchiveRestore } from 'lucide-react'
import { toast } from 'sonner'
import { hashPin } from '@/lib/hash'
import { QRCodeSVG as QRCode } from 'qrcode.react'
import { Switch } from '@/components/ui/switch'
import type { Meeting, AbsenterGroup, Semester, EventType, EventStatus } from '@/lib/types'
import { EVENT_TYPE_LABELS, EVENT_STATUS_COLORS } from '@/lib/types'

export default function PertemuanPage() {
  const supabase = createClient()
  const [activeSemester, setActiveSemester] = useState<Semester | null>(null)
  const [meetings, setMeetings] = useState<(Meeting & { absenter_group?: { nama_group: string } | null })[]>([])
  const [groups, setGroups] = useState<AbsenterGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)

  // Dialogs
  const [showCreate, setShowCreate] = useState(false)
  const [qrMeeting, setQrMeeting] = useState<Meeting | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [form, setForm] = useState({
    nama_event: '',
    event_type: 'CHAPEL' as EventType,
    absenter_group_id: '',
    tanggal: '',
    start_time: '',
    end_time: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('semesters').select('*').eq('is_active', true).single()
      .then(({ data }: { data: Semester | null }) => setActiveSemester(data))
  }, [supabase])

  const fetchAll = useCallback(async () => {
    if (!activeSemester) return
    setLoading(true)
    const [{ data: m }, { data: g }] = await Promise.all([
      supabase.from('meetings').select('*, absenter_group:absenter_groups(nama_group)').eq('semester_id', activeSemester.id).order('tanggal', { ascending: false }),
      supabase.from('absenter_groups').select('*').eq('semester_id', activeSemester.id).order('nama_group'),
    ])
    setMeetings((m ?? []) as any)
    setGroups(g ?? [])
    setLoading(false)
  }, [supabase, activeSemester])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleCreate() {
    if (!form.nama_event || !form.tanggal || !form.start_time || !activeSemester) return
    setSaving(true)
    const { error } = await supabase.from('meetings').insert({
      semester_id: activeSemester.id,
      nama_event: form.nama_event.trim(),
      event_type: form.event_type,
      absenter_group_id: form.absenter_group_id || null,
      tanggal: form.tanggal,
      start_time: form.start_time,
      end_time: form.end_time || null,
      status: 'DRAFT',
    })
    if (error) { toast.error('Gagal: ' + error.message) } else {
      toast.success('Event dibuat')
      setShowCreate(false)
      setForm({ nama_event: '', event_type: 'CHAPEL', absenter_group_id: '', tanggal: '', start_time: '', end_time: '' })
      fetchAll()
    }
    setSaving(false)
  }

  async function handleStatusChange(meetingId: string, newStatus: EventStatus) {
    // Auto-generate 6-digit PIN when activating
    const updateData: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'AKTIF') {
      const pin = String(Math.floor(100000 + Math.random() * 900000))
      // Store plain PIN in database (for absenter verification)
      updateData.scanner_pin = pin
      const { error } = await supabase.from('meetings').update(updateData).eq('id', meetingId)
      if (error) { 
        console.error('Failed to update status:', error)
        toast.error('Gagal update status: ' + error.message)
        return 
      }
      toast.success(`Event diaktifkan! PIN Absenter: ${pin}`, { duration: 10000 })
      fetchAll()
      return
    } else if (newStatus === 'DRAFT') {
      updateData.scanner_pin = null
    }
    const { error } = await supabase.from('meetings').update(updateData).eq('id', meetingId)
    if (error) { 
      console.error('Failed to update status:', error)
      toast.error('Gagal update status: ' + error.message)
      return 
    }
    toast.success('Status diperbarui')
    fetchAll()
  }

  async function handleDelete() {
    if (!deleteId) return
    const { error } = await supabase.from('meetings').delete().eq('id', deleteId)
    if (error) { toast.error('Gagal hapus: ' + error.message); return }
    toast.success('Event dihapus')
    setDeleteId(null)
    fetchAll()
  }

  function getScannerUrl(token: string) {
    // Selalu gunakan window.location.origin agar URL benar di Vercel maupun lokal
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    return `${base}/scan/${token}`
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(getScannerUrl(token))
    toast.success('Link scanner berhasil disalin!')
  }

  const statusOptions: { value: EventStatus; label: string }[] = [
    { value: 'DRAFT', label: 'Draft' },
    { value: 'AKTIF', label: 'Aktif' },
    { value: 'DITUTUP', label: 'Ditutup' },
    { value: 'ARCHIVED', label: 'Arsip' },
  ]

  const filteredMeetings = meetings.filter(m => showArchived ? m.status === 'ARCHIVED' : m.status !== 'ARCHIVED')

  if (!activeSemester) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Pertemuan / Events</h1>
        <Card><CardContent className="py-10 text-center text-muted-foreground">Tidak ada semester aktif.</CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pertemuan / Events</h1>
          <p className="text-sm text-muted-foreground">Kelola event kuliah umum dan link scanner</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2 bg-muted/50 px-3 py-1.5 rounded-xl border border-border/50">
            <Switch id="archived-toggle" checked={showArchived} onCheckedChange={setShowArchived} />
            <Label htmlFor="archived-toggle" className="text-xs font-bold text-muted-foreground cursor-pointer">
              Lihat Arsip
            </Label>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gradient-primary shadow-lg rounded-xl"><Plus className="h-4 w-4 mr-1" />Event Baru</Button>
        </div>
      </div>

      <Card className="border-none shadow-card bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : filteredMeetings.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">
              <div className="w-16 h-16 bg-muted/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Archive className="h-8 w-8 opacity-20" />
              </div>
              <p className="font-medium">{showArchived ? 'Tidak ada event di arsip' : 'Belum ada event aktif'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30 border-none">
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest h-11">Event</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest h-11">Tipe</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest h-11">Tanggal</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest h-11">Absenter Group</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest h-11 text-center">Status</TableHead>
                    {!showArchived && <TableHead className="text-[10px] font-bold uppercase tracking-widest h-11 text-center">Scanner</TableHead>}
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest h-11 text-right pr-6 w-32">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMeetings.map((m) => (
                    <TableRow key={m.id} className="hover:bg-muted/20 border-muted/30 transition-colors">
                      <TableCell className="font-bold tracking-tight py-4">{m.nama_event}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-background/50">{EVENT_TYPE_LABELS[m.event_type]}</Badge>
                      </TableCell>
                      <TableCell className="text-sm py-4">
                        <p className="font-semibold">{m.tanggal}</p>
                        <div className="text-[10px] text-muted-foreground font-bold">{m.start_time}{m.end_time ? `–${m.end_time}` : ''}</div>
                      </TableCell>
                      <TableCell className="text-xs font-medium">{(m as any).absenter_group?.nama_group ?? <span className="text-muted-foreground opacity-50">—</span>}</TableCell>
                      <TableCell className="text-center">
                        <Select value={m.status} onValueChange={(v) => handleStatusChange(m.id, v as EventStatus)}>
                          <SelectTrigger className={`h-7 text-[10px] font-bold w-28 rounded-full border-0 mx-auto shadow-sm ${EVENT_STATUS_COLORS[m.status]}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-none shadow-float">
                            {statusOptions.map(o => (
                              <SelectItem key={o.value} value={o.value} className="text-xs font-semibold">{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      {!showArchived && (
                        <TableCell>
                          <div className="flex gap-1 items-center justify-center">
                            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-none bg-background/50 shadow-sm hover:scale-105" title="Salin link" onClick={() => copyLink(m.scanner_token)}>
                              <Link2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-none bg-background/50 shadow-sm hover:scale-105" title="QR Code" onClick={() => setQrMeeting(m)}>
                              <QrCode className="h-3.5 w-3.5" />
                            </Button>
                            {m.status === 'AKTIF' && m.scanner_pin && (
                              <Badge variant="secondary" className="h-8 px-2 bg-blue-500/10 text-blue-600 border-none font-bold text-[10px] gap-1 shadow-sm">
                                <KeyRound className="h-3 w-3" /> PIN Aktif
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex gap-1 justify-end pr-2">
                          {m.status === 'DITUTUP' && !showArchived && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg" 
                              title="Arsipkan" 
                              onClick={() => handleStatusChange(m.id, 'ARCHIVED')}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          )}
                          {m.status === 'ARCHIVED' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg" 
                              title="Buka dari arsip" 
                              onClick={() => handleStatusChange(m.id, 'DITUTUP')}
                            >
                              <ArchiveRestore className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg" title="Monitor presensi" onClick={() => window.open(`/presensi/${m.id}`, '_blank')}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg" title="Hapus permanen" onClick={() => setDeleteId(m.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Event Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Buat Event Baru</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nama Event *</Label>
              <Input placeholder="mis. Chapel Minggu 1" value={form.nama_event} onChange={e => setForm(p => ({ ...p, nama_event: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipe Event</Label>
                <Select value={form.event_type} onValueChange={v => setForm(p => ({ ...p, event_type: v as EventType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(EVENT_TYPE_LABELS) as [EventType, string][]).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Absenter Group</Label>
                <Select value={form.absenter_group_id} onValueChange={(v: string | null) => setForm(p => ({ ...p, absenter_group_id: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder="Opsional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Tidak ada —</SelectItem>
                    {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.nama_group}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Tanggal *</Label>
              <Input type="date" value={form.tanggal} onChange={e => setForm(p => ({ ...p, tanggal: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Jam Mulai *</Label>
                <Input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Jam Selesai</Label>
                <Input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Batal</Button>
            <Button onClick={handleCreate} disabled={saving || !form.nama_event || !form.tanggal || !form.start_time}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Buat Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={!!qrMeeting} onOpenChange={() => setQrMeeting(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader><DialogTitle>{qrMeeting?.nama_event}</DialogTitle></DialogHeader>
          {qrMeeting && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Scan QR ini untuk membuka halaman scanner</p>
              <div className="flex justify-center">
                <QRCode value={getScannerUrl(qrMeeting.scanner_token)} size={220} level="M" includeMargin />
              </div>
              <div className="bg-muted rounded p-2 text-xs font-mono break-all text-left">
                {typeof window !== 'undefined' ? getScannerUrl(qrMeeting.scanner_token) : `/scan/${qrMeeting.scanner_token}`}
              </div>
              {qrMeeting.scanner_pin && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
                  <p className="text-xs text-blue-600 font-medium">PIN Absenter</p>
                  <p className="text-sm text-blue-800">PIN ditampilkan saat event diaktifkan (via notifikasi).</p>
                  <p className="text-xs text-blue-500">Untuk mendapatkan PIN baru, ubah status ke Draft lalu aktifkan kembali.</p>
                </div>
              )}
              <div className="flex gap-2 justify-center">
                <Button variant="outline" size="sm" onClick={() => copyLink(qrMeeting.scanner_token)}>
                  <Link2 className="h-3.5 w-3.5 mr-1" />Salin Link
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.open(`/scan/${qrMeeting.scanner_token}`, '_blank')}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />Buka Scanner
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Hapus Event?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Seluruh data presensi (HADIR, LATE, TIDAK_HADIR) yang sudah tercatat untuk event ini akan
            <strong className="text-red-600"> ikut terhapus permanen</strong>. Tindakan ini tidak dapat dibatalkan.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete}>Hapus Permanen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
