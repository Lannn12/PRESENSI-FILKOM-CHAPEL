import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { closeMeeting } from '@/lib/meetings'

export async function POST(req: NextRequest, { params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params

  // ── Auth guard: only authenticated admin can close meetings ──
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized — login required.' }, { status: 401 })
  }

  try {
    const result = await closeMeeting(meetingId)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[API /api/meetings/close POST]', err)
    return NextResponse.json({ error: err.message || 'Internal server error.' }, { status: 500 })
  }
}
