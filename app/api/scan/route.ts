import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  // Rate limit: 20 requests per 60 seconds
  const limited = rateLimit(req, { maxRequests: 20, windowMs: 60_000, prefix: 'scan-post' })
  if (limited) return limited

  try {
    const { token, no_regis, is_late, pin } = await req.json()
    if (!token || !no_regis) {
      return NextResponse.json({ error: 'Token dan no_regis wajib diisi.' }, { status: 400 })
    }

    const supabase = await createServiceClient()

    // Validate token & get meeting
    const { data: meeting, error: meetErr } = await supabase
      .from('meetings')
      .select('id, nama_event, status, tanggal, semester_id, scanner_pin')
      .eq('scanner_token', token)
      .single()

    if (meetErr || !meeting) {
      return NextResponse.json({ error: 'Event tidak ditemukan.' }, { status: 404 })
    }
    if (meeting.status !== 'AKTIF') {
      return NextResponse.json({ error: `Event berstatus ${meeting.status}. Presensi tidak dapat direkam.` }, { status: 403 })
    }
    // Validate PIN if the meeting has one (compare plain text PIN)
    if (meeting.scanner_pin && meeting.scanner_pin !== (pin ?? '')) {
      return NextResponse.json({ error: 'PIN tidak valid.' }, { status: 403 })
    }

    // Find student — ensure no_regis is uppercased to match stored data
    const { data: student, error: studErr } = await supabase
      .from('students')
      .select('id, first_name, last_name, no_regis, major')
      .eq('no_regis', no_regis.trim().toUpperCase())
      .single()

    if (studErr || !student) {
      return NextResponse.json({ error: `Mahasiswa dengan no. reg "${no_regis}" tidak ditemukan.` }, { status: 404 })
    }

    // Check existing record
    const { data: existing } = await supabase
      .from('attendances')
      .select('id, status')
      .eq('student_id', student.id)
      .eq('meeting_id', meeting.id)
      .single()

    if (existing) {
      let section_title: string | null = null
      const { data: seatData } = await supabase
        .from('student_sections')
        .select('section:sections(title)')
        .eq('student_id', student.id)
        .eq('semester_id', meeting.semester_id)
        .single()
      if (seatData?.section && typeof seatData.section === 'object' && 'title' in seatData.section) {
        section_title = (seatData.section as { title: string }).title
      }

      return NextResponse.json({
        warning: true,
        message: `${student.last_name}, ${student.first_name} sudah tercatat sebagai ${existing.status}.`,
        student,
        section_title,
      })
    }

    // Insert attendance
    const status = is_late ? 'LATE' : 'HADIR'
    const { error: insErr } = await supabase.from('attendances').insert({
      student_id: student.id,
      meeting_id: meeting.id,
      status,
      waktu_scan: new Date().toISOString(),
    })

    if (insErr) {
      return NextResponse.json({ error: 'Gagal menyimpan presensi: ' + insErr.message }, { status: 500 })
    }

    // Lookup student's seating section for this semester
    let section_title: string | null = null
    const { data: seatData } = await supabase
      .from('student_sections')
      .select('section:sections(title)')
      .eq('student_id', student.id)
      .eq('semester_id', meeting.semester_id)
      .single()
    if (seatData?.section && typeof seatData.section === 'object' && 'title' in seatData.section) {
      section_title = (seatData.section as { title: string }).title
    }

    return NextResponse.json({
      success: true,
      message: `${student.last_name}, ${student.first_name} — ${status}`,
      student,
      status,
      section_title,
    })
  } catch (err) {
    console.error('[API /api/scan POST]', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  // Rate limit: 30 requests per 60 seconds
  const limited = rateLimit(req, { maxRequests: 30, windowMs: 60_000, prefix: 'scan-get' })
  if (limited) return limited

  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token required.' }, { status: 400 })

  // Validate env vars — common cause of 404 on Vercel
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Konfigurasi server belum lengkap. Pastikan env var Supabase sudah diset di Vercel.' },
      { status: 503 }
    )
  }

  const supabase = await createServiceClient()
  const { data: meeting, error: meetErr } = await supabase
    .from('meetings')
    .select('id, nama_event, tanggal, start_time, end_time, status, event_type, scanner_pin')
    .eq('scanner_token', token)
    .single()

  if (meetErr || !meeting) {
    // Distinguish between "token not found" vs Supabase connection error
    const isConnErr = meetErr && (meetErr.code === 'PGRST301' || meetErr.message?.includes('fetch'))
    return NextResponse.json(
      { error: isConnErr
          ? 'Gagal konek ke database. Cek env var SUPABASE di Vercel.'
          : 'Token scanner tidak valid atau event tidak ditemukan.'
      },
      { status: 404 }
    )
  }

  // Get recent scans
  const { data: recent } = await supabase
    .from('attendances')
    .select('id, status, waktu_scan, student:students(no_regis, first_name, last_name)')
    .eq('meeting_id', meeting.id)
    .in('status', ['HADIR', 'LATE'])
    .order('waktu_scan', { ascending: false })
    .limit(30)

  // Get total counts for counter display
  const [{ count: hadirCount }, { count: lateCount }] = await Promise.all([
    supabase.from('attendances').select('id', { count: 'exact', head: true }).eq('meeting_id', meeting.id).eq('status', 'HADIR'),
    supabase.from('attendances').select('id', { count: 'exact', head: true }).eq('meeting_id', meeting.id).eq('status', 'LATE'),
  ])

  // Return whether PIN is required (but never return the actual PIN)
  const requires_pin = !!meeting.scanner_pin
  const { scanner_pin: _pin, ...meetingPublic } = meeting

  return NextResponse.json({
    meeting: meetingPublic,
    requires_pin,
    recent: recent ?? [],
    counts: { hadir: hadirCount ?? 0, late: lateCount ?? 0 },
  })
}
