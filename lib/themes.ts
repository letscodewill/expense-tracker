export const THEMES = [
  { id: 'lavender-light', name: 'Claro', mode: 'light', description: 'Superfícies claras e detalhes suaves', colors: ['#faf8ff', '#eaddff', '#6750a4'] },
  { id: 'lavender-dark', name: 'Escuro', mode: 'dark', description: 'Superfícies escuras e detalhes suaves', colors: ['#15121b', '#4a3866', '#d0bcff'] },
] as const
export type ThemeId = typeof THEMES[number]['id']
export const THEME_STORAGE_KEY = 'expense-tracker:theme'
const CHANGE_EVENT = 'expense-tracker:theme-change'
export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some(theme => theme.id === value)
}
function defaultTheme(): ThemeId {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'lavender-dark' : 'lavender-light'
}
export function normalizeTheme(value: unknown): ThemeId | null {
  if (isThemeId(value)) return value
  if (value === 'mint-light' || value === 'peach-light') return 'lavender-light'
  if (value === 'mint-dark' || value === 'peach-dark') return 'lavender-dark'
  return null
}
export function getThemeSnapshot(): ThemeId {
  const value = document.documentElement.dataset.theme
  return normalizeTheme(value) ?? defaultTheme()
}
export function getServerThemeSnapshot(): ThemeId { return 'lavender-light' }
function applyTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id
  document.documentElement.classList.toggle('dark', id.endsWith('-dark'))
}
export function selectTheme(id: ThemeId) {
  if (!isThemeId(id)) return
  applyTheme(id)
  try { window.localStorage.setItem(THEME_STORAGE_KEY, id) } catch { /* Keep theme usable without persistent storage. */ }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}
export function subscribeTheme(onChange: () => void) {
  function storage(event: StorageEvent) {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return
    let saved: string | null = null
    try { saved = window.localStorage.getItem(THEME_STORAGE_KEY) } catch { /* Use system preference. */ }
    applyTheme(normalizeTheme(saved) ?? defaultTheme())
    onChange()
  }
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', storage)
  return () => { window.removeEventListener(CHANGE_EVENT, onChange); window.removeEventListener('storage', storage) }
}
// Only fixed theme identifiers are serialized into this bootstrap script.
export const THEME_INIT_SCRIPT = `(()=>{let t;try{t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch{}const legacy={'mint-light':'lavender-light','peach-light':'lavender-light','mint-dark':'lavender-dark','peach-dark':'lavender-dark'};if(Object.hasOwn(legacy,t))t=legacy[t];const ids=${JSON.stringify(THEMES.map(theme => theme.id))};if(!ids.includes(t))t=window.matchMedia('(prefers-color-scheme: dark)').matches?'lavender-dark':'lavender-light';document.documentElement.dataset.theme=t;document.documentElement.classList.toggle('dark',t.endsWith('-dark'))})()`
