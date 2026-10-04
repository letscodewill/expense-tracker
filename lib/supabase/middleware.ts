import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE_OPTIONS, sessionCookieOptions, isSessionCookie, isInvalidSessionError } from './session-config'

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
}

/** Validate/refresh tokens, then extend valid session cookies on each visit. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const pendingCookies = new Map<string, { name: string; value: string; options: CookieOptions }>()
  const responseHeaders: Record<string, string> = {}

  const supabase = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          const finalOptions = sessionCookieOptions(value, options)
          if (finalOptions.maxAge === 0) request.cookies.delete(name)
          else request.cookies.set(name, value)
          pendingCookies.set(name, { name, value, options: finalOptions })
        })
        Object.assign(responseHeaders, PRIVATE_HEADERS, headers)
        response = NextResponse.next({ request })
        pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        Object.entries(responseHeaders).forEach(([name, value]) => response.headers.set(name, value))
      },
    },
  })

  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null
  let authError: unknown
  try {
    const result = await supabase.auth.getUser()
    user = result.data.user
    authError = result.error
  } catch (error) {
    authError = error
    console.warn('[supabase] Session validation failed:', error)
  }

  if (user && !authError) {
    for (const { name, value } of request.cookies.getAll()) {
      if (value && isSessionCookie(name, supabaseUrl)) {
        response.cookies.set(name, value, sessionCookieOptions(value, pendingCookies.get(name)?.options))
      }
    }
    Object.entries(PRIVATE_HEADERS).forEach(([name, value]) => response.headers.set(name, value))
  } else if (isInvalidSessionError(authError)) {
    // Network/service failures must not erase an otherwise reusable session.
    for (const { name } of request.cookies.getAll()) {
      if (isSessionCookie(name, supabaseUrl)) {
        request.cookies.delete(name)
        response.cookies.set(name, '', { ...SESSION_COOKIE_OPTIONS, maxAge: 0 })
      }
    }
    Object.entries(PRIVATE_HEADERS).forEach(([name, value]) => response.headers.set(name, value))
  }

  // Pages keep responsibility for their own authorization and redirects.
  return response
}
