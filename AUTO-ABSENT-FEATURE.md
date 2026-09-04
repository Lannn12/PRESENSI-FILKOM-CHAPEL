# ✅ Auto-Absent Feature: Yang Tidak Scan = Auto TIDAK_HADIR

## 🎯 Feature Overview

**Pertanyaan:** "Bisakah ketika sudah di-close dan jika nama yang tidak di scan presensinya maka langsung auto absen?"

**Jawaban:** ✅ **SUDAH BISA! Fitur ini SUDAH TERIMPLEMENTASI!**

Ketika event di-close, sistem **otomatis** membuat record attendance dengan status `TIDAK_HADIR` untuk semua mahasiswa yang **tidak scan**.

---

## 🔄 How It Works

### **Visual Flow:**

```
┌─────────────────────────────────────────────────────────┐
│ EVENT: Chapel INDOSAT                                   │
│ ENROLLED: 100 mahasiswa                                 │
│ STATUS: AKTIF                                           │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ MAHASISWA SCAN PRESENSI                                 │
├─────────────────────────────────────────────────────────┤
│ Student 1  → Scan 08:05 → ✅ HADIR                     │
│ Student 2  → Scan 08:17 → ✅ LATE                      │
│ Student 3  → Scan 08:03 → ✅ HADIR                     │
│ ...                                                     │
│ Student 65 → Scan 08:45 → ✅ LATE                      │
│                                                         │
│ Total yang scan: 65 mahasiswa                           │
│ Yang tidak scan: 35 mahasiswa ❌                       │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ ADMIN KLIK "TUTUP EVENT"                                │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ SYSTEM AUTO-PROCESS (lib/meetings.ts)                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 1️⃣ AMBIL DAFTAR ENROLLED STUDENTS                      │
│    Query: absenter_group / student_sections / all      │
│    Result: 100 mahasiswa                                │
│                                                         │
│ 2️⃣ AMBIL YANG SUDAH SCAN                               │
│    Query: attendances WHERE meeting_id = X             │
│    Result: 65 mahasiswa                                 │
│                                                         │
│ 3️⃣ COMPARE & FIND MISSING                              │
│    Missing = Enrolled - Already Scanned                │
│    Result: 35 mahasiswa yang TIDAK scan                 │
│                                                         │
│ 4️⃣ AUTO-GENERATE TIDAK_HADIR ⚡                        │
│    INSERT INTO attendances:                            │
│    ┌─────────────────────────────────────────────┐    │
│    │ student_id: student-66                      │    │
│    │ meeting_id: meeting-1                       │    │
│    │ status: 'TIDAK_HADIR'         ← AUTO!      │    │
│    │ waktu_scan: null                            │    │
│    └─────────────────────────────────────────────┘    │
│    ... (35 records auto-created)                       │
│                                                         │
│ 5️⃣ UPDATE MEETING STATUS                               │
│    UPDATE meetings SET status = 'DITUTUP'              │
│                                                         │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ RESULT: ATTENDANCE TABLE                                │
├─────────────────────────────────────────────────────────┤
│ ✅ 65 records: HADIR/LATE (punya waktu_scan)           │
│ ✅ 35 records: TIDAK_HADIR (auto-generated) ← NEW!     │
│ ✅ Total: 100 records (complete!)                       │
└─────────────────────────────────────────────────────────┘
```

---

## 💻 **Code Implementation**

### **File:** `lib/meetings.ts`

```typescript
export async function closeMeeting(meetingId: string) {
  const supabase = await createServiceClient()

  // 1. Verify meeting exists and get details
  const { data: meeting } = await supabase
    .from('meetings')
    .select('id, status, semester_id, absenter_group_id')
    .eq('id', meetingId)
    .single()

  if (meeting.status === 'DITUTUP') {
    return { success: true, message: 'Already closed.' }
  }

  // 2. Determine target students (who should attend)
  let studentIds: string[] = []
  
  if (meeting.absenter_group_id) {
    // From specific absenter group
    const { data: members } = await supabase
      .from('absenter_group_members')
      .select('student_id')
      .eq('group_id', meeting.absenter_group_id)
    studentIds = (members ?? []).map(m => m.student_id)
  } else {
    // From all students in semester
    const { data: sections } = await supabase
      .from('student_sections')
      .select('student_id')
      .eq('semester_id', meeting.semester_id)
    
    if (sections && sections.length > 0) {
      studentIds = sections.map(s => s.student_id)
    } else {
      // Fallback: all students
      const { data: all } = await supabase.from('students').select('id')
      studentIds = (all ?? []).map(s => s.id)
    }
  }

  // 3. Get who already attended (scanned)
  const { data: attended } = await supabase
    .from('attendances')
    .select('student_id')
    .eq('meeting_id', meetingId)
  
  const attendedIds = new Set(attended.map(a => a.student_id))

  // 4. 🎯 AUTO-GENERATE TIDAK_HADIR for missing students
  const missing = studentIds.filter(id => !attendedIds.has(id))
  
  if (missing.length > 0) {
    const inserts = missing.map(id => ({
      student_id: id,
      meeting_id: meetingId,
      status: 'TIDAK_HADIR',  // ✅ AUTO ABSENT!
      waktu_scan: null,
    }))

    // Batch insert in chunks of 500
    for (let i = 0; i < inserts.length; i += 500) {
      const { error } = await supabase
        .from('attendances')
        .insert(inserts.slice(i, i + 500))
      
      if (error) throw new Error(`Failed: ${error.message}`)
    }
  }

  // 5. Update meeting status to DITUTUP
  await supabase
    .from('meetings')
    .update({ status: 'DITUTUP' })
    .eq('id', meetingId)

  return { 
    success: true, 
    absent_inserted: missing.length  // 📊 Report how many auto-absent
  }
}
```

