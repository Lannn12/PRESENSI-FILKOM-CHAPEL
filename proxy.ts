import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Security headers applied to every response as a defense-in-depth layer.
 */
const securityHeaders: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), interest-cohort=()',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Cross-Origin-Opener-Policy': 'same-origin',
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value)
  }
  return response
}

export async function proxy(request: NextRequest) {
  // Buat response yang bisa dimodifikasi untuk meneruskan cookie refresh dari Supabase
  let supabaseResponse = NextResponse.next({ request })

  // Gunakan createServerClient dari @supabase/ssr — ini cara yang benar untuk middleware.
  // Supabase SSR v2 menggunakan cookie chunked (sb-xxx-auth-token.0, .1, dst.) yang tidak
  // bisa dideteksi dengan exact name match. createServerClient menangani ini secara otomatis.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Forward cookie ke request (untuk SSR di bawahnya)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Buat response baru agar cookie ter-set di browser
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() memvalidasi JWT secara kriptografis — tidak bisa dipalsukan dengan cookie sembarangan.
  // Ini lebih aman dari cek keberadaan cookie saja.
  // Catatan: ini network call ke Supabase Auth server (~50ms). Jika timeout jadi masalah
  // di Vercel Edge, bisa dioptimasi dengan menambahkan region yang dekat (ap-southeast-1).
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Public routes — tidak perlu auth
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

  // Penting: kembalikan supabaseResponse (bukan NextResponse.next() baru) agar
  // cookie refresh token yang di-set oleh Supabase tidak hilang
  return applySecurityHeaders(supabaseResponse)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
