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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Trash2, Loader2, Users, ArrowUp, ArrowDown, Shuffle, FileSpreadsheet, Hash, SortAsc, Grid3X3 } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { getSeatLabel } from '@/lib/seat-utils'
import type { Section, Student, Semester } from '@/lib/types'

interface AssignedStudent {
  id: string
  student_id: string
  seat_number: number | null
  student: Student
}

export default function SeatingPage() {
  const supabase = createClient()
  const [activeSemester, setActiveSemester] = useState<Semester | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  // Dialog states
  const [showCreate, setShowCreate] = useState(false)
  const [formData, setFormData] = useState({ title: '', gender: 'MALE', capacity: '', columns_per_row: '4', deskripsi: '' })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Assignment panel
  const [assignSection, setAssignSection] = useState<Section | null>(null)
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [assignedStudents, setAssignedStudents] = useState<AssignedStudent[]>([])
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [assignSearch, setAssignSearch] = useState('')
  const [loadingAssign, setLoadingAssign] = useState(false)
  const [renumbering, setRenumbering] = useState(false)

  // Counters
  const [genderCounts, setGenderCounts] = useState({ male: { assigned: 0, cap: 0, total: 0 }, female: { assigned: 0, cap: 0, total: 0 } })

  // Random assign
  const [randomizing, setRandomizing] = useState(false)
  const [showRandomConfirm, setShowRandomConfirm] = useState(false)
  const [randomGender, setRandomGender] = useState<'MALE' | 'FEMALE' | null>(null)

  useEffect(() => {
    supabase.from('semesters').select('*').eq('is_active', true).single()
      .then(({ data }: { data: Semester | null }) => setActiveSemester(data))
  }, [supabase])

  const fetchSections = useCallback(async () => {
    if (!activeSemester) return
    setLoading(true)
    const [{ data: secs }, { data: assigns }, { count: maleTotal }, { count: femaleTotal }] = await Promise.all([
      supabase.from('sections').select('*').eq('semester_id', activeSemester.id).order('order'),
      supabase.from('student_sections').select('section_id, student:students(gender)').eq('semester_id', activeSemester.id),
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('gender', 'MALE'),
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('gender', 'FEMALE'),
    ])
    setSections(secs ?? [])

    const maleCap = (secs ?? []).filter((s: Section) => s.gender === 'MALE').reduce((a: number, s: Section) => a + s.capacity, 0)
    const femaleCap = (secs ?? []).filter((s: Section) => s.gender === 'FEMALE').reduce((a: number, s: Section) => a + s.capacity, 0)
    const maleAss = (assigns ?? []).filter((a: { student?: { gender: string } }) => a.student?.gender === 'MALE').length
    const femaleAss = (assigns ?? []).filter((a: { student?: { gender: string } }) => a.student?.gender === 'FEMALE').length
    setGenderCounts({
      male: { assigned: maleAss, cap: maleCap, total: maleTotal ?? 0 },
      female: { assigned: femaleAss, cap: femaleCap, total: femaleTotal ?? 0 },
    })
    setLoading(false)
  }, [supabase, activeSemester])

  useEffect(() => { fetchSections() }, [fetchSections])

  async function handleExport() {
    if (!activeSemester || !sections.length) return
    setExporting(true)
    try {
      const { data: assignments, error } = await supabase
        .from('student_sections')
        .select('section_id, seat_number, student:students(no_regis, first_name, last_name, gender, major)')
        .eq('semester_id', activeSemester.id)

      if (error) throw error
      const wb = XLSX.utils.book_new()
      
      // Flatten all assignments from all sections (both genders)
      const allAssigns: any[] = []
      sections.forEach(sec => {
        const secAssigns = (assignments ?? []).filter((a: any) => a.section_id === sec.id)
        secAssigns.forEach((a: any) => {
          const label = a.seat_number ? getSeatLabel(a.seat_number, sec.title, sec.columns_per_row) : '-'
          allAssigns.push({ ...a, section: sec, computed_label: label })
        })
      })

      // Sort alphabetically by computed label
      // Using localeCompare with numeric: true ensures A1-2 comes before A1-10
      allAssigns.sort((a, b) => {
        if (a.computed_label === '-') return 1
        if (b.computed_label === '-') return -1
        return a.computed_label.localeCompare(b.computed_label, undefined, { numeric: true, sensitivity: 'base' })
      })

      const rows: Record<string, string | number>[] = []
      if (allAssigns.length > 0) {
        allAssigns.forEach(a => {
          rows.push({
            'Section': a.section.title,
            'Kode Kursi': a.computed_label,
            'No. Reg': a.student.no_regis,
            'Nama': `${a.student.last_name}, ${a.student.first_name}`,
            'Prodi': a.student.major,
            'Gender': a.student.gender === 'MALE' ? 'Laki-laki' : 'Perempuan'
          })
        })
      }

      if (rows.length === 0) { 
        toast.error('Belum ada data untuk di-export.')
        return 
      }

      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Semua Mahasiswa')
      XLSX.writeFile(wb, `Seating_${activeSemester.nama}_${new Date().toISOString().slice(0, 10)}.xlsx`)
      toast.success('File seating berhasil diexport!')
    } catch (e: any) { toast.error('Gagal export: ' + e.message) } finally { setExporting(false) }
  }

  async function handleCreate() {
    if (!formData.title || !formData.capacity || !activeSemester) return
    setSaving(true)
    const nextOrder = sections.length > 0 ? Math.max(...sections.map(s => s.order)) + 1 : 1
    const { error } = await supabase.from('sections').insert({
      semester_id: activeSemester.id,
      title: formData.title.trim(),
      gender: formData.gender,
      capacity: parseInt(formData.capacity),
      columns_per_row: parseInt(formData.columns_per_row) || 4,
      order: nextOrder,
      deskripsi: formData.deskripsi.trim() || null,
    })
    if (error) { toast.error('Gagal: ' + error.message) } else {
      toast.success('Section dibuat'); setShowCreate(false); setFormData({ title: '', gender: 'MALE', capacity: '', columns_per_row: '4', deskripsi: '' }); fetchSections()
    }
    setSaving(false)
  }

  async function handleRandomAssign() {
    if (!randomGender || !activeSemester) return
    setRandomizing(true); setShowRandomConfirm(false)
    try {
      const { data: studs, error: studsErr } = await supabase.from('students').select('id').eq('gender', randomGender)
      if (studsErr || !studs) throw new Error(studsErr?.message ?? 'Gagal ambil data mahasiswa')
      const arr = [...studs]
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]
      }
      const targetSections = sections.filter(s => s.gender === randomGender).sort((a, b) => a.order - b.order)
      if (targetSections.length === 0) { toast.error('Tidak ada section untuk gender ini.'); return }
      const sectionIds = targetSections.map(s => s.id)
      await supabase.from('student_sections').delete().eq('semester_id', activeSemester.id).in('section_id', sectionIds)
      const inserts = []
      let studentIdx = 0
      for (const sec of targetSections) {
        let seatNum = 1
        for (let i = 0; i < sec.capacity && studentIdx < arr.length; i++, studentIdx++, seatNum++) {
          inserts.push({ semester_id: activeSemester.id, student_id: arr[studentIdx].id, section_id: sec.id, seat_number: seatNum })
        }
      }
      if (inserts.length > 0) await supabase.from('student_sections').insert(inserts)
      toast.success(`${inserts.length} mahasiswa berhasil diacak dengan nomor kursi.`); fetchSections()
      if (assignSection && assignSection.gender === randomGender) openAssign(assignSection)
    } catch (e: any) { toast.error('Gagal: ' + e.message) } finally { setRandomizing(false) }
  }

  async function handleDelete() {
    if (!deleteId) return
    const { error } = await supabase.from('sections').delete().eq('id', deleteId)
    if (error) { toast.error('Gagal: ' + error.message); return }
    toast.success('Section dihapus'); setDeleteId(null); if (assignSection?.id === deleteId) setAssignSection(null); fetchSections()
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

  async function openAssign(section: Section) {
    setAssignSection(section); setLoadingAssign(true); setAssignSearch('')
    const [{ data: studs }, { data: assigns }] = await Promise.all([
      supabase.from('students').select('*').eq('gender', section.gender).order('last_name'),
      supabase.from('student_sections')
        .select('id, student_id, seat_number, student:students(*)')
        .eq('section_id', section.id)
        .eq('semester_id', activeSemester!.id)
        .order('seat_number', { ascending: true }),
    ])
    setAllStudents(studs ?? [])
    const assigned = (assigns ?? []).map((a: any) => ({
      id: a.id,
      student_id: a.student_id,
      seat_number: a.seat_number,
      student: a.student,
    })) as AssignedStudent[]
    setAssignedStudents(assigned)
    setAssignedIds(new Set(assigned.map(a => a.student_id)))
    setLoadingAssign(false)
  }

  async function toggleAssign(studentId: string, checked: boolean) {
    if (!assignSection || !activeSemester) return
    if (checked) {
      const maxSeat = assignedStudents.reduce((max, a) => Math.max(max, a.seat_number ?? 0), 0)
      const nextSeat = maxSeat + 1
      await supabase.from('student_sections').delete().eq('student_id', studentId).eq('semester_id', activeSemester.id)
      const { error } = await supabase.from('student_sections').insert({
        semester_id: activeSemester.id,
        student_id: studentId,
        section_id: assignSection.id,
        seat_number: nextSeat,
      })
      if (error) { toast.error('Gagal assign: ' + error.message); return }
    } else {
      await supabase.from('student_sections').delete().eq('student_id', studentId).eq('section_id', assignSection.id)
    }
    await openAssign(assignSection)
    fetchSections()
  }

  async function handleRenumber() {
    if (!assignSection || !activeSemester || assignedStudents.length === 0) return
    setRenumbering(true)
    try {
      const sorted = [...assignedStudents].sort((a, b) => {
        const cmp = a.student.last_name.localeCompare(b.student.last_name)
        return cmp !== 0 ? cmp : a.student.first_name.localeCompare(b.student.first_name)
      })
      const updates = sorted.map((item, idx) =>
        supabase.from('student_sections')
          .update({ seat_number: idx + 1 })
          .eq('id', item.id)
      )
      await Promise.all(updates)
      toast.success(`Nomor kursi diurutkan ulang berdasarkan nama (${sorted.length} mahasiswa).`)
      await openAssign(assignSection)
    } catch (e: any) {
      toast.error('Gagal renumber: ' + e.message)
    } finally {
      setRenumbering(false)
    }
  }

  const filteredStudents = allStudents.filter(s => !assignSearch || `${s.last_name} ${s.first_name} ${s.no_regis}`.toLowerCase().includes(assignSearch.toLowerCase()))
  if (!activeSemester) return <div className="p-8 text-center text-muted-foreground">Tidak ada semester aktif.</div>

  const maleSections = sections.filter(s => s.gender === 'MALE')
  const femaleSections = sections.filter(s => s.gender === 'FEMALE')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Seating</h1>
          <p className="text-sm text-muted-foreground">Kelola section & nomor kursi mahasiswa (row-column)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={exporting || !sections.length}>
            {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-1 text-green-600" />}
            Export Excel
          </Button>
          <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" />Section Baru</Button>
        </div>
      </div>

      {/* Gender counters */}
      <div className="grid grid-cols-2 gap-4">
        {[ {g: 'MALE', label: '♂ Laki-laki', color: 'blue', counts: genderCounts.male, secs: maleSections},
           {g: 'FEMALE', label: '♀ Perempuan', color: 'pink', counts: genderCounts.female, secs: femaleSections} ].map(c => (
          <Card key={c.g}>
            <CardContent className="py-3 flex items-center justify-between">
              <div>
                <span className={`font-semibold text-${c.color === 'blue' ? 'blue' : 'pink'}-600`}>{c.label}</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {c.counts.assigned} sudah · <span className={c.counts.total - c.counts.assigned > 0 ? 'text-orange-500 font-medium' : 'text-green-600 font-medium'}>
                    {c.counts.total - c.counts.assigned} belum
                  </span> · total {c.counts.total}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-xl font-bold leading-none">{c.counts.assigned}<span className="text-sm font-normal text-muted-foreground">/{c.counts.total}</span></p>
                  <p className="text-[10px] text-muted-foreground">kapasitas {c.counts.cap}</p>
                </div>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={randomizing || c.secs.length === 0} onClick={() => { setRandomGender(c.g as any); setShowRandomConfirm(true) }}>
                  {randomizing && randomGender === c.g ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shuffle className="h-3 w-3" />}
                  <span className="ml-1">Acak</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <SectionColumn title="Section Laki-laki" color="blue" sections={maleSections} onAssign={openAssign} onDelete={setDeleteId} onMove={moveSection} activeSectionId={assignSection?.id} />
          <SectionColumn title="Section Perempuan" color="pink" sections={femaleSections} onAssign={openAssign} onDelete={setDeleteId} onMove={moveSection} activeSectionId={assignSection?.id} />
        </div>
      )}

      {/* Assignment Panel */}
      {assignSection && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Assign — {assignSection.title}
              <Badge variant="outline">{assignedIds.size}/{assignSection.capacity}</Badge>
              <Badge variant="secondary" className="text-xs">
                <Grid3X3 className="h-2.5 w-2.5 mr-1" />{assignSection.columns_per_row} kolom/baris
              </Badge>
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRenumber}
                disabled={renumbering || assignedStudents.length === 0}
                title="Urutkan nomor kursi berdasarkan nama"
              >
                {renumbering ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <SortAsc className="h-3.5 w-3.5 mr-1" />}
                Renumber
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAssignSection(null)}>Tutup</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Assigned students with seat labels */}
            {assignedStudents.length > 0 && (
              <div className="rounded-lg border">
                <div className="px-3 py-2 bg-muted/50 border-b">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Hash className="h-3 w-3" /> Mahasiswa Ter-assign ({assignedStudents.length})
                  </p>
                </div>
                <ScrollArea className="max-h-48">
                  <div className="divide-y">
                    {assignedStudents
                      .sort((a, b) => (a.seat_number ?? 999) - (b.seat_number ?? 999))
                      .map(a => {
                        const label = a.seat_number
                          ? getSeatLabel(a.seat_number, assignSection.title, assignSection.columns_per_row)
                          : '-'
                        return (
                          <div key={a.id} className="flex items-center gap-3 px-3 py-1.5 hover:bg-accent/50">
                            <span className="text-xs font-bold text-primary bg-primary/10 rounded-md px-2 py-1 shrink-0 font-mono">
                              {label}
                            </span>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium truncate">{a.student.last_name}, {a.student.first_name}</span>
                              <span className="text-muted-foreground ml-2 text-xs">{a.student.no_regis}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-red-500 hover:text-red-700 shrink-0"
                              onClick={() => toggleAssign(a.student_id, false)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )
                      })}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Search and assign new students */}
            <Input placeholder="Cari mahasiswa untuk di-assign..." value={assignSearch} onChange={e => setAssignSearch(e.target.value)} />
            <ScrollArea className="h-52 rounded border p-1">
              {loadingAssign ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (
                filteredStudents.map(s => {
                  const assigned = assignedStudents.find(a => a.student_id === s.id)
                  const label = assigned?.seat_number && assignSection
                    ? getSeatLabel(assigned.seat_number, assignSection.title, assignSection.columns_per_row)
                    : null
                  return (
                    <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent">
                      <Checkbox id={`as-${s.id}`} checked={assignedIds.has(s.id)} onCheckedChange={c => toggleAssign(s.id, !!c)} />
                      <label htmlFor={`as-${s.id}`} className="text-sm cursor-pointer flex-1">
                        <span className="font-medium">{s.last_name}, {s.first_name}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{s.no_regis}</span>
                      </label>
                      {label && (
                        <Badge variant="secondary" className="text-xs font-mono">
                          {label}
                        </Badge>
                      )}
                    </div>
                  )
                })
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Create Section Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Buat Section Baru</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Judul Section *</Label>
              <Input placeholder="mis. A / B / C" value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Format kursi: {formData.title || 'A'}1-1, {formData.title || 'A'}1-2, {formData.title || 'A'}2-1, ...</p>
            </div>
            <div className="space-y-1">
              <Label>Gender</Label>
              <Select value={formData.gender} onValueChange={(v: any) => setFormData(p => ({ ...p, gender: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Laki-laki</SelectItem>
                  <SelectItem value="FEMALE">Perempuan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Kapasitas (total kursi) *</Label>
                <Input type="number" placeholder="mis. 20" value={formData.capacity} onChange={e => setFormData(p => ({ ...p, capacity: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Kolom per Baris *</Label>
                <Input type="number" placeholder="mis. 4" value={formData.columns_per_row} onChange={e => setFormData(p => ({ ...p, columns_per_row: e.target.value }))} />
              </div>
            </div>
            {formData.capacity && formData.columns_per_row && (
              <div className="p-3 rounded-lg bg-muted/50 border text-xs space-y-1">
                <p className="font-medium flex items-center gap-1.5"><Grid3X3 className="h-3 w-3" /> Preview Layout</p>
                <p className="text-muted-foreground">
                  {Math.ceil(parseInt(formData.capacity) / (parseInt(formData.columns_per_row) || 1))} baris × {formData.columns_per_row} kolom = {formData.capacity} kursi
                </p>
                <p className="text-muted-foreground">
                  Contoh: {formData.title || '?'}1-1, {formData.title || '?'}1-{formData.columns_per_row}, {formData.title || '?'}2-1, ...
                </p>
              </div>
            )}
            <div className="space-y-1">
              <Label>Deskripsi</Label>
              <Input placeholder="Opsional" value={formData.deskripsi} onChange={e => setFormData(p => ({ ...p, deskripsi: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Batal</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : 'Buat'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Hapus Section?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Assignment mahasiswa di sini akan terhapus.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete}>Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Random Assign Confirmation */}
      <Dialog open={showRandomConfirm} onOpenChange={v => { if (!v) { setShowRandomConfirm(false); setRandomGender(null) } }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Shuffle className="h-5 w-5" /> Acak Seating {randomGender === 'MALE' ? 'Laki-laki' : 'Perempuan'}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Data yang sudah ada akan di-reset dan diacak ulang. Nomor kursi row-column akan diisi berurut.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRandomConfirm(false); setRandomGender(null) }}>Batal</Button>
            <Button onClick={handleRandomAssign} disabled={randomizing}>Lanjutkan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SectionColumn({ title, color, sections, onAssign, onDelete, onMove, activeSectionId }: any) {
  return (
    <Card className={`border-2 border-${color}-200`}>
      <CardHeader className="pb-2"><CardTitle className={`text-sm font-semibold text-${color}-700`}>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {sections.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Belum ada section</p> : sections.map((sec: any, idx: number) => (
          <div key={sec.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${activeSectionId === sec.id ? 'bg-accent border-primary' : 'hover:bg-accent'}`}>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{sec.title}</p>
              <div className="flex gap-1.5 mt-0.5">
                <Badge variant="outline" className="text-xs">Kap: {sec.capacity}</Badge>
                <Badge variant="secondary" className="text-xs">{sec.columns_per_row} kol/baris</Badge>
              </div>
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
