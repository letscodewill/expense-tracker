import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Refreshes the Supabase session cookies on every request.
 *
 * This is required so that:
 *   - The browser client (createBrowserClient) sees the session set by
 *     /auth/callback during a recovery flow.
 *   - Server components using getUser() get a fresh, valid session.
 *
 * Without this middleware, the cookies set by exchangeCodeForSession on the
 * server are written but never propagated to subsequent client reads, so
 * supabase.auth.getSession() returns null and pages guarded by session checks
 * (e.g. /auth/update-password) bounce the user back to /login.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: do not run any other code between createServerClient and
  // getUser(). A simple mistake here can make it very hard to debug
  // issues with users being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect unauthenticated users away from protected routes.
  // Adjust the protected-pattern list to match your app's routes.
  const protectedPaths = ['/', '/dashboard', '/expenses', '/boards']
  const pathname = request.nextUrl.pathname
  const isProtected = protectedPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
