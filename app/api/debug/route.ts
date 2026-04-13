import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Diagnostic endpoint — HAPUS setelah debugging selesai
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // 1. Check env vars
  const envCheck = {
    NEXT_PUBLIC_SUPABASE_URL: url ? url : 'MISSING',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey ? `${anonKey.substring(0, 20)}...` : 'MISSING',
    SUPABASE_SERVICE_ROLE_KEY: serviceKey ? `${serviceKey.substring(0, 20)}...` : 'MISSING',
  }

  if (!url || !serviceKey) {
    return NextResponse.json({ envCheck, error: 'Missing env vars' })
  }

  // 2. Test with service key
  const serviceClient = createClient(url, serviceKey)
  const { data: meetings, error: meetErr, count } = await serviceClient
    .from('meetings')
    .select('id, nama_event, scanner_token, status', { count: 'exact' })

  // 3. Test tables exist
  const { data: semesters, error: semErr } = await serviceClient
    .from('semesters')
    .select('id, nama, is_active')

  // 4. Test with anon key
  const anonClient = createClient(url, anonKey!)
  const { data: anonMeetings, error: anonErr } = await anonClient
    .from('meetings')
    .select('id, nama_event, status', { count: 'exact' })

  return NextResponse.json({
    envCheck,
    serviceKey_meetings: { count, data: meetings, error: meetErr?.message ?? null },
    serviceKey_semesters: { data: semesters, error: semErr?.message ?? null },
    anonKey_meetings: { data: anonMeetings, error: anonErr?.message ?? null },
  })
}
