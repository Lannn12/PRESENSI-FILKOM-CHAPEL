import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Static security headers applied to every response.
 * CSP is handled separately with dynamic nonce generation.
 */
const securityHeaders: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), interest-cohort=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Cross-Origin-Opener-Policy': 'same-origin',
}

/**
 * Generate a nonce-based CSP header value.
 *
 * Key decisions:
 * - script-src uses nonce + strict-dynamic → NO unsafe-inline/unsafe-eval (A+ grade)
 * - style-src keeps 'unsafe-inline' → Required because React inline styles (style={{}})
 *   use the HTML style attribute which cannot have nonces. This is acceptable because
 *   CSS-based attacks are far less dangerous than script injection, and securityheaders.com
 *   primarily penalizes unsafe-inline in script-src, not style-src.
 */
function buildCsp(nonce: string): string {
  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: blob:;
    media-src 'self' blob:;
    connect-src 'self' https://*.supabase.co wss://*.supabase.co;
    frame-src 'none';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `
  return csp.replace(/\s{2,}/g, ' ').trim()
}

/** Apply security headers + dynamic CSP to any NextResponse */
function applySecurityHeaders(response: NextResponse, cspValue: string): NextResponse {
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value)
  }
  response.headers.set('Content-Security-Policy', cspValue)
  return response
}

export async function middleware(request: NextRequest) {
  // ── Generate nonce for CSP ─────────────────────────────────────
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const cspHeaderValue = buildCsp(nonce)

  // ── Inject nonce into request headers for Server Components ────
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', cspHeaderValue)

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })
  supabaseResponse.headers.set('Content-Security-Policy', cspHeaderValue)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          })
          supabaseResponse.headers.set('Content-Security-Policy', cspHeaderValue)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Public routes — no auth needed
  const publicRoutes = ['/login', '/scan', '/student', '/api/scan', '/api/student']
  const isPublic = publicRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return applySecurityHeaders(NextResponse.redirect(url), cspHeaderValue)
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return applySecurityHeaders(NextResponse.redirect(url), cspHeaderValue)
  }

  return applySecurityHeaders(supabaseResponse, cspHeaderValue)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
