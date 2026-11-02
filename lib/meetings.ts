import { createServiceClient } from '@/lib/supabase/server'

/**
 * Offset timezone untuk seluruh perhitungan waktu meeting.
 *
 * PENTING: semua tempat yang menghitung "sudah lewat end_time?" HARUS memakai
 * helper ini. Sebelumnya `app/api/cron/auto-close` memakai `setHours()` (jam
 * lokal server = UTC di Vercel) sementara `app/api/scan` memakai offset
 * hard-coded +07:00 — hasilnya cron menutup event ~7 jam terlalu awal.
 *
 * Ganti ke '+08:00' (WITA) bila waktu operasional memakai Waktu Indonesia
 * Tengah.
 */
export const MEETING_TIMEZONE_OFFSET = '+07:00'

/**
 * Gabungkan tanggal + jam meeting menjadi satu titik waktu absolut.
 * Mengembalikan null bila input tidak valid atau `time` kosong.
 */
export function getMeetingDateTime(date: string, time: string | null | undefined): Date | null {
  if (!date || !time) return null
  const [h, m, s] = time.split(':').map(Number)
  const hh = String(Number.isFinite(h) ? h : 0).padStart(2, '0')
  const mm = String(Number.isFinite(m) ? m : 0).padStart(2, '0')
  const ss = String(Number.isFinite(s) ? s : 0).padStart(2, '0')
  const d = new Date(`${date}T${hh}:${mm}:${ss}${MEETING_TIMEZONE_OFFSET}`)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Closes a meeting:
 * 1. Finds all students who should have attended (based on absenter group or semester).
 * 2. Marks students who didn't scan as 'TIDAK_HADIR'.
 * 3. Updates meeting status to 'DITUTUP'.
 */
export async function closeMeeting(meetingId: string) {
  const supabase = await createServiceClient()

  // 1. Verify meeting and get details
  const { data: meeting, error: meetErr } = await supabase
    .from('meetings')
    .select('id, status, semester_id, absenter_group_id')
    .eq('id', meetingId)
    .single()

  if (meetErr || !meeting) throw new Error('Meeting not found.')
  if (meeting.status === 'DITUTUP') return { success: true, message: 'Already closed.' }
  if (meeting.status !== 'AKTIF') {
    // Hanya event AKTIF yang bisa ditutup. Tanpa guard ini, event DRAFT akan
    // tetap berstatus DRAFT padahal semua mahasiswa sudah ditulis TIDAK_HADIR.
    throw new Error(`Event tidak berstatus AKTIF (sekarang: ${meeting.status}).`)
  }

  // 2. Determine target students
  let studentIds: string[] = []
  if (meeting.absenter_group_id) {
    // Event pakai absenter group → hanya anggota group tersebut
    const { data: members } = await supabase
      .from('absenter_group_members')
      .select('student_id')
      .eq('group_id', meeting.absenter_group_id)
    studentIds = (members ?? []).map((m: { student_id: string }) => m.student_id)
  } else {
    // Event tanpa absenter group → semua mahasiswa yang ada di DB
    // (student_sections hanya untuk seating, bukan untuk menentukan siapa yang wajib hadir)
    const { data: all } = await supabase.from('students').select('id')
    studentIds = (all ?? []).map((s: { id: string }) => s.id)
  }

  // 3. Get who already attended
  const { data: attended } = await supabase
    .from('attendances')
    .select('student_id')
    .eq('meeting_id', meetingId)
  
  const attendedIds = new Set((attended ?? []).map(a => a.student_id))

  // 4. Update meeting status DULU sebelum insert absensi
  //    Ini memastikan request kedua (race condition) akan return 'Already closed' lebih awal
  const { data: updatedRows, error: updErr } = await supabase
    .from('meetings')
    .update({ status: 'DITUTUP' })
    .eq('id', meetingId)
    .eq('status', 'AKTIF') // hanya update jika masih AKTIF (atomic guard)
    .select('id')

  if (updErr) throw new Error(`Failed to update status: ${updErr.message}`)

  // Guard atomik: kalau tidak ada baris yang berubah, berarti request paralel
  // lain sudah menutup event ini lebih dulu. Jangan lanjut menulis absensi.
  if (!updatedRows || updatedRows.length === 0) {
    return { success: true, message: 'Already closed.', absent_inserted: 0 }
  }

  // 5. Fill in missing attendances as 'TIDAK_HADIR' menggunakan upsert
  //    onConflict: 'student_id,meeting_id' → idempotent, aman jika dipanggil dua kali
  const missing = studentIds.filter(id => !attendedIds.has(id))

  if (missing.length > 0) {
    const inserts = missing.map(id => ({
      student_id: id,
      meeting_id: meetingId,
      status: 'TIDAK_HADIR',
      waktu_scan: null,
    }))

    // Batch upsert in chunks of 500 — duplicate-safe
    for (let i = 0; i < inserts.length; i += 500) {
      const { error } = await supabase
        .from('attendances')
        .upsert(inserts.slice(i, i + 500), {
          onConflict: 'student_id,meeting_id',
          ignoreDuplicates: true, // jangan overwrite HADIR/LATE yang sudah ada
        })

      if (error) throw new Error(`Failed to upsert TIDAK_HADIR: ${error.message}`)
    }
  }

  return { success: true, absent_inserted: missing.length }
}
