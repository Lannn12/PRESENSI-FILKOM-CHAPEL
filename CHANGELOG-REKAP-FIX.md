# Changelog: Perbaikan Halaman Rekap & Export

## 🎯 Masalah yang Diperbaiki

**Issue:** Halaman Rekap menampilkan SEMUA mahasiswa dari database, bahkan yang tidak pernah ikut event yang dipilih. Ini menyebabkan:
- Tabel rekap terlalu besar dan penuh dengan baris kosong (simbol "—")
- Data tidak sinkron dengan halaman Presensi
- Export file berisi ribuan baris kosong yang tidak relevan
- Mahasiswa yang sudah hadir di event tidak muncul karena meeting status filter

## ✅ Solusi yang Diimplementasikan

### 1. **Query Logic Diperbaiki**

**SEBELUM:**
```typescript
// Ambil SEMUA mahasiswa dari database
const { data: studs } = await supabase
  .from('students')
  .select('id, no_regis, first_name, last_name, major, status')
  .order('last_name')

// Ambil attendance untuk meeting yang dipilih
const { data: atts } = await supabase
  .from('attendances')
  .select('student_id, meeting_id, status')
  .in('meeting_id', meetingIds)
```
**Masalah:** Query mengambil semua mahasiswa terlebih dahulu (bisa ratusan/ribuan), lalu baru mapping dengan attendance. Hasilnya banyak baris kosong.

---

**SETELAH:**
```typescript
// 1. Ambil attendance untuk meeting yang dipilih
const { data: atts } = await supabase
  .from('attendances')
  .select('student_id, meeting_id, status')
  .in('meeting_id', meetingIds)

// 2. Extract unique student_id yang ada di attendance
const uniqueStudentIds = [...new Set((atts ?? []).map((a) => a.student_id))]

// 3. Ambil HANYA mahasiswa yang ada attendance-nya
const { data: studs } = await supabase
  .from('students')
  .select('id, no_regis, first_name, last_name, major, status')
  .in('id', uniqueStudentIds)  // ✅ Filter berdasarkan student_id
  .order('last_name')
```
**Solusi:** Query attendance dulu, lalu ambil data mahasiswa HANYA untuk yang ada attendance-nya. Tidak ada baris kosong!

---

### 2. **Filter Status Meeting Diperjelas**

**SEBELUM:**
```typescript
// Filter label misleading
<SelectItem value="ALL">Semua Status</SelectItem>  // ❌ Sebenarnya hanya AKTIF & DITUTUP!
```

**SETELAH:**
```typescript
// Filter label jelas dan ada opsi baru
<SelectItem value="ALL">Aktif & Ditutup</SelectItem>        // Default
<SelectItem value="AKTIF">Aktif</SelectItem>
<SelectItem value="DITUTUP">Ditutup</SelectItem>
<SelectItem value="ARCHIVED">Arsip</SelectItem>
<SelectItem value="SEMUA">🔍 Semua (termasuk Draft)</SelectItem>  // ✅ NEW!
```

---

### 3. **Warning Notification untuk Meeting Tersembunyi**

**Ditambahkan:**
- Toast notification jika ada event yang ter-filter
- Visual indicator di header halaman menunjukkan jumlah event tersembunyi
- Message di empty state yang lebih informatif

---

### 4. **UI Improvements**

**Ditambahkan:**
- Subtitle di CardHeader: "Hanya menampilkan mahasiswa yang memiliki data kehadiran di event yang dipilih"
- Empty state lebih informatif: "Mahasiswa akan muncul di rekap setelah melakukan scan di salah satu event yang dipilih"
- Debug info showing: `{displayRows.length} mahasiswa — {meetings.length} event`

---

## 📊 Perbandingan Sebelum & Sesudah

### Skenario: Event "Chapel INDOSAT Tri x Gemini" dengan 50 mahasiswa hadir

**SEBELUM:**
- Query mengambil: 500 mahasiswa (semua di database)
- Rekap menampilkan: 500 baris (450 baris dengan simbol "—")
- Export Excel: 500 baris
- Status: Dayoh, Vallerian Dava tidak muncul karena meeting berstatus DRAFT

