import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  // Rate limit: 15 requests per 60 seconds
  const limited = rateLimit(req, { maxRequests: 15, windowMs: 60_000, prefix: 'student' })
  if (limited) return limited

  const no_regis = req.nextUrl.searchParams.get('no_regis')
  if (!no_regis) return NextResponse.json({ error: 'no_regis required.' }, { status: 400 })

  const supabase = await createServiceClient()

  const { data: student } = await supabase
    .from('students')
    .select('id, no_regis, first_name, last_name, major, gender')
    .eq('no_regis', no_regis.trim().toUpperCase())
    .single()

  if (!student) return NextResponse.json({ error: 'Mahasiswa tidak ditemukan.' }, { status: 404 })

  const { data: attendances } = await supabase
    .from('attendances')
    .select('id, status, waktu_scan, meeting:meetings(id, nama_event, tanggal, start_time, event_type, status)')
    .eq('student_id', student.id)
    .order('created_at', { ascending: false })

  const closed = (attendances ?? []).filter((a: Record<string, unknown>) => (a.meeting as Record<string, unknown>)?.status === 'DITUTUP')
  const hadir = closed.filter((a: Record<string, unknown>) => a.status === 'HADIR').length
  const late = closed.filter((a: Record<string, unknown>) => a.status === 'LATE').length
  const tidak_hadir = closed.filter((a: Record<string, unknown>) => a.status === 'TIDAK_HADIR').length

  return NextResponse.json({
    student: {
      no_regis: student.no_regis,
      first_name: student.first_name,
      last_name: student.last_name,
      major: student.major,
      gender: student.gender,
    },
    stats: { total: closed.length, hadir, late, tidak_hadir },
    attendances: closed,
  })
}