---

## 📊 **Real Example**

### **Scenario: Event Chapel dengan 100 mahasiswa enrolled**

**SEBELUM CLOSE:**
```sql
-- Attendance table:
SELECT COUNT(*), status 
FROM attendances 
WHERE meeting_id = 'meeting-1'
GROUP BY status;

Result:
┌───────┬────────┐
│ count │ status │
├───────┼────────┤
│ 60    │ HADIR  │
│ 5     │ LATE   │
└───────┴────────┘
Total: 65 records
Missing: 35 students
```

**SAAT CLOSE (Admin klik "Tutup Event"):**
```
System Processing...
1. Enrolled students: 100
2. Already scanned: 65
3. Missing: 35
4. Auto-generating TIDAK_HADIR for 35 students...
5. Updating meeting status to DITUTUP...
✅ Done!
```

**SETELAH CLOSE:**
```sql
-- Attendance table (auto-updated):
SELECT COUNT(*), status 
FROM attendances 
WHERE meeting_id = 'meeting-1'
GROUP BY status;

Result:
┌───────┬──────────────┐
│ count │ status       │
├───────┼──────────────┤
│ 60    │ HADIR        │
│ 5     │ LATE         │
│ 35    │ TIDAK_HADIR  │ ← AUTO-GENERATED! ✅
└───────┴──────────────┘
Total: 100 records (COMPLETE!)
```

**DI REKAP:**
```
Chapel INDOSAT (2026-09-04) [Ditutup]
┌────────────────────┬──────────┐
│ Nama               │ Status   │
├────────────────────┼──────────┤
│ Dayoh, V.D.        │ H        │ ← Scan 08:05
│ Student 2          │ L        │ ← Scan 08:17
│ ... (63 more)                 │
│ Student 66         │ X        │ ← AUTO TIDAK_HADIR
│ Student 67         │ X        │ ← AUTO TIDAK_HADIR
│ ... (33 more)                 │
└────────────────────┴──────────┘
```

---

## 🎯 **User Flow**

### **Admin Perspective:**

```
1. Event sedang berlangsung (STATUS: AKTIF)
   Monitoring: 65/100 mahasiswa sudah scan

2. Event selesai
   Action: Klik "Tutup Event"

3. Konfirmasi muncul:
   ┌─────────────────────────────────────┐
   │ Tutup Event?                        │
   ├─────────────────────────────────────┤
   │ Event akan ditutup dan semua        │
   │ mahasiswa yang belum scan akan      │
   │ otomatis dicatat TIDAK_HADIR.       │
   │                                     │
   │ Tindakan ini tidak dapat dibatalkan.│
   │                                     │
   │ [Batal]  [Tutup & Generate Absen]  │
   └─────────────────────────────────────┘

4. Setelah klik "Tutup & Generate Absen":
   ✅ Processing...
   ✅ Event ditutup
   ✅ 35 mahasiswa dicatat TIDAK_HADIR
   
5. Result di Rekap:
   ✅ Data lengkap 100 mahasiswa
   ✅ 65 HADIR/LATE (yang scan)
   ✅ 35 TIDAK_HADIR (auto-generated)
```

---

## ✅ **Verification Checklist**

### **Cara Verify Fitur Bekerja:**

**1. Check Toast Notification**
```
Setelah close, akan muncul toast:
"Event ditutup. 35 mahasiswa dicatat TIDAK_HADIR."
                 ^^
                 Ini jumlah auto-absent
```

**2. Check Database**
```sql
-- Count attendance by status:
SELECT 
  status,
  COUNT(*) as count,
  COUNT(waktu_scan) as with_timestamp
FROM attendances
WHERE meeting_id = 'your-meeting-id'
GROUP BY status;

Expected:
┌──────────────┬───────┬────────────────┐
│ status       │ count │ with_timestamp │
├──────────────┼───────┼────────────────┤
│ HADIR        │ 60    │ 60             │ ← All have timestamp
│ LATE         │ 5     │ 5              │ ← All have timestamp
│ TIDAK_HADIR  │ 35    │ 0              │ ← None have timestamp (auto!)
└──────────────┴───────┴────────────────┘
```

**3. Check Rekap Page**
```
Filter: [Ditutup ▼]
Result: Meeting muncul dengan data lengkap
- Total rows = Enrolled students
- Rows dengan waktu_scan = Yang scan
- Rows tanpa waktu_scan = Auto-absent
```

---

