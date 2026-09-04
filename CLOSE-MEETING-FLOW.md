# 📋 Flow: Close Meeting → Data Muncul di Rekap

## 🎯 Objective

Memastikan bahwa ketika event di-close, **semua hasil scan presensi otomatis muncul di Rekap & Export**.

---

## ✅ Current System Status

**Good News:** Sistem **SUDAH BEKERJA DENGAN BENAR!** 🎉

Flow sudah terimplementasi dengan baik:
1. ✅ Scan presensi → Data masuk ke `attendances` table
2. ✅ Close meeting → Generate `TIDAK_HADIR` untuk yang belum scan
3. ✅ Status meeting berubah ke `DITUTUP`
4. ✅ Rekap page otomatis query meeting dengan status `DITUTUP`
5. ✅ Data scan muncul di rekap

---

## 🔄 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: MAHASISWA SCAN PRESENSI                             │
├─────────────────────────────────────────────────────────────┤
│ 1. Mahasiswa scan QR code                                   │
│ 2. POST /api/scan                                           │
│ 3. Validasi meeting AKTIF                                   │
│ 4. INSERT ke attendances table:                             │
│    - student_id                                             │
│    - meeting_id                                             │
│    - status: HADIR / LATE                                   │
│    - waktu_scan: timestamp                                  │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: DATA MUNCUL DI HALAMAN PRESENSI (REAL-TIME)        │
├─────────────────────────────────────────────────────────────┤
│ 1. Halaman presensi subscribe ke Supabase Realtime         │
│ 2. Setiap INSERT attendance, UI auto-update                 │
│ 3. Filter: HANYA tampilkan HADIR dan LATE                  │
│ 4. Count total: hadir + late                                │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: ADMIN TUTUP EVENT (CLOSE MEETING)                  │
├─────────────────────────────────────────────────────────────┤
│ 1. Admin klik "Tutup Event" di halaman Presensi            │
│ 2. POST /api/meetings/[meetingId]/close                    │
│ 3. Call lib/meetings.ts → closeMeeting()                   │
│                                                             │
│ PROSES CLOSE MEETING:                                       │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ a. Cek status meeting (harus AKTIF)                 │   │
│ │ b. Ambil daftar mahasiswa yang seharusnya hadir:    │   │
│ │    - Jika ada absenter_group: ambil dari group      │   │
│ │    - Jika tidak: ambil dari student_sections        │   │
│ │    - Fallback: ambil semua students                 │   │
│ │                                                      │   │
│ │ c. Ambil yang sudah scan (SELECT from attendances)  │   │
│ │                                                      │   │
│ │ d. Generate TIDAK_HADIR:                            │   │
│ │    - Compare: who should attend vs who scanned      │   │
│ │    - INSERT missing students dengan:                │   │
│ │      * status: 'TIDAK_HADIR'                        │   │
│ │      * waktu_scan: null                             │   │
│ │                                                      │   │
│ │ e. UPDATE meeting status:                           │   │
│ │    - status = 'DITUTUP'                             │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                             │
│ 4. Return: { success: true, absent_inserted: N }            │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: DATA MUNCUL DI REKAP & EXPORT                      │
├─────────────────────────────────────────────────────────────┤
│ 1. User buka halaman Rekap                                 │
│ 2. Filter default: status = 'AKTIF' atau 'DITUTUP'         │
│    ✅ Meeting yang baru di-close otomatis muncul!          │
│                                                             │
│ 3. Query attendances untuk meeting yang di-filter:         │
│    - Ambil semua attendance (HADIR, LATE, TIDAK_HADIR)     │
│                                                             │
│ 4. Build pivot table:                                      │
│    - Row: Students (yang punya attendance)                 │
│    - Column: Meetings                                      │
│    - Cell: Status (H / L / X / —)                          │
│                                                             │
│ 5. Display di table + Export Excel/CSV/PDF                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow Example

### Scenario: Event "Chapel INDOSAT" dengan 100 mahasiswa enrolled

**SEBELUM CLOSE:**
```
MEETINGS TABLE:
┌────────────┬─────────────────┬──────────┐
│ id         │ nama_event      │ status   │
├────────────┼─────────────────┼──────────┤
│ meeting-1  │ Chapel INDOSAT  │ AKTIF    │
└────────────┴─────────────────┴──────────┘

ATTENDANCES TABLE:
┌────────────┬────────────┬────────┬───────────┐
│ student_id │ meeting_id │ status │ waktu_scan│
├────────────┼────────────┼────────┼───────────┤
│ student-1  │ meeting-1  │ HADIR  │ 08:05:12  │
│ student-2  │ meeting-1  │ LATE   │ 08:17:45  │
│ student-3  │ meeting-1  │ HADIR  │ 08:03:01  │
│ ... (65 rows total)                          │
└────────────┴────────────┴────────┴───────────┘

REKAP PAGE:
❌ Meeting tidak muncul (filter default: AKTIF & DITUTUP)
   Karena status masih AKTIF, ini optional untuk ditampilkan.
```

