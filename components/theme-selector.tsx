'use client'

import { useSyncExternalStore } from 'react'
import { Sun, Moon } from 'lucide-react'
import { getThemeSnapshot, getServerThemeSnapshot, subscribeTheme, selectTheme } from '@/lib/themes'

export function ThemeSelector() {
  const current = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot)
  return <div className="space-y-2"><p className="text-xs font-medium text-muted-foreground">Aparência</p><div role="group" aria-label="Tema de aparência" className="inline-flex items-center gap-1 rounded-xl bg-muted p-1">
    {([{ id: 'lavender-light', label: 'Claro', Icon: Sun }, { id: 'lavender-dark', label: 'Escuro', Icon: Moon }] as const).map(({ id, label, Icon }) => <button key={id} type="button" aria-pressed={current === id} onClick={() => selectTheme(id)} className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${current === id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}>
      <Icon className="size-4" aria-hidden="true" />{label}
    </button>)}
  </div></div>
}
