export type DisplayCurrency = 'BRL' | 'USD'
export const CURRENCY_STORAGE_KEY = 'nocontrole:display-currency'
export const CURRENCY_EVENT = 'nocontrole:currency-change'
let memoryCurrency: DisplayCurrency = 'BRL'
let storageUnavailable = false

export function normalizeCurrency(value: unknown): DisplayCurrency {
  return value === 'USD' ? 'USD' : 'BRL'
}

export function getCurrencySnapshot(): DisplayCurrency {
  if (typeof window === 'undefined') return 'BRL'
  if (storageUnavailable) return memoryCurrency
  try { return normalizeCurrency(localStorage.getItem(CURRENCY_STORAGE_KEY)) }
  catch { return memoryCurrency }
}

export function selectCurrency(value: DisplayCurrency) {
  memoryCurrency = normalizeCurrency(value)
  try { localStorage.setItem(CURRENCY_STORAGE_KEY, memoryCurrency); storageUnavailable = false }
  catch { storageUnavailable = true }
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
