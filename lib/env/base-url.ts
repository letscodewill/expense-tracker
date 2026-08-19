/**
 * Resolves the public base URL used for absolute redirects
 * (e.g. Supabase email confirmation / password recovery links).
 *
 * Order of precedence:
 *   1. NEXT_PUBLIC_BASE_URL env var (must be set in production)
 *   2. localhost fallback (dev only — never used in prod)
 *
 * Throws in production when the env var is missing so the
 * misconfiguration is caught early instead of silently sending
 * users a broken email link.
 */
export function getBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, '')
  const isProd = process.env.NODE_ENV === 'production'

  if (fromEnv) return fromEnv

  if (isProd) {
    throw new Error(
      'NEXT_PUBLIC_BASE_URL is not set. ' +
        'Configure it in your hosting provider (e.g. Vercel → ' +
        'Project Settings → Environment Variables) with the deployed URL, ' +
        'no trailing slash. Example: https://your-app.vercel.app'
    )
  }

  // Dev fallback
  console.warn(
    '[env] NEXT_PUBLIC_BASE_URL is not set; falling back to http://localhost:3000. ' +
      'Set it in .env.local for accurate redirect URLs.'
  )
  return 'http://localhost:3000'
}