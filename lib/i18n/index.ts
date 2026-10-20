import english from './en.json'
import spanish from './es.json'

export type Language = 'pt-BR' | 'en' | 'es'
export const LANGUAGE_STORAGE_KEY = 'nocontrole:language'
export const LANGUAGE_COOKIE = 'nocontrole-language'
export const LANGUAGE_EVENT = 'nocontrole:language-change'
export function normalizeLanguage(value: unknown): Language {
  return value === 'en' || value === 'es' ? value : 'pt-BR'
}
// Only used when this browser has no saved preference. Regional variants share
// the same translations; unsupported languages fall back to English.
export function detectLanguage(acceptLanguage: string | null): Language {
  const preferences = (acceptLanguage ?? '').split(',').map((entry, index) => {
    const [tag, ...parameters] = entry.trim().split(';')
    const quality = parameters.find((parameter) => /^q\s*=/i.test(parameter.trim()))
    const raw = quality?.split('=')[1]?.trim()
    const weight = raw === undefined ? 1 : /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(raw) ? Number(raw) : 0
    return { tag: tag.toLowerCase(), weight, index }
  }).filter(({ weight }) => weight > 0).sort((a, b) => b.weight - a.weight || a.index - b.index)
  for (const { tag } of preferences) {
    if (!/^(pt|en|es)(?:-[a-z0-9]{1,8})*$/.test(tag)) continue
    const base = tag.split('-')[0]
    return base === 'pt' ? 'pt-BR' : base as Language
  }
  return 'en'
}
export function languageLocale(language: Language): string {
  return language === 'en' ? 'en-US' : language === 'es' ? 'es-419' : 'pt-BR'
}
export type TranslationValues = Record<string, string | number>
export function translate(text: string, language: Language, values?: TranslationValues): string {
  const dictionary = (language === 'es' ? spanish : english) as Record<string, string>
  const trimmed = text.trim()
  const localized = language === 'pt-BR' ? text : dictionary[text] ?? (dictionary[trimmed] ? text.replace(trimmed, dictionary[trimmed]) : text)
  return values ? localized.replace(/\{(\w+)\}/g, (token, key: string) => values[key] === undefined ? token : String(values[key])) : localized
}
export function getLanguageSnapshot(): Language {
  return typeof document === 'undefined' ? 'pt-BR' : normalizeLanguage(document.documentElement.lang)
}
// For messages raised outside React, including PDF/spreadsheet parsers.
export function t(text: string): string { return translate(text, getLanguageSnapshot()) }
export function subscribeLanguage(callback: () => void) {
  window.addEventListener(LANGUAGE_EVENT, callback)
  const storage = (event: StorageEvent) => {
    if (event.key !== LANGUAGE_STORAGE_KEY && event.key !== null) return
    let language: Language = 'pt-BR'
    try { language = normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY)) } catch {}
    applyLanguage(language)
    callback()
  }
  window.addEventListener('storage', storage)
  return () => {
    window.removeEventListener(LANGUAGE_EVENT, callback)
    window.removeEventListener('storage', storage)
  }
}
function applyLanguage(language: Language) {
  document.documentElement.lang = language
  document.cookie = `${LANGUAGE_COOKIE}=${language}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
}
export function selectLanguage(language: Language) {
  applyLanguage(normalizeLanguage(language))
  try { localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizeLanguage(language)) } catch {}
  window.dispatchEvent(new Event(LANGUAGE_EVENT))
}
