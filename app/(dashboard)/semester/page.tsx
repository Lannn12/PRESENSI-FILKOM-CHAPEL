'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Loader2, CheckCircle2, Circle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Semester } from '@/lib/types'

export default function SemesterPage() {
  const supabase = createClient()
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newNama, setNewNama] = useState('')
  const [saving, setSaving] = useState(false)
  const [activating, setActivating] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const fetchSemesters = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('semesters').select('*').order('created_at', { ascending: false })
    setSemesters(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchSemesters() }, [fetchSemesters])

  async function handleCreate() {
    if (!newNama.trim()) return
    setSaving(true)
    const { error } = await supabase.from('semesters').insert({ nama: newNama.trim(), is_active: false })
    if (error) {
      toast.error('Gagal membuat semester: ' + error.message)
    } else {
      toast.success('Semester berhasil dibuat')
      setShowCreate(false)
      setNewNama('')
      fetchSemesters()
    }
    setSaving(false)
  }

  async function handleActivate(semesterId: string) {
    setActivating(semesterId)
    // Deactivate all first, then activate selected
    await supabase.from('semesters').update({ is_active: false }).neq('id', semesterId)
    const { error } = await supabase.from('semesters').update({ is_active: true }).eq('id', semesterId)
    if (error) {
      toast.error('Gagal mengaktifkan semester: ' + error.message)
    } else {
      toast.success('Semester diaktifkan')
      fetchSemesters()
    }
    setActivating(null)
  }

  async function handleDelete() {
    if (!deleteId) return
    const semester = semesters.find(s => s.id === deleteId)
    if (semester?.is_active) {
      toast.error('Tidak bisa menghapus semester yang sedang aktif')
      setDeleteId(null)
      return
    }
    const { error } = await supabase.from('semesters').delete().eq('id', deleteId)
    if (error) {
      toast.error('Gagal hapus: ' + error.message)
    } else {
      toast.success('Semester dihapus')
      setDeleteId(null)
      fetchSemesters()
    }
  }

  const activeSemester = semesters.find(s => s.is_active)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Semester</h1>
          <p className="text-sm text-muted-foreground">Kelola semester aktif untuk presensi</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" />Semester Baru
        </Button>
      </div>

      {/* Active semester banner */}
      {activeSemester && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-3 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">Semester Aktif: {activeSemester.nama}</p>
              <p className="text-xs text-green-600">Semua data baru terkait dengan semester ini</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!activeSemester && !loading && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="py-3 flex items-center gap-3">
            <Circle className="h-5 w-5 text-yellow-600 shrink-0" />
            <p className="text-sm text-yellow-800">
              Belum ada semester aktif. Buat semester baru dan aktifkan untuk mulai menggunakan sistem.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Semester table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Daftar Semester</CardTitle>
          <CardDescription>{semesters.length} semester terdaftar</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : semesters.length === 0 ? (
            <div className="text-center text-muted-foreground py-10 text-sm">
              Belum ada semester. Buat semester pertama Anda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Semester</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {semesters.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.nama}</TableCell>
                    <TableCell>
                      {s.is_active ? (
                        <Badge className="bg-green-600 text-white text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />Aktif
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Non-aktif</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!s.is_active && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={activating === s.id}
                            onClick={() => handleActivate(s.id)}
                          >
                            {activating === s.id
                              ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              : <CheckCircle2 className="h-3 w-3 mr-1" />
                            }
                            Aktifkan
                          </Button>
                        )}
                        {!s.is_active && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-500 hover:text-red-700"
                            onClick={() => setDeleteId(s.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Buat Semester Baru</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="sname">Nama Semester *</Label>
            <Input
              id="sname"
              placeholder="mis. Ganjil 2025/2026"
              value={newNama}
              onChange={e => setNewNama(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Contoh: Ganjil 2025/2026, Genap 2025/2026, Chapel Sem. 1 2026
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Batal</Button>
            <Button onClick={handleCreate} disabled={saving || !newNama.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Buat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Hapus Semester?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Semua data events, sections, dan absenter groups yang terkait semester ini akan ikut terhapus. Data mahasiswa tidak terpengaruh.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete}>Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
