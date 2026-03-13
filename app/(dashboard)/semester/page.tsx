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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-gradient-primary">Semester</h1>
          <p className="text-sm text-muted-foreground">Kelola semester aktif untuk presensi</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="rounded-xl shadow-lg gradient-primary">
          <Plus className="h-4 w-4 mr-1" />Semester Baru
        </Button>
      </div>

      {/* Active semester banner */}
      {activeSemester && (
        <Card className="border-green-200 dark:border-green-900 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 shadow-card">
          <CardContent className="py-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800 dark:text-green-300">Semester Aktif: {activeSemester.nama}</p>
              <p className="text-xs text-green-600 dark:text-green-400/80">Semua data baru terkait dengan semester ini</p>
            </div>
            <Badge className="bg-green-500 text-white rounded-full px-3 py-1 text-xs font-semibold shadow-lg">Active</Badge>
          </CardContent>
        </Card>
      )}

      {!activeSemester && !loading && (
        <Card className="border-yellow-200 dark:border-yellow-900 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 shadow-card">
          <CardContent className="py-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
              <Circle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <p className="text-sm text-yellow-800 dark:text-yellow-300 flex-1">
              Belum ada semester aktif. Buat semester baru dan aktifkan untuk mulai menggunakan sistem.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Semester table */}
      <Card className="shadow-card border-glow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Daftar Semester</CardTitle>
              <CardDescription>{semesters.length} semester terdaftar</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : semesters.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-muted/50 flex items-center justify-center">
                <Circle className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground text-sm">Belum ada semester. Buat semester pertama Anda.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="font-semibold">Nama Semester</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Dibuat</TableHead>
                    <TableHead className="text-right font-semibold">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {semesters.map(s => (
                    <TableRow key={s.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-sm">{s.nama}</TableCell>
                      <TableCell>
                        {s.is_active ? (
                          <Badge className="bg-green-500 text-white text-xs rounded-full px-3 py-1 shadow-lg shadow-green-500/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" />Aktif
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs rounded-full">Non-aktif</Badge>
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
                              className="h-8 text-xs rounded-xl border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950/30"
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
                              className="h-8 w-8 rounded-xl text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                              onClick={() => setDeleteId(s.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
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

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Buat Semester Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="sname">Nama Semester *</Label>
            <Input
              id="sname"
              placeholder="mis. Ganjil 2025/2026"
              value={newNama}
              onChange={e => setNewNama(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
              className="h-11 rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              Contoh: Ganjil 2025/2026, Genap 2025/2026, Chapel Sem. 1 2026
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreate(false)} className="rounded-xl">Batal</Button>
            <Button onClick={handleCreate} disabled={saving || !newNama.trim()} className="rounded-xl gradient-primary">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Buat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Hapus Semester?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Semua data events, sections, dan absenter groups yang terkait semester ini akan ikut terhapus. Data mahasiswa tidak terpengaruh.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="rounded-xl">Batal</Button>
            <Button variant="destructive" onClick={handleDelete} className="rounded-xl">Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
