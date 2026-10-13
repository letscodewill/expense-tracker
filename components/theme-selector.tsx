'use client'

import { useLanguage } from '@/components/language-provider'
import { useSyncExternalStore } from 'react'
import { Sun, Moon, Check } from 'lucide-react'
import { THEMES, getThemeSnapshot, getServerThemeSnapshot, subscribeTheme, selectTheme } from '@/lib/themes'

export function ThemeSelector() {
  const { t } = useLanguage()

  const current = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot)
  const mode = current.endsWith('-dark') ? 'dark' : 'light'
  const family = current.split('-')[0]
  return <div className="space-y-3 rounded-2xl bg-muted/50 p-3">
    <p className="text-xs font-medium text-muted-foreground">{t("Aparência")}</p>
    <div role="group" aria-label={t("Modo de aparência")} className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
      {([{ value: 'light', label: t("Claro"), Icon: Sun }, { value: 'dark', label: t("Escuro"), Icon: Moon }] as const).map(({ value, label, Icon }) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => {
        const theme = THEMES.find(theme => theme.id === `${family}-${value}`)
        if (theme) selectTheme(theme.id)
      }} className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${mode === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>
        <Icon className="size-4" aria-hidden="true" />{label}
      </button>)}
    </div>
    <div role="group" aria-label={t("Paleta de cores")} className="grid grid-cols-2 gap-2">
      {THEMES.filter(theme => theme.mode === mode).map(theme => <button key={theme.id} type="button" aria-label={`${t(theme.name)} ${mode === 'light' ? t("claro") : t("escuro")}`} aria-pressed={current === theme.id} title={t(theme.description)} onClick={() => selectTheme(theme.id)} className={`relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-2 rounded-xl border px-1 py-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${current === theme.id ? 'border-primary bg-secondary text-secondary-foreground' : 'border-transparent hover:bg-accent'}`}>
        <span className="flex overflow-hidden rounded-full border border-foreground/15" aria-hidden="true">{theme.colors.map(color => <span key={color} className="h-4 w-4" style={{ backgroundColor: color }} />)}</span>
        {t(theme.name)}{current === theme.id && <Check className="absolute right-1 top-1 size-3 text-primary" aria-hidden="true" />}
      </button>)}
    </div>
  </div>
}
