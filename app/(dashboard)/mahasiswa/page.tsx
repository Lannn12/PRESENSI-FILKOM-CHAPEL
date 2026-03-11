'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Upload, Plus, Trash2, Loader2, Users, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import type { Student, AbsenterGroup, Semester } from '@/lib/types'

const PAGE_SIZE = 20

export default function MahasiswaPage() {
  const supabase = createClient()
  const [activeSemester, setActiveSemester] = useState<Semester | null>(null)

  useEffect(() => {
    supabase.from('semesters').select('*').eq('is_active', true).single()
      .then(({ data }) => setActiveSemester(data))
  }, [supabase])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Manage Mahasiswa</h1>
        <p className="text-sm text-muted-foreground">Kelola data mahasiswa dan grup absenter</p>
      </div>
      {activeSemester && (
        <Badge variant="outline" className="text-xs">Semester aktif: {activeSemester.nama}</Badge>
      )}
      <Tabs defaultValue="students">
        <TabsList>
          <TabsTrigger value="students">Data Mahasiswa</TabsTrigger>
          <TabsTrigger value="absenter">Absenter Groups</TabsTrigger>
        </TabsList>
        <TabsContent value="students">
          <StudentsTab activeSemester={activeSemester} />
        </TabsContent>
        <TabsContent value="absenter">
          <AbsenterTab activeSemester={activeSemester} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Students Tab ─────────────────────────────────────────────────────────────

function StudentsTab({ activeSemester }: { activeSemester: Semester | null }) {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [students, setStudents] = useState<Student[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [searchQ, setSearchQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [editStudent, setEditStudent] = useState<Student | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(searchQ); setPage(0) }, 350)
    return () => clearTimeout(t)
  }, [searchQ])

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('students').select('*', { count: 'exact' })
    if (debouncedQ) {
      query = query.or(`no_regis.ilike.%${debouncedQ}%,first_name.ilike.%${debouncedQ}%,last_name.ilike.%${debouncedQ}%`)
    }
    const { data, count } = await query.order('last_name').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    setStudents(data ?? [])
    setTotalCount(count ?? 0)
    setLoading(false)
  }, [supabase, debouncedQ, page])

  useEffect(() => { fetchStudents() }, [fetchStudents])

  // CSV/Excel import
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)

    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer)
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

      // Normalize column names
      const normalizedRows = rows.map((r) => {
        const norm: Record<string, string> = {}
        for (const key of Object.keys(r)) {
          norm[key.toLowerCase().replace(/\s/g, '_')] = String(r[key]).trim()
        }
        return norm
      })

      const valid = normalizedRows.filter((r) => r.no_regis && (r.first_name || r.nama_depan) && (r.last_name || r.nama_belakang))
      if (!valid.length) {
        toast.error('Tidak ada baris valid. Pastikan kolom: no_regis, first_name, last_name, major, gender')
        setUploading(false)
        return
      }

      const toUpsert = valid.map((r) => ({
        no_regis: r.no_regis,
        first_name: r.first_name || r.nama_depan || '',
        last_name: r.last_name || r.nama_belakang || '',
        major: r.major || r.prodi || '',
        gender: (r.gender || r.jenis_kelamin || '').toUpperCase() === 'FEMALE' || (r.gender || '').toLowerCase() === 'p' ? 'FEMALE' : 'MALE',
      }))

      const { error } = await supabase.from('students').upsert(toUpsert, { onConflict: 'no_regis' })
      if (error) { toast.error('Upload gagal: ' + error.message); setUploading(false); return }
      toast.success(`${toUpsert.length} mahasiswa berhasil diimport`)
      fetchStudents()
    } catch {
      toast.error('Gagal membaca file. Pastikan format CSV/XLSX.')
    }
    setUploading(false)
  }

  async function handleDelete() {
    if (!deleteId) return
    const { error } = await supabase.from('students').delete().eq('id', deleteId)
    if (error) { toast.error('Gagal hapus: ' + error.message); return }
    toast.success('Mahasiswa dihapus')
    setDeleteId(null)
    fetchStudents()
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base">Data Mahasiswa</CardTitle>
          <CardDescription>{totalCount} mahasiswa terdaftar</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
            Import CSV/Excel
          </Button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Cari no. reg / nama..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
        </div>
        <div className="rounded border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Reg</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Prodi</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : students.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Tidak ada data</TableCell></TableRow>
              ) : students.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-sm font-mono">{s.no_regis}</TableCell>
                  <TableCell className="text-sm">{s.last_name}, {s.first_name}</TableCell>
                  <TableCell className="text-sm">{s.major}</TableCell>
                  <TableCell>
                    <Badge variant={s.gender === 'MALE' ? 'default' : 'secondary'} className="text-xs">
                      {s.gender === 'MALE' ? '♂ L' : '♀ P'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => setDeleteId(s.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Halaman {page + 1} dari {totalPages}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-3.5 w-3.5" /></Button>
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Hapus Mahasiswa?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Data presensi terkait juga akan terhapus. Tindakan ini tidak dapat dibatalkan.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete}>Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ─── Absenter Groups Tab ──────────────────────────────────────────────────────

function AbsenterTab({ activeSemester }: { activeSemester: Semester | null }) {
  const supabase = createClient()
  const [groups, setGroups] = useState<AbsenterGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState<AbsenterGroup | null>(null)
  const [members, setMembers] = useState<Student[]>([])
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set())
  const [memberSearch, setMemberSearch] = useState('')
  const [loadingMembers, setLoadingMembers] = useState(false)

  // New group dialog
  const [showCreate, setShowCreate] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDesc, setNewGroupDesc] = useState('')
  const [creating, setCreating] = useState(false)

  const fetchGroups = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('absenter_groups').select('*').eq('semester_id', activeSemester?.id ?? '').order('nama_group')
    setGroups(data ?? [])
    setLoading(false)
  }, [supabase, activeSemester])

  useEffect(() => { if (activeSemester) fetchGroups() }, [fetchGroups, activeSemester])

  async function loadGroupMembers(group: AbsenterGroup) {
    setSelectedGroup(group)
    setLoadingMembers(true)
    const [{ data: mems }, { data: studs }] = await Promise.all([
      supabase.from('absenter_group_members').select('student_id').eq('group_id', group.id),
      supabase.from('students').select('*').order('last_name'),
    ])
    const ids = new Set((mems ?? []).map((m) => m.student_id))
    setMemberIds(ids)
    setMembers((studs ?? []).filter((s) => ids.has(s.id)))
    setAllStudents(studs ?? [])
    setLoadingMembers(false)
  }

  async function toggleMember(studentId: string, checked: boolean) {
    if (!selectedGroup) return
    if (checked) {
      await supabase.from('absenter_group_members').upsert({ group_id: selectedGroup.id, student_id: studentId })
      setMemberIds((prev) => new Set([...prev, studentId]))
    } else {
      await supabase.from('absenter_group_members').delete().eq('group_id', selectedGroup.id).eq('student_id', studentId)
      setMemberIds((prev) => { const s = new Set(prev); s.delete(studentId); return s })
    }
    setMembers(allStudents.filter((s) => s.id === studentId ? checked : memberIds.has(s.id)))
    loadGroupMembers(selectedGroup)
  }

  async function handleCreateGroup() {
    if (!newGroupName.trim() || !activeSemester) return
    setCreating(true)
    const { error } = await supabase.from('absenter_groups').insert({ semester_id: activeSemester.id, nama_group: newGroupName.trim(), deskripsi: newGroupDesc.trim() || null })
    if (error) { toast.error('Gagal: ' + error.message) } else {
      toast.success('Group dibuat')
      setShowCreate(false)
      setNewGroupName('')
      setNewGroupDesc('')
      fetchGroups()
    }
    setCreating(false)
  }

  async function handleDeleteGroup(groupId: string) {
    const { error } = await supabase.from('absenter_groups').delete().eq('id', groupId)
    if (error) { toast.error('Gagal hapus: ' + error.message); return }
    toast.success('Group dihapus')
    if (selectedGroup?.id === groupId) setSelectedGroup(null)
    fetchGroups()
  }

  const filteredAllStudents = allStudents.filter((s) =>
    !memberSearch || `${s.last_name} ${s.first_name} ${s.no_regis}`.toLowerCase().includes(memberSearch.toLowerCase())
  )

  if (!activeSemester) {
    return <Card><CardContent className="py-10 text-center text-muted-foreground">Tidak ada semester aktif. Buat semester terlebih dahulu.</CardContent></Card>
  }

  return (
    <div className="grid md:grid-cols-5 gap-4">
      {/* Group list */}
      <Card className="md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Absenter Groups</CardTitle>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" />Buat</Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : groups.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Belum ada group</p>
          ) : (
            <div className="divide-y">
              {groups.map((g) => (
                <div key={g.id} className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-accent transition-colors ${selectedGroup?.id === g.id ? 'bg-accent' : ''}`} onClick={() => loadGroupMembers(g)}>
                  <div>
                    <p className="text-sm font-medium">{g.nama_group}</p>
                    {g.deskripsi && <p className="text-xs text-muted-foreground">{g.deskripsi}</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 shrink-0" onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g.id) }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Members panel */}
      <Card className="md:col-span-3">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            {selectedGroup ? `Anggota: ${selectedGroup.nama_group}` : 'Pilih group untuk lihat anggota'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedGroup ? (
            <p className="text-sm text-muted-foreground text-center py-8">Klik group di sebelah kiri</p>
          ) : loadingMembers ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <div className="space-y-3">
              <Input placeholder="Cari mahasiswa..." value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} />
              <div className="text-xs text-muted-foreground">{memberIds.size} anggota terpilih dari {allStudents.length} mahasiswa</div>
              <ScrollArea className="h-72 rounded border p-1">
                {filteredAllStudents.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent">
                    <Checkbox id={`m-${s.id}`} checked={memberIds.has(s.id)} onCheckedChange={(c) => toggleMember(s.id, !!c)} />
                    <label htmlFor={`m-${s.id}`} className="text-sm cursor-pointer flex-1">
                      <span className="font-medium">{s.last_name}, {s.first_name}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{s.no_regis} · {s.major}</span>
                    </label>
                  </div>
                ))}
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create group dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Buat Absenter Group</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="gname">Nama Group *</Label>
              <Input id="gname" placeholder="mis. CSSA 2026" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="gdesc">Deskripsi</Label>
              <Input id="gdesc" placeholder="Opsional" value={newGroupDesc} onChange={(e) => setNewGroupDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Batal</Button>
            <Button onClick={handleCreateGroup} disabled={creating || !newGroupName.trim()}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Buat Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
