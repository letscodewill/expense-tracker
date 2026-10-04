'use client'

import { useSyncExternalStore } from 'react'
import { Palette, Check } from 'lucide-react'
import { THEMES, getThemeSnapshot, getServerThemeSnapshot, subscribeTheme, selectTheme } from '@/lib/themes'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

export function ThemeSelector() {
  const current = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot)
  return <Dialog>
    <DialogTrigger render={<Button variant="outline" size="sm" />}><Palette className="mr-1 size-4" />Temas</DialogTrigger>
    <DialogContent className="sm:max-w-xl">
      <DialogHeader><DialogTitle>Personalizar aparência</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">Escolha uma combinação pastel. A mudança é imediata e fica salva neste navegador.</p>
      {(['light', 'dark'] as const).map(mode => <section key={mode} className="space-y-3" aria-label={mode === 'light' ? 'Temas claros' : 'Temas escuros'}>
        <h3 className="text-sm font-medium">{mode === 'light' ? 'Temas claros' : 'Temas escuros'}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {THEMES.filter(theme => theme.mode === mode).map(theme => <button key={theme.id} type="button" aria-pressed={current === theme.id} onClick={() => selectTheme(theme.id)} className={`rounded-2xl border p-3 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${current === theme.id ? 'border-primary bg-accent ring-1 ring-primary' : 'border-border'}`}>
            <span aria-hidden="true" className="mb-3 flex h-10 overflow-hidden rounded-xl border border-border">{theme.colors.map(color => <span key={color} className="flex-1" style={{ backgroundColor: color }} />)}</span>
            <span className="flex items-center justify-between gap-2 text-sm font-medium">{theme.name}{current === theme.id && <Check className="size-4 text-primary" aria-hidden="true" />}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{theme.description}</span>
          </button>)}
        </div>
      </section>)}
    </DialogContent>
  </Dialog>
}
