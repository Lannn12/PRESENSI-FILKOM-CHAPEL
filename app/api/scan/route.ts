import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { token, no_regis, is_late } = await req.json()
    if (!token || !no_regis) {
      return NextResponse.json({ error: 'Token dan no_regis wajib diisi.' }, { status: 400 })
    }

    const supabase = await createServiceClient()

    // Validate token & get meeting
    const { data: meeting, error: meetErr } = await supabase
      .from('meetings')
      .select('id, nama_event, status, tanggal')
      .eq('scanner_token', token)
      .single()

    if (meetErr || !meeting) {
      return NextResponse.json({ error: 'Event tidak ditemukan.' }, { status: 404 })
    }
    if (meeting.status !== 'AKTIF') {
      return NextResponse.json({ error: `Event berstatus ${meeting.status}. Presensi tidak dapat direkam.` }, { status: 403 })
    }

    // Find student
    const { data: student, error: studErr } = await supabase
      .from('students')
      .select('id, first_name, last_name, no_regis, major')
      .eq('no_regis', no_regis.trim())
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
      return NextResponse.json({
        warning: true,
        message: `${student.last_name}, ${student.first_name} sudah tercatat sebagai ${existing.status}.`,
        student,
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

    return NextResponse.json({
      success: true,
      message: `${student.last_name}, ${student.first_name} — ${status}`,
      student,
      status,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
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
    .select('id, nama_event, tanggal, start_time, end_time, status, event_type')
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

  return NextResponse.json({ meeting, recent: recent ?? [] })
}
