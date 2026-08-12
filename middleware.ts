import { NextResponse, type NextRequest } from 'next/server'

/**
 * Security headers applied to every response as a defense-in-depth layer.
 * These complement the headers set in next.config.ts.
 */
const securityHeaders: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), interest-cohort=()',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Cross-Origin-Opener-Policy': 'same-origin',
}

/** Apply security headers to any NextResponse */
function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value)
  }
  return response
}

export async function middleware(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request })

  // Lightweight, non-blocking session check for middleware:
  // Avoid invoking network calls here (e.g. `supabase.auth.getUser()`),
  // which can cause middleware invocation timeouts on Vercel.
  // Instead, only check for presence of likely Supabase auth cookies.
  const projectRef = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]
    } catch {
      return ''
    }
  })()

  const possibleCookieNames = [
    `sb-${projectRef}-auth-token`,
    'sb-access-token',
    'sb-refresh-token',
    'supabase-auth-token',
    'supabase-session',
  ]

  let hasSession = false
  for (const name of possibleCookieNames) {
    if (request.cookies.get(name)) {
      hasSession = true
      break
    }
  }

  const user = hasSession ? {} : null

  const { pathname } = request.nextUrl

  // Public routes — no auth needed
  const publicRoutes = ['/login', '/scan', '/student', '/api/scan', '/api/student']
  const isPublic = publicRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return applySecurityHeaders(NextResponse.redirect(url))
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return applySecurityHeaders(NextResponse.redirect(url))
  }

  return applySecurityHeaders(supabaseResponse)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
