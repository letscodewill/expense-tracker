export type DisplayCurrency = 'BRL' | 'USD' | 'EUR'
export const CURRENCY_STORAGE_KEY = 'nocontrole:display-currency'
export const CURRENCY_EVENT = 'nocontrole:currency-change'
export const CURRENCY_COOKIE = 'nocontrole-currency'
export const CURRENCY_MANUAL_COOKIE = 'nocontrole-currency-manual'
export const CURRENCY_MANUAL_KEY = 'nocontrole:currency-manual'
let memoryCurrency: DisplayCurrency = 'BRL'
let storageUnavailable = false

export function normalizeCurrency(value: unknown): DisplayCurrency {
  return value === 'USD' || value === 'EUR' ? value : 'BRL'
}

export function getCurrencySnapshot(): DisplayCurrency {
  if (typeof window === 'undefined') return 'BRL'
  if (storageUnavailable) return memoryCurrency
  try {
    if(localStorage.getItem(CURRENCY_MANUAL_KEY)==='1') return normalizeCurrency(localStorage.getItem(CURRENCY_STORAGE_KEY))
    return typeof document!=='undefined' ? normalizeCurrency(document.documentElement.dataset.currency) : memoryCurrency
  }
  catch { return memoryCurrency }
}

export function selectCurrency(value: DisplayCurrency) {
  memoryCurrency = normalizeCurrency(value)
  try { localStorage.setItem(CURRENCY_STORAGE_KEY, memoryCurrency); localStorage.setItem(CURRENCY_MANUAL_KEY,'1'); storageUnavailable = false }
  catch { storageUnavailable = true }
  if(typeof document!=='undefined') {
    document.documentElement.dataset.currency=memoryCurrency
    const suffix=typeof location!=='undefined'&&location.protocol==='https:'?'; Secure':''
    document.cookie=`${CURRENCY_COOKIE}=${memoryCurrency}; Path=/; Max-Age=31536000; SameSite=Lax${suffix}`
    document.cookie=`${CURRENCY_MANUAL_COOKIE}=1; Path=/; Max-Age=31536000; SameSite=Lax${suffix}`
  }
  window.dispatchEvent(new Event(CURRENCY_EVENT))
}
export function initializeCurrency(value: DisplayCurrency) {
  memoryCurrency=normalizeCurrency(value)
  if(typeof document!=='undefined') document.documentElement.dataset.currency=memoryCurrency
  window.dispatchEvent(new Event(CURRENCY_EVENT))
}

export function subscribeCurrency(callback: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === CURRENCY_STORAGE_KEY || event.key === null) {
      memoryCurrency = normalizeCurrency(event.newValue)
      storageUnavailable = false
      callback()
    }
  }
  window.addEventListener(CURRENCY_EVENT, callback)
  window.addEventListener('storage', storage)
  return () => {
    window.removeEventListener(CURRENCY_EVENT, callback)
    window.removeEventListener('storage', storage)
  }
}
