-- DEBUG SCRIPT: Cek Data Kehadiran yang Tidak Muncul di Rekap
-- Jalankan script ini di Supabase SQL Editor

-- 1. CEK STATUS MEETING "Chapel INDOSAT Tri x Gemini"
SELECT 
  id,
  nama_event,
  status,
  tanggal,
  start_time,
  end_time,
  event_type
FROM meetings 
WHERE nama_event ILIKE '%Chapel INDOSAT%'
   OR nama_event ILIKE '%Tri x Gemini%'
ORDER BY tanggal DESC;

-- 2. CEK APAKAH MAHASISWA "Dayoh, Vallerian Dava" ADA DI TABLE STUDENTS
SELECT 
  id,
  no_regis,
  first_name,
  last_name,
  major,
  status
FROM students 
WHERE last_name ILIKE '%Dayoh%' 
   OR first_name ILIKE '%Vallerian%'
   OR first_name ILIKE '%Dava%';

-- 3. CEK ATTENDANCE DATA UNTUK MAHASISWA TERSEBUT
SELECT 
  a.id as attendance_id,
  a.status as attendance_status,
  a.waktu_scan,
  s.no_regis,
  s.first_name,
  s.last_name,
  m.nama_event,
  m.status as meeting_status,
  m.tanggal,
  m.end_time
FROM attendances a
JOIN students s ON a.student_id = s.id
JOIN meetings m ON a.meeting_id = m.id
WHERE (s.last_name ILIKE '%Dayoh%' OR s.first_name ILIKE '%Vallerian%')
  AND (m.nama_event ILIKE '%Chapel INDOSAT%' OR m.nama_event ILIKE '%Tri x Gemini%')
ORDER BY a.waktu_scan DESC;

-- 4. CEK SEMUA ATTENDANCE UNTUK MEETING "Chapel INDOSAT Tri x Gemini"
SELECT 
  m.nama_event,
  m.status as meeting_status,
  COUNT(*) as total_attendance,
  COUNT(CASE WHEN a.status = 'HADIR' THEN 1 END) as hadir,
  COUNT(CASE WHEN a.status = 'LATE' THEN 1 END) as late,
  COUNT(CASE WHEN a.status = 'TIDAK_HADIR' THEN 1 END) as tidak_hadir
FROM meetings m
LEFT JOIN attendances a ON m.id = a.meeting_id
WHERE m.nama_event ILIKE '%Chapel INDOSAT%' OR m.nama_event ILIKE '%Tri x Gemini%'
GROUP BY m.id, m.nama_event, m.status;

-- 5. CEK APAKAH ADA DUPLICATE DATA (SEHARUSNYA TIDAK ADA)
SELECT 
  student_id,
  meeting_id,
  COUNT(*) as count
FROM attendances
GROUP BY student_id, meeting_id
HAVING COUNT(*) > 1;
