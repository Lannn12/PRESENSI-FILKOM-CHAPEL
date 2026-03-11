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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Trash2, Loader2, Users, ArrowUp, ArrowDown } from 'lucide-react'
import { toast } from 'sonner'
import type { Section, Student, Semester } from '@/lib/types'

export default function SeatingPage() {
  const supabase = createClient()
  const [activeSemester, setActiveSemester] = useState<Semester | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog states
  const [showCreate, setShowCreate] = useState(false)
  const [formData, setFormData] = useState({ title: '', gender: 'MALE', capacity: '', deskripsi: '' })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Assignment panel
  const [assignSection, setAssignSection] = useState<Section | null>(null)
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [assignSearch, setAssignSearch] = useState('')
  const [loadingAssign, setLoadingAssign] = useState(false)

  // Counters 
  const [genderCounts, setGenderCounts] = useState({ male: { assigned: 0, cap: 0 }, female: { assigned: 0, cap: 0 } })

  useEffect(() => {
    supabase.from('semesters').select('*').eq('is_active', true).single()
      .then(({ data }) => setActiveSemester(data))
  }, [supabase])

  const fetchSections = useCallback(async () => {
    if (!activeSemester) return
    setLoading(true)
    const { data: secs } = await supabase.from('sections').select('*').eq('semester_id', activeSemester.id).order('order')
    const { data: assigns } = await supabase.from('student_sections').select('section_id, student:students(gender)').eq('semester_id', activeSemester.id)
    setSections(secs ?? [])

    // Compute counters
    const maleCap = (secs ?? []).filter(s => s.gender === 'MALE').reduce((a, s) => a + s.capacity, 0)
    const femaleCap = (secs ?? []).filter(s => s.gender === 'FEMALE').reduce((a, s) => a + s.capacity, 0)
    const maleAss = (assigns ?? []).filter((a: any) => a.student?.gender === 'MALE').length
    const femaleAss = (assigns ?? []).filter((a: any) => a.student?.gender === 'FEMALE').length
    setGenderCounts({ male: { assigned: maleAss, cap: maleCap }, female: { assigned: femaleAss, cap: femaleCap } })
    setLoading(false)
  }, [supabase, activeSemester])

  useEffect(() => { fetchSections() }, [fetchSections])

  async function handleCreate() {
    if (!formData.title || !formData.capacity || !activeSemester) return
    setSaving(true)
    const nextOrder = sections.length > 0 ? Math.max(...sections.map(s => s.order)) + 1 : 1
    const { error } = await supabase.from('sections').insert({
      semester_id: activeSemester.id,
      title: formData.title.trim(),
      gender: formData.gender,
      capacity: parseInt(formData.capacity),
      order: nextOrder,
      deskripsi: formData.deskripsi.trim() || null,
    })
    if (error) { toast.error('Gagal: ' + error.message) } else {
      toast.success('Section dibuat')
      setShowCreate(false)
      setFormData({ title: '', gender: 'MALE', capacity: '', deskripsi: '' })
      fetchSections()
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!deleteId) return
    const { error } = await supabase.from('sections').delete().eq('id', deleteId)
    if (error) { toast.error('Gagal: ' + error.message); return }
    toast.success('Section dihapus')
    setDeleteId(null)
    if (assignSection?.id === deleteId) setAssignSection(null)
    fetchSections()
  }

  async function moveSection(sec: Section, dir: -1 | 1) {
    const others = sections.filter(s => s.gender === sec.gender)
    const idx = others.findIndex(s => s.id === sec.id)
    const swap = others[idx + dir]
    if (!swap) return
    await Promise.all([
      supabase.from('sections').update({ order: swap.order }).eq('id', sec.id),
      supabase.from('sections').update({ order: sec.order }).eq('id', swap.id),
    ])
    fetchSections()
  }

  // Assignment panel
  async function openAssign(section: Section) {
    setAssignSection(section)
    setLoadingAssign(true)
    const [{ data: studs }, { data: assigns }] = await Promise.all([
      supabase.from('students').select('*').eq('gender', section.gender).order('last_name'),
      supabase.from('student_sections').select('student_id').eq('section_id', section.id).eq('semester_id', activeSemester!.id),
    ])
    setAllStudents(studs ?? [])
    setAssignedIds(new Set((assigns ?? []).map(a => a.student_id)))
    setLoadingAssign(false)
  }

  async function toggleAssign(studentId: string, checked: boolean) {
    if (!assignSection || !activeSemester) return
    if (checked) {
      // Remove from other section first (unique constraint on semester+student)
      await supabase.from('student_sections').delete().eq('student_id', studentId).eq('semester_id', activeSemester.id)
      const { error } = await supabase.from('student_sections').insert({ semester_id: activeSemester.id, student_id: studentId, section_id: assignSection.id })
      if (error) { toast.error('Gagal assign: ' + error.message); return }
      setAssignedIds(prev => new Set([...prev, studentId]))
    } else {
      await supabase.from('student_sections').delete().eq('student_id', studentId).eq('student_id', studentId).eq('section_id', assignSection.id)
      setAssignedIds(prev => { const s = new Set(prev); s.delete(studentId); return s })
    }
    fetchSections()
  }

  const filteredStudents = allStudents.filter(s =>
    !assignSearch || `${s.last_name} ${s.first_name} ${s.no_regis}`.toLowerCase().includes(assignSearch.toLowerCase())
  )

  if (!activeSemester) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Seating</h1>
        <Card><CardContent className="py-10 text-center text-muted-foreground">Tidak ada semester aktif.</CardContent></Card>
      </div>
    )
  }

  const maleSections = sections.filter(s => s.gender === 'MALE')
  const femaleSections = sections.filter(s => s.gender === 'FEMALE')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Seating</h1>
          <p className="text-sm text-muted-foreground">Kelola section tempat duduk mahasiswa</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" />Section Baru</Button>
      </div>

      {/* Gender counters */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="py-3 flex items-center justify-between">
            <span className="text-blue-600 font-semibold">♂ Male</span>
            <span className="text-xl font-bold">{genderCounts.male.assigned}/{genderCounts.male.cap}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 flex items-center justify-between">
            <span className="text-pink-600 font-semibold">♀ Female</span>
            <span className="text-xl font-bold">{genderCounts.female.assigned}/{genderCounts.female.cap}</span>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Male sections */}
          <SectionColumn
            title="Section Laki-laki"
            color="blue"
            sections={maleSections}
            onAssign={openAssign}
            onDelete={setDeleteId}
            onMove={moveSection}
            activeSectionId={assignSection?.id}
          />
          {/* Female sections */}
          <SectionColumn
            title="Section Perempuan"
            color="pink"
            sections={femaleSections}
            onAssign={openAssign}
            onDelete={setDeleteId}
            onMove={moveSection}
            activeSectionId={assignSection?.id}
          />
        </div>
      )}

      {/* Assignment Panel */}
      {assignSection && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Assign Mahasiswa — {assignSection.title}
              <Badge variant="outline">{assignedIds.size}/{assignSection.capacity}</Badge>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setAssignSection(null)}>Tutup</Button>
          </CardHeader>
          <CardContent>
            {loadingAssign ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
              <div className="space-y-2">
                <Input placeholder="Cari mahasiswa..." value={assignSearch} onChange={e => setAssignSearch(e.target.value)} />
                <p className="text-xs text-muted-foreground">{filteredStudents.length} dari {allStudents.length} mahasiswa {assignSection.gender === 'MALE' ? 'laki-laki' : 'perempuan'}</p>
                <ScrollArea className="h-64 rounded border p-1">
                  {filteredStudents.map(s => (
                    <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent">
                      <Checkbox id={`as-${s.id}`} checked={assignedIds.has(s.id)} onCheckedChange={c => toggleAssign(s.id, !!c)} />
                      <label htmlFor={`as-${s.id}`} className="text-sm cursor-pointer flex-1">
                        <span className="font-medium">{s.last_name}, {s.first_name}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{s.no_regis}</span>
                      </label>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create section dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Buat Section Baru</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Judul Section *</Label><Input placeholder="mis. A1 / Baris 1" value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Gender</Label>
              <Select value={formData.gender} onValueChange={(v: string | null) => setFormData(p => ({ ...p, gender: v ?? 'MALE' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="MALE">Laki-laki</SelectItem><SelectItem value="FEMALE">Perempuan</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Kapasitas *</Label><Input type="number" min={1} placeholder="mis. 50" value={formData.capacity} onChange={e => setFormData(p => ({ ...p, capacity: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Deskripsi</Label><Input placeholder="Opsional" value={formData.deskripsi} onChange={e => setFormData(p => ({ ...p, deskripsi: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Batal</Button>
            <Button onClick={handleCreate} disabled={saving || !formData.title || !formData.capacity}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Buat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Hapus Section?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Semua assignment mahasiswa di section ini akan terhapus.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete}>Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SectionColumn({
  title, color, sections, onAssign, onDelete, onMove, activeSectionId,
}: {
  title: string
  color: 'blue' | 'pink'
  sections: Section[]
  onAssign: (s: Section) => void
  onDelete: (id: string) => void
  onMove: (s: Section, dir: -1 | 1) => void
  activeSectionId?: string
}) {
  const borderColor = color === 'blue' ? 'border-blue-200' : 'border-pink-200'
  const titleColor = color === 'blue' ? 'text-blue-700' : 'text-pink-700'

  return (
    <Card className={`border-2 ${borderColor}`}>
      <CardHeader className="pb-2">
        <CardTitle className={`text-sm font-semibold ${titleColor}`}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sections.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Belum ada section</p>
        ) : sections.map((sec, idx) => (
          <div key={sec.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${activeSectionId === sec.id ? 'bg-accent border-primary' : 'hover:bg-accent'}`}>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{sec.title}</p>
              {sec.deskripsi && <p className="text-xs text-muted-foreground">{sec.deskripsi}</p>}
              <Badge variant="outline" className="text-xs mt-0.5">Kapasitas: {sec.capacity}</Badge>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0} onClick={() => onMove(sec, -1)}><ArrowUp className="h-3 w-3" /></Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === sections.length - 1} onClick={() => onMove(sec, 1)}><ArrowDown className="h-3 w-3" /></Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onAssign(sec)}><Users className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700" onClick={() => onDelete(sec.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
