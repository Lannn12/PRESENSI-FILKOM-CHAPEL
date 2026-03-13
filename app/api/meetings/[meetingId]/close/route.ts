import { NextRequest, NextResponse } from 'next/server'
import { closeMeeting } from '@/lib/meetings'

export async function POST(req: NextRequest, { params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params
  try {
    const result = await closeMeeting(meetingId)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[API /api/meetings/close POST]', err)
    return NextResponse.json({ error: err.message || 'Internal server error.' }, { status: 500 })
  }
}
