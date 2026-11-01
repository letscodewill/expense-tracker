'use client'

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { getLanguageSnapshot, LANGUAGE_STORAGE_KEY, LANGUAGE_MANUAL_KEY, normalizeLanguage, initializeLanguage, selectLanguage, subscribeLanguage, translate, languageLocale, type Language, type TranslationValues } from '@/lib/i18n'
import { initializeCurrency, selectCurrency, normalizeCurrency, CURRENCY_STORAGE_KEY, CURRENCY_MANUAL_KEY, type DisplayCurrency } from '@/lib/currency'

const LanguageContext = createContext<Language>('pt-BR')
const RegionalContext = createContext<{country:string|null;initialCurrency:DisplayCurrency}>({country:null,initialCurrency:'BRL'})
export function useRegionalDefaults() { return useContext(RegionalContext) }
export function LanguageProvider({ children, initialLanguage, initialCurrency='BRL', country=null }: { children: ReactNode; initialLanguage: Language; initialCurrency?:DisplayCurrency;country?:string|null }) {
  const router = useRouter()
  useEffect(() => {
    let stored: string | null = null
    try { if(localStorage.getItem(LANGUAGE_MANUAL_KEY)==='1') stored = localStorage.getItem(LANGUAGE_STORAGE_KEY) } catch {}
    const nextLanguage = stored === null ? initialLanguage : normalizeLanguage(stored)
    if(stored===null) initializeLanguage(nextLanguage)
    else selectLanguage(nextLanguage)
    if (nextLanguage !== initialLanguage) router.refresh()
  }, [initialLanguage, router])
  useEffect(()=>{
    let stored: string|null=null
    try {if(localStorage.getItem(CURRENCY_MANUAL_KEY)==='1')stored=localStorage.getItem(CURRENCY_STORAGE_KEY)}catch{}
    if(stored===null) initializeCurrency(initialCurrency)
    else {
      const next=normalizeCurrency(stored)
      selectCurrency(next)
      if(next!==initialCurrency) router.refresh()
    }
  },[initialCurrency,router])
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === LANGUAGE_STORAGE_KEY || event.key === null) router.refresh()
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [router])
  return <RegionalContext.Provider value={{country,initialCurrency}}><LanguageContext.Provider value={initialLanguage}>{children}</LanguageContext.Provider></RegionalContext.Provider>
}
export function useLanguage() {
  const initialLanguage = useContext(LanguageContext)
  const language = useSyncExternalStore(subscribeLanguage, getLanguageSnapshot, () => initialLanguage)
  const t = useCallback((text: string, values?: TranslationValues) => translate(text, language, values), [language])
  return { language, locale: languageLocale(language), t }
}
