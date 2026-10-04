import { createBrowserClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'
import { SESSION_COOKIE_OPTIONS, sessionCookieOptions } from './session-config'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: SESSION_COOKIE_OPTIONS,
      cookies: typeof document === 'undefined' ? undefined : {
        getAll() {
          return parseCookieHeader(document.cookie).map(({ name, value }) => ({ name, value: value ?? '' }))
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            document.cookie = serializeCookieHeader(name, value, sessionCookieOptions(value, options))
          })
        },
      },
    }
  )
}
