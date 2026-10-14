'use client'

import { Analytics } from '@vercel/analytics/next'
import { sanitizeAnalyticsEvent } from '@/lib/web-analytics'

export function WebAnalytics() {
  return <Analytics beforeSend={sanitizeAnalyticsEvent} debug={false} />
}
