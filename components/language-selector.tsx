'use client'

import { Languages } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useLanguage } from './language-provider'
import { selectLanguage } from '@/lib/i18n'

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { language } = useLanguage()
  const router = useRouter()
  return <label className={`inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card text-card-foreground ${compact ? 'px-2' : 'px-3 py-2'}`}>
    <Languages className="size-4 shrink-0" aria-hidden="true" />
    <span className="sr-only">{language === 'en' ? 'Language' : 'Idioma'}</span>
    <select aria-label={language === 'en' ? 'Language' : 'Idioma'} value={language} onChange={event => {
      selectLanguage(event.target.value === 'en' ? 'en' : 'pt-BR')
      router.refresh()
    }} className="min-w-0 cursor-pointer bg-card text-sm text-card-foreground focus-visible:outline-2 focus-visible:outline-primary">
      <option value="pt-BR">Português</option>
      <option value="en">English</option>
    </select>
  </label>
}
