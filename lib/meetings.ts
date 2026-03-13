import { createServiceClient } from '@/lib/supabase/server'

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

  // 2. Determine target students
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

  // 3. Get who already attended
  const { data: attended } = await supabase
    .from('attendances')
    .select('student_id')
    .eq('meeting_id', meetingId)
  
  const attendedIds = new Set((attended ?? []).map(a => a.student_id))

  // 4. Fill in missing attendances as 'TIDAK_HADIR'
  const missing = studentIds.filter(id => !attendedIds.has(id))
  
  if (missing.length > 0) {
    const inserts = missing.map(id => ({
      student_id: id,
      meeting_id: meetingId,
      status: 'TIDAK_HADIR',
      waktu_scan: null,
    }))

    // Batch insert in chunks of 500
    for (let i = 0; i < inserts.length; i += 500) {
      const { error } = await supabase
        .from('attendances')
        .insert(inserts.slice(i, i + 500))
      
      if (error) throw new Error(`Failed to insert TIDAK_HADIR: ${error.message}`)
    }
  }

  // 5. Update meeting status
  const { error: updErr } = await supabase
    .from('meetings')
    .update({ status: 'DITUTUP' })
    .eq('id', meetingId)

  if (updErr) throw new Error(`Failed to update status: ${updErr.message}`)

  return { success: true, absent_inserted: missing.length }
}
