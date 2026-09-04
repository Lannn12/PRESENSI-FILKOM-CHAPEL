# 🎛️ Fitur Toggle: Tampilkan Semua Mahasiswa

## 🎯 Problem yang Diselesaikan

**Pertanyaan User:** "Bagaimana saya mau export data mahasiswa yang tidak hadir?"

Setelah perbaikan rekap yang hanya menampilkan mahasiswa dengan attendance data, muncul kebutuhan untuk:
- Export data **semua mahasiswa termasuk yang tidak pernah hadir**
- Lihat mahasiswa yang **0% kehadiran** (tidak pernah scan)
- Identifikasi mahasiswa yang **perlu difollow-up**

---

## ✅ Solusi: Toggle Mode Tampilan

Saya menambahkan **toggle switch** di halaman Rekap dengan 2 mode:

### **Mode 1: Hanya Mahasiswa dengan Attendance (DEFAULT) ✅**
- Menampilkan hanya mahasiswa yang **pernah scan** di event yang dipilih
- **Efisien**: Query lebih cepat, tabel lebih kecil
- **Use case**: Monitoring kehadiran harian, export data hadir

### **Mode 2: Semua Mahasiswa (INCLUDING NON-ATTENDEES) 📊**
- Menampilkan **SEMUA mahasiswa** dari database
- Termasuk yang **tidak pernah hadir sama sekali**
- **Use case**: Export daftar lengkap, identifikasi yang tidak hadir

---

## 🔄 Cara Kerja

### UI Toggle

```
┌─────────────────────────────────────────────────┐
│ [Filter Tipe Event ▼] [Filter Status ▼]       │
│ [ ] Tampilkan semua mahasiswa  ← NEW TOGGLE!  │
└─────────────────────────────────────────────────┘
```

### Logic Flow

**TOGGLE OFF (Default):**
```typescript
// 1. Fetch attendances
const attendances = await supabase
  .from('attendances')
  .select('*')
  .in('meeting_id', meetingIds)

// 2. Extract unique student_id
const uniqueStudentIds = [...new Set(attendances.map(a => a.student_id))]

// 3. Fetch ONLY students with attendance
const students = await supabase
  .from('students')
  .select('*')
  .in('id', uniqueStudentIds) // ✅ Filter!
```

**TOGGLE ON:**
```typescript
// 1. Fetch attendances
const attendances = await supabase
  .from('attendances')
  .select('*')
  .in('meeting_id', meetingIds)

// 2. Fetch ALL students (no filter)
const students = await supabase
  .from('students')
  .select('*')
  .order('last_name') // ✅ All students!
```

---

## 📊 Comparison: Toggle OFF vs ON

### Scenario: 500 mahasiswa di database, 3 events, 65 yang pernah hadir

**TOGGLE OFF (Default):**
```
┌─────────────────────────────────────────┐
│ REKAP PAGE (65 baris)                  │
│ ┌─────────────────────────────────────┐│
│ │ Dayoh, V.D. │ H  │ L  │ H         ││
│ │ Student 2   │ H  │ L  │ —         ││
│ │ Student 3   │ L  │ H  │ H         ││
│ │ ... 62 more rows                   ││
│ └─────────────────────────────────────┘│
│ 65 mahasiswa — 3 event                 │
│ Hanya menampilkan mahasiswa yang       │
│ memiliki data kehadiran                │
└─────────────────────────────────────────┘
```

**TOGGLE ON:**
```
┌─────────────────────────────────────────┐
│ REKAP PAGE (500 baris)                 │
│ ┌─────────────────────────────────────┐│
│ │ Dayoh, V.D. │ H  │ L  │ H         ││
│ │ Student 2   │ H  │ L  │ —         ││
│ │ Student 3   │ L  │ H  │ H         ││
│ │ ... 62 more with data ...          ││
│ │ Student 66  │ —  │ —  │ —         ││ ← Tidak pernah hadir
│ │ Student 67  │ —  │ —  │ —         ││ ← Tidak pernah hadir
│ │ ... 433 more never attended ...    ││
│ └─────────────────────────────────────┘│
│ 500 mahasiswa — 3 event                │
│ Menampilkan semua mahasiswa termasuk   │
│ yang tidak pernah hadir                │
└─────────────────────────────────────────┘
```

---

## 🎯 Use Cases

### Use Case 1: Export Mahasiswa Tidak Hadir

**Tujuan:** Identifikasi mahasiswa yang tidak pernah hadir untuk follow-up

**Steps:**
1. Buka halaman **Rekap & Export**
2. Pilih event yang ingin dicek (misalnya: semua Chapel event)
3. **Toggle ON** "Tampilkan semua mahasiswa"
4. Export ke Excel
5. Filter Excel: Cari baris dengan semua kolom "—" atau "X"

**Result:** Daftar mahasiswa yang 0% kehadiran

---

### Use Case 2: Laporan Lengkap untuk Administrasi

**Tujuan:** Export daftar lengkap semua mahasiswa dengan attendance record

**Steps:**
1. Buka halaman **Rekap & Export**
2. Pilih filter: "Semua Tipe" + "Aktif & Ditutup"
3. **Toggle ON** "Tampilkan semua mahasiswa"
4. Export ke PDF/Excel

**Result:** Laporan lengkap dengan semua mahasiswa (hadir maupun tidak)

---

### Use Case 3: Monitoring Real-time (Default)

**Tujuan:** Melihat siapa saja yang sudah hadir hari ini

**Steps:**
1. Buka halaman **Rekap & Export**
2. **Toggle OFF** (default)
3. Data hanya menampilkan yang sudah scan