## 🔍 **Technical Details**

### **Auto-Absent Logic:**

```typescript
// 1. Get enrolled students
const enrolled = [s1, s2, s3, ..., s100]  // 100 IDs

// 2. Get who already scanned
const scanned = [s1, s2, s3, ..., s65]    // 65 IDs

// 3. Find missing (who didn't scan)
const missing = enrolled.filter(id => !scanned.includes(id))
// Result: [s66, s67, ..., s100]  // 35 IDs

// 4. Auto-generate TIDAK_HADIR
missing.forEach(studentId => {
  INSERT INTO attendances (student_id, meeting_id, status, waktu_scan)
  VALUES (studentId, meetingId, 'TIDAK_HADIR', null)
})
```

### **Batch Processing:**

Untuk performance, system insert dalam batch 500 records:
```typescript
// If 1000 students didn't scan:
// Batch 1: Insert 500 records (students 1-500)
// Batch 2: Insert 500 records (students 501-1000)
```

---

## 🎓 **Key Features**

### **1. Automatic**
✅ Tidak perlu manual entry
✅ Tidak ada mahasiswa yang "terlupa"
✅ Data lengkap 100%

### **2. Accurate**
✅ Based on enrolled students (absenter_group / student_sections)
✅ Compare dengan yang sudah scan
✅ Only generate untuk yang missing

### **3. Auditable**
✅ `waktu_scan = null` → Auto-generated
✅ `waktu_scan != null` → Manual scan
✅ Clear distinction antara scan vs auto

### **4. Irreversible (by design)**
✅ Setelah close, tidak bisa scan lagi
✅ Meeting status DITUTUP = locked
✅ Data final tersimpan

---

## 📋 **FAQ**

### **Q: Apakah yang tidak scan bisa ditambahkan manual setelah close?**
A: Ya! Di halaman Rekap, admin bisa:
- Edit status dari X (TIDAK_HADIR) → H (HADIR)
- Edit status dari — (no record) → H (HADIR)
- Edit via dropdown per cell

### **Q: Bagaimana jika ada mahasiswa yang terlambat scan setelah close?**
A: 
1. Admin bisa manual edit di Rekap
2. Atau admin bisa re-open meeting (ubah status DITUTUP → AKTIF)
3. Mahasiswa scan
4. Admin close lagi

### **Q: Apakah auto-absent based on time (end_time)?**
A: Tidak. Auto-absent terjadi saat:
- Admin manual close meeting, ATAU
- CRON job auto-close (jika setup)

Bukan automatic saat end_time terlewat.

### **Q: Bagaimana jika tidak ada yang scan sama sekali?**
A: System tetap generate TIDAK_HADIR untuk semua enrolled students.

Example:
- Enrolled: 100
- Scanned: 0
- Auto-generated: 100 TIDAK_HADIR

---

## ⚠️ **Important Notes**

### **1. Enrolled Students Must Be Setup**
Auto-absent hanya untuk mahasiswa yang terdaftar:
- Via absenter_group, ATAU
- Via student_sections, ATAU
- Fallback: all students

Jika tidak setup, mungkin tidak ada yang di-auto-absent!

### **2. Meeting Flow Harus Benar**
```
✅ DRAFT → AKTIF → (scan) → DITUTUP
   System auto-absent saat DITUTUP

❌ DRAFT → DITUTUP (skip AKTIF)
   No scan happened, all auto-absent
```

### **3. One-Time Operation**
Close meeting adalah one-time:
- Tidak bisa "close" lagi setelah DITUTUP
- Jika perlu re-process, admin harus manual edit

---

## ✅ **Summary**

### **Fitur SUDAH ADA dan BEKERJA:**
✅ Auto-absent untuk yang tidak scan
✅ Trigger saat close meeting
✅ Batch processing untuk performance
✅ Toast notification dengan count
✅ Data lengkap di rekap

### **Tidak perlu develop apapun!**
Fitur **sudah terimplementasi dengan sempurna** di:
- `lib/meetings.ts` (line 44-59)
- `app/api/meetings/[meetingId]/close/route.ts`

### **Yang perlu pastikan:**
1. Enrolled students sudah setup
2. Meeting flow benar (AKTIF sebelum DITUTUP)
3. Admin klik "Tutup Event" setelah event selesai

---

**Last Updated:** 2026-09-04  
**Status:** ✅ **FEATURE ALREADY IMPLEMENTED**  
**Action:** ✅ **USE EXISTING FEATURE**

---

## 🎉 **Kesimpulan**

**Pertanyaan Anda:**
> "Bisakah ketika sudah di-close dan jika nama yang tidak di scan presensinya maka langsung auto absen?"

**Jawaban:**
> ✅ **YA! SUDAH BISA DAN SUDAH DIIMPLEMENTASIKAN!**

Setiap kali event di-close:
1. ✅ System otomatis cek siapa yang tidak scan
2. ✅ Auto-generate record attendance dengan status TIDAK_HADIR
3. ✅ Data lengkap muncul di rekap
4. ✅ Ready untuk export

**Tidak perlu develop fitur baru. Tinggal pakai!** 🚀
