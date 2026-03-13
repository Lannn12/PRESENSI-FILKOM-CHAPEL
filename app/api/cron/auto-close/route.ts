import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { closeMeeting } from '@/lib/meetings'

/**
 * CRON JOB: Auto-close meetings that have passed their end_time.
 * Can be triggered via Vercel Cron, GitHub Actions, or Supabase Edge Functions.
 */
export async function GET(req: NextRequest) {
  // 1. Basic security check
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createServiceClient()
    
    // 2. Fetch all active meetings
    const { data: activeMeetings, error: fetchErr } = await supabase
      .from('meetings')
      .select('id, tanggal, end_time')
      .eq('status', 'AKTIF')

    if (fetchErr) throw fetchErr
    if (!activeMeetings || activeMeetings.length === 0) {
      return NextResponse.json({ message: 'No active meetings found.' })
    }

    const now = new Date()
    const closedMeetings = []

    // 3. Check each meeting
    for (const meeting of activeMeetings) {
      if (!meeting.end_time) continue

      const [hours, minutes, seconds] = meeting.end_time.split(':').map(Number)
      const meetingEnd = new Date(meeting.tanggal)
      meetingEnd.setHours(hours, minutes, seconds || 0)

      if (now > meetingEnd) {
        try {
          await closeMeeting(meeting.id)
          closedMeetings.push({ id: meeting.id, status: 'SUCCESS' })
        } catch (err: any) {
          closedMeetings.push({ id: meeting.id, status: 'FAILED', error: err.message })
        }
      }
    }

    return NextResponse.json({
      processed: activeMeetings.length,
      closed_count: closedMeetings.length,
      details: closedMeetings
    })

  } catch (err: any) {
    console.error('[CRON auto-close ERROR]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
