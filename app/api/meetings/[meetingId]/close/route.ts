import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params
  try {
    const supabase = await createServiceClient()

    // Verify meeting exists
    const { data: meeting, error: meetErr } = await supabase.from('meetings').select('id, status, semester_id, absenter_group_id').eq('id', meetingId).single()
    if (meetErr || !meeting) return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 })
    if (meeting.status === 'DITUTUP') return NextResponse.json({ error: 'Event sudah ditutup.' }, { status: 400 })

    // Get relevant students: by absenter group if set, else by semester (student_sections)
    let studentIds: string[] = []
    if (meeting.absenter_group_id) {
      const { data: members } = await supabase
        .from('absenter_group_members')
        .select('student_id')
        .eq('group_id', meeting.absenter_group_id)
      studentIds = (members ?? []).map((m: { student_id: string }) => m.student_id)
    } else {
      const { data: sections } = await supabase
        .from('student_sections')
        .select('student_id')
        .eq('semester_id', meeting.semester_id)
      if (sections && sections.length > 0) {
        studentIds = sections.map((s: { student_id: string }) => s.student_id)
      } else {
        // Fallback: all students in DB
        const { data: all } = await supabase.from('students').select('id')
        studentIds = (all ?? []).map((s: { id: string }) => s.id)
      }
    }
    const students = studentIds.map(id => ({ id }))
    // Get already attended students
    const { data: attended } = await supabase.from('attendances').select('student_id').eq('meeting_id', meetingId)
    const attendedIds = new Set((attended ?? []).map(a => a.student_id))

    // Insert TIDAK_HADIR for missing students
    const missing = (students ?? []).filter(s => !attendedIds.has(s.id))
    if (missing.length > 0) {
      const inserts = missing.map(s => ({
        student_id: s.id,
        meeting_id: meetingId,
        status: 'TIDAK_HADIR',
        waktu_scan: null,
      }))
      // Batch insert in chunks of 500
      for (let i = 0; i < inserts.length; i += 500) {
        const { error } = await supabase.from('attendances').insert(inserts.slice(i, i + 500))
        if (error) return NextResponse.json({ error: 'Gagal insert TIDAK_HADIR: ' + error.message }, { status: 500 })
      }
    }

    // Update status to DITUTUP
    await supabase.from('meetings').update({ status: 'DITUTUP' }).eq('id', meetingId)

    return NextResponse.json({ success: true, absent_inserted: missing.length })
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