**Result:** List clean tanpa baris kosong, fokus pada yang hadir

---

## 📈 Performance Impact

### Query Performance

**Toggle OFF (Fast):**
```
- Fetch attendances: ~150 rows
- Fetch students: 65 rows
- Total: 215 rows
- Time: ~0.5 seconds
```

**Toggle ON (Slower, but acceptable):**
```
- Fetch attendances: ~150 rows
- Fetch students: 500 rows
- Total: 650 rows
- Time: ~1-2 seconds
```

### Memory Usage

**Toggle OFF:**
```
- Student objects: 65 × ~2KB = ~130KB
- Pivot cells: 195 cells
- Total: ~225KB
```

**Toggle ON:**
```
- Student objects: 500 × ~2KB = ~1MB
- Pivot cells: 1500 cells
- Total: ~1.2MB
```

### Export File Size

**Toggle OFF:**
```
Excel: ~50KB (65 rows × 20 columns)
PDF: ~100KB
CSV: ~30KB
```

**Toggle ON:**
```
Excel: ~400KB (500 rows × 20 columns)
PDF: ~800KB
CSV: ~200KB
```

---

## 🎨 UI Changes

### Filter Area (NEW)

```
Before:
┌──────────────────────────────────────────────┐
│ [Search...] [Event Type ▼] [Status ▼]       │
└──────────────────────────────────────────────┘

After:
┌──────────────────────────────────────────────┐
│ [Search...] [Event Type ▼] [Status ▼]       │
│ [ ✓ ] Tampilkan semua mahasiswa  ← NEW!     │
└──────────────────────────────────────────────┘
```

### CardHeader Subtitle (DYNAMIC)

```
Toggle OFF:
"Hanya menampilkan mahasiswa yang memiliki data kehadiran di event yang dipilih"

Toggle ON:
"Menampilkan semua mahasiswa (termasuk yang tidak pernah hadir)"
```

---

## 💡 Tips Penggunaan

### Tip 1: Filter Mahasiswa Tidak Hadir di Excel

Setelah export dengan toggle ON:
1. Buka file Excel
2. Pilih kolom event
3. Filter: `"—"` atau kosong
4. Result: List mahasiswa yang tidak hadir

### Tip 2: Kombinasi dengan Filter Event

Toggle bekerja dengan filter event:
- Filter "Chapel" + Toggle ON = Semua mahasiswa vs Chapel attendance
- Filter "Faculty Day" + Toggle ON = Semua mahasiswa vs FacDay attendance

### Tip 3: Export untuk Berbagai Keperluan

**Toggle OFF → Export:**
- Untuk laporan internal (fokus pada yang hadir)
- Untuk dokumentasi event
- Untuk analisis kehadiran per event

**Toggle ON → Export:**
- Untuk follow-up mahasiswa tidak hadir
- Untuk laporan lengkap administrasi
- Untuk cross-check dengan daftar mahasiswa resmi

---

## 🔧 Technical Implementation

### State Management

```typescript
const [showAllStudents, setShowAllStudents] = useState(false)
```

### Conditional Query

```typescript
let studs: any[] = []

if (showAllStudents) {
  // Fetch ALL students
  const { data: allStudents } = await supabase
    .from('students')
    .select('id, no_regis, first_name, last_name, major, status')
    .order('last_name')
  studs = allStudents ?? []
} else {
  // Fetch ONLY students with attendance
  const uniqueStudentIds = [...new Set(attendances.map(a => a.student_id))]
  const { data: attendedStudents } = await supabase
    .from('students')
    .select('id, no_regis, first_name, last_name, major, status')
    .in('id', uniqueStudentIds)
    .order('last_name')
  studs = attendedStudents ?? []
}
```

### UI Component

```tsx
<div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-background">
  <Switch 
    id="show-all-students" 
    checked={showAllStudents} 
    onCheckedChange={setShowAllStudents}
  />
  <Label htmlFor="show-all-students" className="text-sm cursor-pointer">
    Tampilkan semua mahasiswa
  </Label>
</div>
```

---

## ⚠️ Important Notes

1. **Default is OFF**: Toggle default OFF untuk performance optimal
2. **Large Data Warning**: Jika 1000+ mahasiswa, toggle ON bisa lambat (~3-5 detik)
3. **Export Size**: File export dengan toggle ON bisa besar (>1MB)
4. **Empty Rows**: Toggle ON akan menampilkan banyak baris dengan "—" (normal)

---

## 🎓 Summary

| Feature | Toggle OFF | Toggle ON |
|---------|------------|-----------|
| **Rows Displayed** | Only with attendance | ALL students |
| **Performance** | Fast (~0.5s) | Slower (~1-2s) |
| **File Size** | Small (~50KB) | Large (~400KB) |
| **Use Case** | Daily monitoring | Full report |
| **Empty Cells** | Minimal | Many (expected) |

---

## 📦 Files Modified

1. `app/(dashboard)/rekap/page.tsx`
   - Added `showAllStudents` state
   - Added conditional query logic
   - Added toggle UI component
   - Updated CardHeader subtitle (dynamic)

---

## ✅ Result

**User sekarang bisa:**
- ✅ Export **hanya yang hadir** (toggle OFF)
- ✅ Export **semua mahasiswa termasuk yang tidak hadir** (toggle ON)
- ✅ Switch dengan mudah antara 2 mode
- ✅ Identifikasi mahasiswa dengan 0% kehadiran
- ✅ Generate laporan lengkap untuk administrasi

**No breaking changes!** Default behavior tetap sama (toggle OFF).

---

**Last Updated:** 2026-09-04  
**Version:** 1.2.0  
**Status:** ✅ Deployed
