export const META_PIXEL_ID = '1842493880214194'
export const MARKETING_CONSENT_KEY = 'nocontrole:marketing-consent:v1'
export const MARKETING_CONSENT_COOKIE = 'nocontrole-marketing'
export const MARKETING_CONSENT_EVENT = 'nocontrole:marketing-consent'
export type MarketingChoice = 'granted' | 'denied'
export function validMarketingChoice(raw: string | null, now = Date.now()): MarketingChoice | null {
  try {
    const value = JSON.parse(raw ?? '')
    return ['granted','denied'].includes(value.choice) && Number.isFinite(value.at) && value.at <= now && now - value.at < 180 * 86400000 ? value.choice : null
  } catch { return null }
}
// Never load the Pixel on financial/auth callback screens or URLs containing private parameters.
export function isMarketingLocation(href: string): boolean {
  try {
    const url = new URL(href)
    if (!['/welcome','/login','/plans'].includes(url.pathname) || url.hash) return false
    for (const [key,value] of url.searchParams) {
      if (key === 'fbclid' && /^[A-Za-z0-9_-]{1,500}$/.test(value)) continue
      if (key === 'utm_source' && value === 'meta') continue
      if (key === 'utm_medium' && value === 'paid_social') continue
      if (key === 'utm_campaign' && value === 'nocontrole_mx_50brl_2dias') continue
      if (key === 'utm_content' && value === 'video_planilha_es') continue
      return false
    }
    return url.protocol === 'https:' || url.hostname === 'localhost'
  } catch { return false }
}
export function canTrackMarketing(): boolean {
  try { return validMarketingChoice(localStorage.getItem(MARKETING_CONSENT_KEY)) === 'granted' && isMarketingLocation(window.location.href) }
  catch { return false }
}
export type MetaQueue = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue: unknown[][]; push?: MetaQueue; loaded: boolean; version: string }
declare global { interface Window { fbq?: MetaQueue; _fbq?: MetaQueue } }
export function trackMarketingEvent(name: 'InitiateCheckout' | 'Purchase' | 'CompleteRegistration', data: { value?: number; currency?: string } = {}, eventID?: string): boolean {
  if (!canTrackMarketing() || !window.fbq) return false
  // Deliberately whitelist parameters: never forward application objects or personal information.
  const safe = Number.isFinite(data.value) && ['BRL','USD'].includes(data.currency ?? '') ? { value: data.value, currency: data.currency } : {}
  window.fbq('trackSingle', META_PIXEL_ID, name, safe, ...(eventID ? [{eventID}] : []))
  return true
}
