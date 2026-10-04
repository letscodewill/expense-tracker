export const THEMES = [
  { id: 'lavender-light', name: 'Lavanda', mode: 'light', description: 'Lilás e rosa suave', colors: ['#faf8ff', '#eaddff', '#f2dce8', '#6750a4'] },
  { id: 'mint-light', name: 'Menta', mode: 'light', description: 'Verde menta e azul suave', colors: ['#f5fbf8', '#d5eee2', '#dcecf7', '#326653'] },
  { id: 'peach-light', name: 'Pêssego', mode: 'light', description: 'Pêssego e rosa suave', colors: ['#fff8f4', '#f9dfd2', '#f2dce8', '#92513d'] },
  { id: 'lavender-dark', name: 'Lavanda', mode: 'dark', description: 'Ameixa com lilás pastel', colors: ['#15121b', '#4a3866', '#edaac5', '#d0bcff'] },
  { id: 'mint-dark', name: 'Menta', mode: 'dark', description: 'Verde profundo com menta pastel', colors: ['#111b17', '#2d4c3e', '#b6d6ea', '#a6d9bf'] },
  { id: 'peach-dark', name: 'Pêssego', mode: 'dark', description: 'Marrom suave com pêssego pastel', colors: ['#201613', '#5d3d32', '#e7b7cf', '#f4bea3'] },
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
export function getThemeSnapshot(): ThemeId {
  const value = document.documentElement.dataset.theme
  return isThemeId(value) ? value : defaultTheme()
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
    applyTheme(isThemeId(saved) ? saved : defaultTheme())
    onChange()
  }
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', storage)
  return () => { window.removeEventListener(CHANGE_EVENT, onChange); window.removeEventListener('storage', storage) }
}
// Only fixed theme identifiers are serialized into this bootstrap script.
export const THEME_INIT_SCRIPT = `(()=>{let t;try{t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch{}const ids=${JSON.stringify(THEMES.map(theme => theme.id))};if(!ids.includes(t))t=window.matchMedia('(prefers-color-scheme: dark)').matches?'lavender-dark':'lavender-light';document.documentElement.dataset.theme=t;document.documentElement.classList.toggle('dark',t.endsWith('-dark'))})()`