**SETELAH:**
- Query mengambil: 50 mahasiswa (hanya yang ada attendance)
- Rekap menampilkan: 50 baris (semua relevan)
- Export Excel: 50 baris
- Status: Dayoh, Vallerian Dava muncul setelah filter diubah ke "🔍 Semua (termasuk Draft)"

---

## 🚀 Benefits

1. **Performance:** Query lebih cepat karena hanya fetch data yang relevan
2. **UX:** Tabel lebih bersih, tidak ada baris kosong
3. **Export:** File export lebih kecil dan relevan
4. **Data Accuracy:** 100% sinkron dengan halaman Presensi
5. **Clarity:** Filter lebih jelas dan tidak misleading

---

## 🛠️ Files Modified

1. `app/(dashboard)/rekap/page.tsx`
   - Refactored query logic (line 96-135)
   - Added debug info state
   - Improved filter labels
   - Added warning notifications
   - Better empty states

2. `app/api/debug/rekap/route.ts` (NEW)
   - Debug endpoint untuk troubleshooting

3. `debug-rekap.sql` (NEW)
   - SQL queries untuk manual debugging

---

## 📝 Migration Notes

**Tidak ada breaking changes!** Semua perubahan backward compatible.

**Cara Menggunakan:**
1. Default behavior tetap sama: menampilkan meeting AKTIF & DITUTUP
2. Untuk melihat semua meeting termasuk DRAFT: pilih filter "🔍 Semua (termasuk Draft)"
3. Rekap sekarang hanya menampilkan mahasiswa yang punya attendance data (lebih efisien)

---

## 🧪 Testing

**Test Case 1: Meeting dengan 100 mahasiswa hadir**
- ✅ Rekap menampilkan 100 baris (bukan 500+)
- ✅ Export hanya 100 baris
- ✅ Semua data sinkron dengan halaman Presensi

**Test Case 2: Meeting DRAFT tidak muncul**
- ✅ Filter default tidak menampilkan meeting DRAFT
- ✅ Warning notification muncul: "⚠️ X event tidak ditampilkan karena filter status"
- ✅ Setelah ubah filter ke "Semua (termasuk Draft)", meeting muncul

**Test Case 3: Meeting belum ada yang scan**
- ✅ Empty state informatif: "Tidak ada data kehadiran untuk ditampilkan"
- ✅ Tidak ada error atau crash

---

## 🎓 Developer Notes

**Query Optimization Pattern:**
```typescript
// ❌ BAD: Fetch all then filter
const allUsers = await db.users.findAll()
const activeUsers = allUsers.filter(u => u.active)

// ✅ GOOD: Filter at database level
const activeUsers = await db.users.findAll({ where: { active: true } })
```

**Applied to Rekap:**
```typescript
// ❌ BAD: Fetch all students, most rows will be empty
const allStudents = await supabase.from('students').select('*')
const attendances = await supabase.from('attendances').select('*')
// Build pivot with many empty cells

// ✅ GOOD: Fetch only students with attendance
const attendances = await supabase.from('attendances').select('*')
const studentIds = [...new Set(attendances.map(a => a.student_id))]
const students = await supabase.from('students').select('*').in('id', studentIds)
// Build pivot with relevant data only
```

---

## 📌 Future Improvements

1. **Add pagination** untuk rekap dengan ribuan mahasiswa
2. **Add column visibility toggle** untuk hide/show specific meetings
3. **Add filter by student status** (AKTIF vs MAGANG)
4. **Add sort by attendance percentage** (most absent first)
5. **Add bulk edit mode** untuk update multiple cells sekaligus

---

## 🐛 Known Issues

None reported after this fix.

---

## 📞 Support

Jika masih ada masalah:
1. Gunakan debug endpoint: `http://localhost:3000/api/debug/rekap?student_name=<name>&meeting_name=<event>`
2. Jalankan SQL script: `debug-rekap.sql` di Supabase SQL Editor
3. Check filter status meeting di halaman Rekap

---

**Last Updated:** 2026-09-04  
**Version:** 1.1.0  
**Status:** ✅ Deployed & Tested
