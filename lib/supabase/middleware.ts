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
  // getUser() can throw on an invalid/expired refresh token (e.g. after a
  // password change or sign-out on another tab). Treat that as "no user"
  // and clear the stale cookies so the next request starts fresh.
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null
  try {
    const result = await supabase.auth.getUser()
    user = result.data.user
  } catch (err) {
    console.warn('[supabase] getUser failed in middleware, treating as signed out:', err)
    // Clearing the cookies prevents the same error on every subsequent request.
    for (const { name } of request.cookies.getAll()) {
      if (name.startsWith('sb-') || name.includes('-auth-token')) {
        supabaseResponse.cookies.delete(name)
      }
    }
  }

  // Note: we intentionally do NOT redirect unauthenticated users here.
  // Auth-guarding in middleware races with login / signup / password update:
  // the session cookie is written on the next response and the client takes
  // a request to refresh, so getUser() can return null transiently and the
  // user gets bounced back to /login. Guard at the page (Server Component)
  // or in the page's own data fetch instead.
  void user

  return supabaseResponse
}
