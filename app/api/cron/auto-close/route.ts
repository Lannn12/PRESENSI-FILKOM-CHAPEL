import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { closeMeeting, getMeetingDateTime } from '@/lib/meetings'

/**
 * CRON JOB: Auto-close meetings that have passed their end_time.
 * Can be triggered via Vercel Cron, GitHub Actions, or Supabase Edge Functions.
 *
 * Jadwal Vercel Cron ada di `vercel.json`.
 */
export async function GET(req: NextRequest) {
  // 1. Auth check.
  //    CRON_SECRET wajib ada di production. Kalau tidak di-set, jangan sampai
  //    header `Bearer undefined` dianggap valid — itu membuat endpoint terbuka.
  const secret = process.env.CRON_SECRET
  if (process.env.NODE_ENV === 'production') {
    if (!secret) {
      console.error('[CRON auto-close] CRON_SECRET tidak di-set — menolak semua request.')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (req.headers.get('authorization') !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
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

      // Gunakan helper yang sama dengan /api/scan agar keduanya tidak
      // berbeda opinions soal timezone.
      const meetingEnd = getMeetingDateTime(meeting.tanggal, meeting.end_time)
      if (!meetingEnd) continue

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
