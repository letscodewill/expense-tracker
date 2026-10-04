const STORAGE_KEY = 'expense-tracker:values-hidden'
const CHANGE_EVENT = 'expense-tracker:values-visibility-change'

let fallbackHidden = false

export function getVisibilitySnapshot(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return fallbackHidden
  }
}

export function getServerVisibilitySnapshot(): boolean {
  return false
}

export function subscribeVisibility(onChange: () => void): () => void {
  function handleStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY || event.key === null) onChange()
  }
  window.addEventListener('storage', handleStorage)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

export function toggleVisibility(): void {
  fallbackHidden = !getVisibilitySnapshot()
  try {
    window.localStorage.setItem(STORAGE_KEY, String(fallbackHidden))
  } catch {
    // Keep the preference usable for this session when storage is unavailable.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}
