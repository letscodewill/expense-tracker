'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/components/language-provider'
import { createClient } from '@/lib/supabase/client'
import { followingMonth, initialMonth, isMonthSettled, mayOfferNextMonth, MONTH_START_KEY, monthKey, monthPreference, parseMonth, saveMonthChoice, type MonthStartPreference } from '@/lib/month-rollover'
import type { MonthYear } from '@/components/month-year-picker'
import { Button } from '@/components/ui/button'
import { CheckCircle2, RotateCcw } from 'lucide-react'

export function MonthRolloverPrompt({ selected, refreshKey, onChange }: { selected: MonthYear; refreshKey: number; onChange: (month: MonthYear) => void }) {
  const { t, locale } = useLanguage()
  const router = useRouter()
  const [client] = useState(() => createClient())
  const [check, setCheck] = useState<{ key: string; userId: string; preference: MonthStartPreference; settled: boolean } | null>(null)
  const [retry, setRetry] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)
  const revision = useRef(0)
  const key = monthKey(selected)
  const refresh = useCallback(() => setRetry(value => value + 1), [])
  useEffect(() => {
    const current = ++revision.current
    let active = true
    async function inspect() {
      try {
        const { data: { user }, error } = await client.auth.getUser()
        if (error || !user) { if (active && current === revision.current) setCheck(null); return }
        const preference = monthPreference(user.user_metadata?.[MONTH_START_KEY])
        const settled = mayOfferNextMonth(key, preference) && await isMonthSettled(client, user.id, key)
        if (active && current === revision.current) setCheck({ key, userId: user.id, preference, settled })
      } catch { if (active && current === revision.current) setCheck(null) }
    }
    void inspect()
    window.addEventListener('focus', refresh)
    return () => { active = false; window.removeEventListener('focus', refresh) }
  }, [client, key, refreshKey, retry, refresh])

  const state = check?.key === key ? check : null
  const offer = !!state?.settled && mayOfferNextMonth(key, state.preference)
  const currentMonth = monthKey(initialMonth(null))
  const canReset = !!state?.preference.home && state.preference.home !== currentMonth
  const next = followingMonth(key)
  function label(value: string) {
    const month = parseMonth(value)!
    const date = new Date(0)
    date.setUTCFullYear(month.year, month.month, 1)
    return date.toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  }
  async function choose(advance: boolean, reset = false) {
    if (!state || busy.current) return
    busy.current = true; setSaving(true); setError('')
    const selectedKey = key
    const version = revision.current
    try {
      const preference = await saveMonthChoice(client, state.userId, reset ? null : selectedKey, advance)
      if (version === revision.current) setCheck({ ...state, preference, settled: false })
      // A successful save is required before navigating or refreshing the page.
      if (version === revision.current) onChange(reset ? initialMonth(null) : advance ? parseMonth(followingMonth(selectedKey))! : selected)
      router.refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar sua preferência. Tente novamente.') }
    finally { busy.current = false; setSaving(false) }
  }
  if (!offer && !canReset) return null
  return <section aria-label={t('Mês inicial do painel')} aria-busy={saving} className={offer ? "w-full space-y-3 rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-5" : "inline-flex max-w-full flex-wrap items-center gap-2"}>
    {offer && next && <>
      <p className="flex items-center gap-2 font-medium text-primary"><CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />{t('Mês quitado!')}</p>
      <p className="text-sm">{t('Todas as despesas de {month} estão resolvidas. Quer abrir o painel em {next} nos próximos acessos?', { month: label(key), next: label(next) })}</p>
      <p className="text-xs text-muted-foreground">{t('A escolha fica salva na conta. Você pode consultar qualquer mês pelo seletor. Pago e VR/VA não deixam pendências.')}</p>
      <div className="flex flex-wrap gap-2"><Button disabled={saving} onClick={() => void choose(true)}>{t('Sim, usar o próximo mês')}</Button><Button variant="outline" disabled={saving} onClick={() => void choose(false)}>{t('Não, manter este mês')}</Button></div>
    </>}
    {canReset && <Button variant="ghost" size="sm" className="size-9 shrink-0 rounded-full p-0" title={t('Voltar ao mês atual como padrão')} aria-label={t('Voltar ao mês atual como padrão')} disabled={saving} onClick={() => void choose(false, true)}><RotateCcw className="size-4" aria-hidden="true" /></Button>}
    {saving && <p role="status" className="text-sm text-muted-foreground">{t('Salvando...')}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
  </section>
}