**SAAT DI-CLOSE:**
```
1. closeMeeting(meeting-1) dipanggil
2. Proses:
   - Enrolled: 100 mahasiswa
   - Already scanned: 65 mahasiswa
   - Missing: 35 mahasiswa

3. Generate TIDAK_HADIR untuk 35 mahasiswa:
   INSERT INTO attendances (student_id, meeting_id, status, waktu_scan)
   VALUES
     (student-66, meeting-1, 'TIDAK_HADIR', null),
     (student-67, meeting-1, 'TIDAK_HADIR', null),
     ...
     (student-100, meeting-1, 'TIDAK_HADIR', null)

4. Update meeting status:
   UPDATE meetings 
   SET status = 'DITUTUP' 
   WHERE id = meeting-1
```

**SETELAH CLOSE:**
```
MEETINGS TABLE:
┌────────────┬─────────────────┬──────────┐
│ id         │ nama_event      │ status   │
├────────────┼─────────────────┼──────────┤
│ meeting-1  │ Chapel INDOSAT  │ DITUTUP  │ ← Changed!
└────────────┴─────────────────┴──────────┘

ATTENDANCES TABLE:
┌────────────┬────────────┬────────────────┬───────────┐
│ student_id │ meeting_id │ status         │ waktu_scan│
├────────────┼────────────┼────────────────┼───────────┤
│ student-1  │ meeting-1  │ HADIR          │ 08:05:12  │
│ student-2  │ meeting-1  │ LATE           │ 08:17:45  │
│ student-3  │ meeting-1  │ HADIR          │ 08:03:01  │
│ ... (65 rows with HADIR/LATE)                        │
│ student-66 │ meeting-1  │ TIDAK_HADIR    │ null      │ ← NEW!
│ student-67 │ meeting-1  │ TIDAK_HADIR    │ null      │ ← NEW!
│ ... (35 rows with TIDAK_HADIR)                       │
└────────────┴────────────┴────────────────┴───────────┘

REKAP PAGE:
✅ Meeting muncul otomatis!
✅ Data lengkap 100 mahasiswa:
   - 65 dengan status HADIR/LATE (punya waktu_scan)
   - 35 dengan status TIDAK_HADIR (waktu_scan = null)
```

---

## ✅ Verification Checklist

Untuk memastikan flow bekerja dengan benar, cek:

### **1. Filter Status di Rekap**
```
Default: [Aktif & Ditutup ▼]
✅ Meeting dengan status DITUTUP akan muncul
✅ Tidak perlu ubah filter
```

### **2. Data Attendance Lengkap**
```sql
-- Query untuk verify:
SELECT 
  m.nama_event,
  m.status,
  COUNT(CASE WHEN a.status = 'HADIR' THEN 1 END) as hadir,
  COUNT(CASE WHEN a.status = 'LATE' THEN 1 END) as late,
  COUNT(CASE WHEN a.status = 'TIDAK_HADIR' THEN 1 END) as tidak_hadir,
  COUNT(*) as total
FROM meetings m
LEFT JOIN attendances a ON m.id = a.meeting_id
WHERE m.status = 'DITUTUP'
GROUP BY m.id, m.nama_event, m.status;
```

Expected Result:
```
nama_event      | status  | hadir | late | tidak_hadir | total
----------------|---------|-------|------|-------------|------
Chapel INDOSAT  | DITUTUP | 65    | 0    | 35          | 100
```

### **3. Toggle State di Rekap**

**Toggle OFF (Default):**
```
Menampilkan: Hanya 100 mahasiswa yang punya attendance
Result: Semua 100 mahasiswa muncul
  - 65 dengan H/L
  - 35 dengan X (tidak hadir)
```

**Toggle ON:**
```
Menampilkan: Semua mahasiswa di database
Result: Bisa >100 jika ada mahasiswa lain yang tidak enrolled
```

---

## 🎯 Expected Behavior

### **Case 1: Meeting Aktif (Belum Di-close)**
```
Status: AKTIF
Rekap: Meeting muncul (optional, bisa di-filter)
Data: Hanya yang sudah scan (HADIR, LATE)
Count: Incomplete (hanya yang scan)
```

### **Case 2: Meeting Di-close**
```
Status: DITUTUP
Rekap: Meeting PASTI muncul (filter default)
Data: Lengkap (HADIR, LATE, TIDAK_HADIR)
Count: Complete (semua enrolled students)
Export: Ready untuk export laporan final
```

