'use client'

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { getLanguageSnapshot, LANGUAGE_STORAGE_KEY, normalizeLanguage, selectLanguage, subscribeLanguage, translate, languageLocale, type Language, type TranslationValues } from '@/lib/i18n'

const LanguageContext = createContext<Language>('pt-BR')
export function LanguageProvider({ children, initialLanguage }: { children: ReactNode; initialLanguage: Language }) {
  const router = useRouter()
  useEffect(() => {
    let stored: string | null = null
    try { stored = localStorage.getItem(LANGUAGE_STORAGE_KEY) } catch {}
    const nextLanguage = stored === null ? initialLanguage : normalizeLanguage(stored)
    selectLanguage(nextLanguage)
    if (nextLanguage !== initialLanguage) router.refresh()
  }, [initialLanguage, router])
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === LANGUAGE_STORAGE_KEY || event.key === null) router.refresh()
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [router])
  return <LanguageContext.Provider value={initialLanguage}>{children}</LanguageContext.Provider>
}
export function useLanguage() {
  const initialLanguage = useContext(LanguageContext)
  const language = useSyncExternalStore(subscribeLanguage, getLanguageSnapshot, () => initialLanguage)
  const t = useCallback((text: string, values?: TranslationValues) => translate(text, language, values), [language])
  return { language, locale: languageLocale(language), t }
}
