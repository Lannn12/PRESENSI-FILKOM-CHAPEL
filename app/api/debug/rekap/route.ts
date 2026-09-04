import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * DEBUG ENDPOINT: Check why attendance data doesn't show up in recap
 * Access: GET /api/debug/rekap?student_name=Dayoh&meeting_name=Chapel
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const studentName = searchParams.get('student_name') || ''
  const meetingName = searchParams.get('meeting_name') || ''

  const supabase = await createServiceClient()

  try {
    // 1. Check meeting exists and get its status
    const { data: meetings, error: meetingError } = await supabase
      .from('meetings')
      .select('id, nama_event, status, tanggal, start_time, end_time, event_type, semester_id')
      .ilike('nama_event', `%${meetingName}%`)
      .order('tanggal', { ascending: false })

    if (meetingError) throw meetingError

    // 2. Check student exists
    const { data: students, error: studentError } = await supabase
      .from('students')
      .select('id, no_regis, first_name, last_name, major, status')
      .or(`last_name.ilike.%${studentName}%,first_name.ilike.%${studentName}%`)

    if (studentError) throw studentError

    // 3. Check attendance data
    let attendances: any[] = []
    if (meetings && meetings.length > 0 && students && students.length > 0) {
      const meetingIds = meetings.map(m => m.id)
      const studentIds = students.map(s => s.id)

      const { data: attData, error: attError } = await supabase
        .from('attendances')
        .select('id, student_id, meeting_id, status, waktu_scan, created_at')
        .in('meeting_id', meetingIds)
        .in('student_id', studentIds)

      if (attError) throw attError
      attendances = attData || []
    }

    // 4. Check what meetings would show in rekap (AKTIF or DITUTUP only)
    const rekapVisibleMeetings = meetings?.filter(m => 
      m.status === 'AKTIF' || m.status === 'DITUTUP'
    ) || []

    // 5. Check active semester
    const { data: activeSemester } = await supabase
      .from('semesters')
      .select('id, nama, is_active')
      .eq('is_active', true)
      .single()

    return NextResponse.json({
      success: true,
      debug: {
        query: {
          student_name: studentName,
          meeting_name: meetingName,
        },
        activeSemester,
        meetings: {
          total: meetings?.length || 0,
          visible_in_rekap: rekapVisibleMeetings.length,
          data: meetings,
        },
        students: {
          total: students?.length || 0,
          data: students,
        },
        attendances: {
          total: attendances.length,
          data: attendances,
        },
        analysis: {
          meeting_status_issue: meetings && meetings.length > 0 && rekapVisibleMeetings.length === 0 
            ? '⚠️ MEETING TIDAK MUNCUL DI REKAP karena status bukan AKTIF atau DITUTUP'
            : '✓ Meeting akan muncul di rekap',
          student_found: students && students.length > 0
            ? '✓ Student ditemukan di database'
            : '⚠️ STUDENT TIDAK DITEMUKAN di database',
          attendance_exists: attendances.length > 0
            ? `✓ Ditemukan ${attendances.length} attendance record`
            : '⚠️ TIDAK ADA ATTENDANCE DATA untuk kombinasi student + meeting ini',
        },
      },
    })
  } catch (error: any) {
    console.error('[DEBUG rekap]', error)
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 })
  }
}
