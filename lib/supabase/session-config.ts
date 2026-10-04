import type { CookieOptions } from '@supabase/ssr'

export const SESSION_MAX_AGE = 45 * 24 * 60 * 60
export const SESSION_COOKIE_OPTIONS: CookieOptions = { path: '/', sameSite: 'lax', maxAge: SESSION_MAX_AGE }

// The SSR SDK overrides maxAge before setAll; enforce the policy at the write.
export function sessionCookieOptions(value: string, options: CookieOptions = {}): CookieOptions {
  if (!value || options.maxAge === 0) return { ...options, maxAge: 0 }
  return { ...SESSION_COOKIE_OPTIONS, ...options, maxAge: SESSION_MAX_AGE, expires: new Date(Date.now() + SESSION_MAX_AGE * 1000) }
}

export function isSessionCookie(name: string, supabaseUrl: string): boolean {
  const key = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
  return name === key || (name.startsWith(`${key}.`) && /^\d+$/.test(name.slice(key.length + 1)))
}

export function isInvalidSessionError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false
  return ['refresh_token_not_found', 'refresh_token_already_used', 'session_not_found', 'session_expired', 'user_not_found', 'user_banned'].includes(String(error.code))
}
