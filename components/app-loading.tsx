'use client'

import { LoaderCircle } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'

export function AppLoading({ compact = false }: { compact?: boolean }) {
  const { t } = useLanguage()
  return <div role="status" aria-live="polite" className={compact
    ? 'flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground'
    : 'flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-6 text-center'}>
    <LoaderCircle aria-hidden="true" className="size-7 shrink-0 animate-spin text-primary motion-reduce:animate-none" />
    <div>
      {!compact && <p className="mb-2 text-lg font-semibold text-primary">NoControle</p>}
      <p>{t(compact ? 'Carregando seus quadros...' : 'Preparando seu painel...')}</p>
    </div>
  </div>
}
