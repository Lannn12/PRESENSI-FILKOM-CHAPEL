import { NextResponse } from 'next/server'

// Debug endpoint removed for security — was exposing service keys and scanner tokens
export async function GET() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