### **Case 3: Meeting Archived**
```
Status: ARCHIVED
Rekap: Tidak muncul di filter default
Data: Lengkap (preserved)
Filter: Pilih "Arsip" untuk melihat
```

---

## 🚀 User Guide: Workflow yang Benar

### **Untuk Admin Event:**

**1. Buat Event**
```
Status: DRAFT → AKTIF
Action: Generate QR code + PIN
```

**2. Selama Event Berlangsung**
```
Status: AKTIF
Monitor: Halaman Presensi (real-time)
Action: Mahasiswa scan presensi
```

**3. Tutup Event Setelah Selesai**
```
Status: AKTIF → DITUTUP
Action: Klik "Tutup Event"
Result:
  - Generate TIDAK_HADIR untuk yang tidak scan
  - Meeting locked (tidak bisa scan lagi)
  - Data final tersimpan
```

**4. Lihat Rekap & Export**
```
Status: DITUTUP
Action: Buka halaman Rekap
Result:
  - Meeting otomatis muncul
  - Data lengkap 100% enrolled students
  - Ready untuk export Excel/PDF
```

---

## 🐛 Troubleshooting

### **Problem 1: Meeting tidak muncul di Rekap setelah di-close**

**Possible Causes:**
1. ❌ Filter status bukan "Aktif & Ditutup"
2. ❌ Filter tipe event tidak match
3. ❌ Meeting bukan di semester aktif
4. ❌ Browser cache

**Solutions:**
```
1. Cek filter: Pastikan "Aktif & Ditutup" atau "Semua"
2. Cek semester: Pastikan meeting di semester yang aktif
3. Refresh page: Hard refresh (Ctrl+Shift+R)
4. Check database: Verify status = 'DITUTUP'
```

---

### **Problem 2: Data attendance tidak lengkap**

**Possible Causes:**
1. ❌ Meeting di-close saat masih DRAFT (skip AKTIF)
2. ❌ Absenter group tidak terisi dengan benar
3. ❌ Student sections kosong

**Solutions:**
```
1. Verify meeting flow: DRAFT → AKTIF → DITUTUP
2. Check absenter_group_members table
3. Check student_sections table
4. Verify enrolled students count
```

---

### **Problem 3: Toggle "Tampilkan semua mahasiswa" menampilkan terlalu banyak**

**Expected Behavior:**
```
Toggle OFF: Hanya enrolled students yang punya attendance
Toggle ON: SEMUA students di database

Jika enrolled = 100 tapi toggle ON menampilkan 500:
✅ Normal! Itu semua mahasiswa di database.
```

**Solutions:**
```
Use toggle OFF untuk laporan event-specific
Use toggle ON untuk cross-check dengan daftar lengkap
```

---

## 📋 SQL Queries untuk Debugging

### **1. Check Meeting Status**
```sql
SELECT id, nama_event, status, tanggal, created_at
FROM meetings
WHERE nama_event ILIKE '%your event name%'
ORDER BY created_at DESC;
```

### **2. Check Attendance Count**
```sql
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'HADIR' THEN 1 END) as hadir,
  COUNT(CASE WHEN status = 'LATE' THEN 1 END) as late,
  COUNT(CASE WHEN status = 'TIDAK_HADIR' THEN 1 END) as tidak_hadir
FROM attendances
WHERE meeting_id = 'your-meeting-id';
```

### **3. Check Missing Attendance**
```sql
-- Students who should attend but have no attendance record:
SELECT s.no_regis, s.first_name, s.last_name
FROM students s
INNER JOIN student_sections ss ON s.id = ss.student_id
LEFT JOIN attendances a ON s.id = a.student_id AND a.meeting_id = 'your-meeting-id'
WHERE ss.semester_id = 'your-semester-id'
  AND a.id IS NULL;
```

---

## ✅ Summary

### **Flow SUDAH BEKERJA dengan benar:**
1. ✅ Scan → Data masuk `attendances`
2. ✅ Close → Generate `TIDAK_HADIR` + Update status `DITUTUP`
3. ✅ Rekap → Query meeting `DITUTUP` + Show all attendance
4. ✅ Export → Data lengkap ready

### **Yang perlu dipastikan:**
1. ✅ Filter status di rekap: "Aktif & Ditutup" (default)
2. ✅ Meeting flow: DRAFT → AKTIF → DITUTUP (jangan skip)
3. ✅ Enrolled students sudah setup (absenter_group / student_sections)

### **Tidak perlu perbaikan code:**
✅ Sistem sudah bekerja sesuai harapan!

---

**Last Updated:** 2026-09-04  
**Status:** ✅ **WORKING AS EXPECTED**  
**Action Required:** 📝 **Follow correct workflow**
