'use client'

import { CalendarDays, Check, FileSpreadsheet, FileText, Moon, Palette, Plus, Search, Sun, WalletCards } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import type { FeatureTourStep } from '@/lib/feature-tour'

export function FeatureTourArtwork({ step, label }: { step: FeatureTourStep; label: string }) {
  const { t, locale } = useLanguage()
  const money = (amount: number) => amount.toLocaleString(locale, { style: 'currency', currency: 'BRL' })
  const row = (name: string, amount: number) => <div key={name} className="flex items-center justify-between gap-3 rounded-xl bg-background/80 px-3 py-2.5 text-sm"><span className="truncate">{t(name)}</span><span className="shrink-0 font-semibold tabular-nums">{money(amount)}</span></div>
  return <div role="img" aria-label={label} className="relative flex min-h-52 items-center justify-center overflow-hidden rounded-2xl border border-primary/15 bg-secondary/40 p-4 sm:min-h-64 sm:p-7">
    <div aria-hidden="true" className="w-full max-w-lg space-y-3">
      {step === 'expense' && <>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="flex items-center gap-2 rounded-full bg-card px-3 py-2"><CalendarDays className="size-4 text-primary" />{t('Novembro')} 2026</span><span className="font-medium text-primary">{t('Em qual mês adicionar?')}</span></div>
        <div className="relative space-y-3 rounded-2xl border bg-card p-4 shadow-sm"><div className="flex items-center gap-2 text-sm font-medium"><WalletCards className="size-4 text-primary" />{t('Cartão de crédito')}</div>{row('Mercado', 80)}{row('Internet', 99)}<div className="flex items-center justify-between gap-2 text-xs"><span>{t('Restante a pagar')}</span><strong>{money(179)}</strong></div><span className="absolute -bottom-3 -right-1 flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg"><Plus className="size-6" /></span></div>
      </>}
      {step === 'import' && <>
        <div className="flex justify-center gap-3"><span className="flex items-center gap-2 rounded-xl bg-card px-4 py-2 text-sm"><FileText className="size-5 text-primary" />PDF</span><span className="flex items-center gap-2 rounded-xl bg-card px-4 py-2 text-sm"><FileSpreadsheet className="size-5 text-primary" />Excel / CSV</span></div>
        <div className="space-y-2 rounded-2xl border bg-card p-4 shadow-sm"><p className="mb-3 text-sm font-medium">{t('Conferir despesas')}</p>{row('Mercado', 80)}{row('Internet', 99)}<p className="flex items-center gap-2 pt-2 text-xs text-primary"><Check className="size-4 shrink-0" />{t('Revise antes de salvar')}</p></div>
      </>}
      {step === 'planning' && <>
        <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm"><div className="flex items-center justify-between text-sm"><span className="font-medium">{t('Mercado')}</span><span>{money(240)} / {money(400)}</span></div><div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full w-3/5 rounded-full bg-primary" /></div><p className="text-xs text-muted-foreground">{t('Disponível: ')}{money(160)}</p></div>
        <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-card p-4"><CalendarDays className="size-6 shrink-0 text-primary" /><div className="min-w-0"><p className="text-sm font-medium">{t('Lembretes de vencimento')}</p><p className="text-xs text-muted-foreground">{t('Internet')} · {t('(Vence hoje)')}</p></div></div>
      </>}
      {step === 'search' && <>
        <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-card px-4 py-3 text-sm shadow-sm"><Search className="size-5 text-primary" />{t('Mercado')}<span className="ml-auto text-xs text-muted-foreground">{money(80)}</span></div>
        <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">{row('Mercado', 80)}<div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-secondary px-3 py-1">{t('Cartão de crédito')}</span><span className="rounded-full bg-muted px-3 py-1">{t('Novembro')} 2026</span></div><p className="text-xs font-medium text-primary">{t('Ver mês no painel')} →</p></div>
      </>}
      {step === 'appearance' && <>
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm"><span className="flex size-11 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">NC</span><div><p className="text-sm font-medium">NoControle</p><p className="text-xs text-muted-foreground">{t('Seu painel, do seu jeito')}</p></div><Palette className="ml-auto size-6 text-primary" /></div>
        <div className="grid grid-cols-2 gap-3"><div className="flex items-center justify-center gap-2 rounded-xl bg-card p-3 text-xs"><Sun className="size-4 text-primary" />{t('Claro')}<Moon className="ml-1 size-4 text-primary" />{t('Escuro')}</div><div className="flex items-center justify-center gap-2 rounded-xl bg-card p-3 text-xs"><span>Português</span><span className="text-muted-foreground">/</span><span>English</span></div></div>
        <div className="flex justify-center gap-3">{['#d0bcff', '#a1dbc5', '#ffc3a6', '#b3d4ff'].map(color => <span key={color} className="size-7 rounded-full border border-foreground/10 shadow-sm" style={{ backgroundColor: color }} />)}</div>
      </>}
    </div>
  </div>
}
