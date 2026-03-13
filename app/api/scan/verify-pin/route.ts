import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  // Strict rate limit: 5 requests per 60 seconds (PIN brute-force protection)
  const limited = rateLimit(req, { maxRequests: 5, windowMs: 60_000, prefix: 'verify-pin' })
  if (limited) return limited

  try {
    const { token, pin } = await req.json()
    if (!token || !pin) {
      return NextResponse.json({ error: 'Token dan PIN wajib diisi.' }, { status: 400 })
    }

    const supabase = await createServiceClient()
    const { data: meeting, error } = await supabase
      .from('meetings')
      .select('id, scanner_pin')
      .eq('scanner_token', token)
      .single()

    if (error || !meeting) {
      return NextResponse.json({ error: 'Event tidak ditemukan.' }, { status: 404 })
    }

    if (!meeting.scanner_pin) {
      // No PIN required — always valid
      return NextResponse.json({ valid: true })
    }

    // Compare plain PIN (6-digit)
    if (meeting.scanner_pin !== pin) {
      return NextResponse.json({ error: 'PIN tidak valid.' }, { status: 403 })
    }

    return NextResponse.json({ valid: true })
  } catch (err) {
    console.error('[API /api/scan/verify-pin POST]', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
