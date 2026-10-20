import type { BeforeSendEvent } from '@vercel/analytics/next'

const pages = new Set([
  '/', '/login', '/planning', '/reports', '/tickets', '/savings',
  '/admin', '/admin/administrators', '/admin/tickets', '/admin/benefits', '/auth/update-password',
  '/privacypolicy', '/termsofservice', '/privacy', '/terms',
])

/** Collect page counts without auth parameters, ticket IDs or custom event data. */
export function sanitizeAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  if (event.type !== 'pageview') return null
  try {
    const url = new URL(event.url)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    const path = url.pathname.replace(/\/$/, '') || '/'
    if (path.startsWith('/tickets/')) url.pathname = '/tickets/[id]'
    else if (path.startsWith('/admin/tickets/')) url.pathname = '/admin/tickets/[id]'
    else if (pages.has(path)) url.pathname = path
    else return null
    url.search = ''; url.hash = ''; url.username = ''; url.password = ''
    return { type: 'pageview', url: url.toString() }
  } catch {
    return null
  }
}
