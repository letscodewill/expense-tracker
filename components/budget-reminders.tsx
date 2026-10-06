'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { categoryTotals, dueExpenses, localToday, monthStart, type CategorizedExpense } from '@/lib/budgeting'
import { useCategories } from '@/lib/use-categories'
import { CategoryManager } from '@/components/category-manager'
import type { MonthYear } from '@/components/month-year-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export function BudgetReminders({ selected, refreshKey }: { selected: MonthYear; refreshKey: number }) {
  const client = createClient()
  const { categories, loading: categoriesLoading, error: categoriesError } = useCategories()
  const [expenses, setExpenses] = useState<CategorizedExpense[]>([])
  const [due, setDue] = useState<CategorizedExpense[]>([])
  const [limits, setLimits] = useState<Record<string, string>>({})
  const [userId, setUserId] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [days, setDays] = useState(3)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [tick, setTick] = useState(0)
  const [today, setToday] = useState(localToday)
  const notified = useRef('')
  const busy = useRef(false)
  const dirtyLimits = useRef(false)
  const loadedMonth = useRef(monthStart(selected.year, selected.month))
  const month = monthStart(selected.year, selected.month)
  const previous = monthStart(selected.year, selected.month - 1)
  const currentTotals = categoryTotals(expenses, month.slice(0, 7), categories)
  const previousTotals = categoryTotals(expenses, previous.slice(0, 7), categories)

  useEffect(() => {
    const timer = setInterval(() => { setToday(localToday()); setTick(value => value + 1) }, 60000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    let active = true
    async function load() {
      if (loadedMonth.current !== month) { loadedMonth.current = month; dirtyLimits.current = false; setUserId('') }
      setLoading(true); setError('')
      try {
        const { data: { user }, error: authError } = await client.auth.getUser()
        if (!user || authError) throw new Error('Entre novamente para consultar orçamento e lembretes.')
        const until = new Date(`${today}T12:00:00Z`); until.setUTCDate(until.getUTCDate() + 15)
        async function read(pending: boolean) {
          const result: CategorizedExpense[] = []
          for (let offset = 0; ; offset += 1000) {
            let query = client.from('expenses').select('id,nome,valor,category,data_pagamento,status').eq('user_id', user!.id).is('represents_board_id', null)
            query = pending ? query.eq('status', 'Pendente').lt('data_pagamento', until.toISOString().slice(0, 10))
              : query.gte('data_pagamento', previous).lt('data_pagamento', monthStart(selected.year, selected.month + 1))
            const { data, error } = await query.order('id').range(offset, offset + 999)
            if (error || !data) throw new Error('Não foi possível carregar despesas.')
            result.push(...data)
            if (data.length < 1000) return result
          }
        }
        const results = await Promise.all([read(false), read(true), client.from('category_budgets').select('category,amount').eq('user_id', user.id).eq('month', month), client.from('reminder_preferences').select('browser_enabled,days_before').eq('user_id', user.id).maybeSingle()])
        if (results[2].error || results[3].error) throw new Error('Não foi possível carregar orçamento e preferências.')
        if (!active) return
        setUserId(user.id); setExpenses(results[0]); setDue(results[1])
        if (!dirtyLimits.current) setLimits(Object.fromEntries((results[2].data ?? []).map(row => [row.category, String(row.amount)])))
        setEnabled(results[3].data?.browser_enabled ?? false); setDays(results[3].data?.days_before ?? 3)
      } catch (err) { if (active) setError(err instanceof Error ? err.message : 'Falha ao carregar dados.') }
      finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [client, selected.month, selected.year, month, previous, refreshKey, tick, today])

  const reminders = dueExpenses(due, today, days)
  useEffect(() => {
    if (loading || error || !enabled || !userId || !reminders.length || !('Notification' in window) || Notification.permission !== 'granted') return
    const key = `expense-reminder:${userId}:${today}`
    if (notified.current === key) return
    try { if (localStorage.getItem(key)) return } catch { /* Memory guard remains available if storage is blocked. */ }
    try {
      new Notification('NoControle: contas a pagar', { body: `${reminders.length} despesa(s) vencida(s) ou a vencer nos próximos ${days} dias. Abra o painel para conferir.`, tag: key })
      notified.current = key
      try { localStorage.setItem(key, '1') } catch { /* Keep the memory guard for this visit. */ }
    } catch { /* Some mobile browsers require push/service workers; dashboard alerts still work. */ }
  }, [loading, error, enabled, userId, today, days, reminders])

  async function saveLimits() {
    if (busy.current || !userId) return
    busy.current = true; setSaving(true); setError(''); setMessage('')
    try {
      const payload = categories.filter(category => limits[category]?.trim()).map(category => ({ user_id: userId, month, category, amount: Number(limits[category].replace(',', '.')) }))
      if (payload.some(row => !Number.isFinite(row.amount) || row.amount <= 0 || row.amount > 10000000)) throw new Error('Informe limites maiores que zero ou deixe em branco para remover.')
      if (payload.length) {
        const { error } = await client.from('category_budgets').upsert(payload, { onConflict: 'user_id,month,category' })
        if (error) throw new Error('Não foi possível salvar os limites.')
      }
      const blank = categories.filter(category => !limits[category]?.trim())
      if (blank.length) {
        const { error } = await client.from('category_budgets').delete().eq('user_id', userId).eq('month', month).in('category', blank)
        if (error) throw new Error('Não foi possível remover limites vazios. Confira e tente novamente.')
      }
      setMessage('Orçamento deste mês salvo.')
      dirtyLimits.current = false
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao salvar orçamento.') }
    finally { busy.current = false; setSaving(false) }
  }
  async function savePreferences(nextEnabled: boolean, nextDays: number) {
    if (busy.current || !userId) return
    busy.current = true; setSaving(true); setError(''); setMessage('')
    try {
      if (nextEnabled) {
        if (!('Notification' in window) || !window.isSecureContext) throw new Error('Este navegador não oferece notificações. Os avisos continuam no painel.')
        const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
        if (permission !== 'granted') throw new Error('Permita notificações nas configurações do navegador. Os avisos continuam no painel.')
      }
      const { error } = await client.from('reminder_preferences').upsert({ user_id: userId, browser_enabled: nextEnabled, days_before: nextDays })
      if (error) throw new Error('Não foi possível salvar a preferência de lembretes.')
      setEnabled(nextEnabled); setDays(nextDays); setMessage('Preferências de lembretes salvas.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao salvar preferências.') }
    finally { busy.current = false; setSaving(false) }
  }
  return <section className="space-y-4" aria-label="Orçamento e lembretes">
    <CategoryManager onChanged={() => setTick(value => value + 1)} />
    {categoriesError && <p role="alert" className="text-sm text-destructive">{categoriesError}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    <div className="material-toolbar space-y-3 p-4">
      <h2 className="text-lg font-semibold">Lembretes de vencimento</h2>
      <p className="text-sm text-muted-foreground">Avisos de hoje, independentemente do mês selecionado. Atualizados a cada minuto com esta página aberta.</p>
      {loading ? <p role="status">Carregando lembretes...</p> : reminders.length ? <details open><summary className="cursor-pointer font-medium">{reminders.length} despesa(s) vencida(s) ou a vencer</summary><ul className="mt-3 max-h-56 space-y-2 overflow-auto">{reminders.map(row => <li key={row.id} className="flex flex-wrap justify-between gap-2 text-sm"><span>{row.nome} — {row.data_pagamento.split('-').reverse().join('/')} {row.data_pagamento < today ? '(Vencida)' : row.data_pagamento === today ? '(Vence hoje)' : ''}</span><span>{money(row.valor)}</span></li>)}</ul></details> : !error && <p className="text-sm">Nenhuma conta pendente neste período.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">Avisar com <select aria-label="Antecedência dos lembretes" value={days} disabled={saving || loading} onChange={event => void savePreferences(enabled, Number(event.target.value))} className="rounded-lg border bg-background p-2">{[0,1,3,7,14].map(value => <option key={value} value={value}>{value} dia(s)</option>)}</select> de antecedência</label>
        <Button variant="outline" disabled={saving || loading} onClick={() => void savePreferences(!enabled, days)}>{enabled ? 'Desativar notificações' : 'Ativar notificações no navegador'}</Button>
      </div>
      <p className="text-xs text-muted-foreground">A preferência fica salva na conta. Cada navegador precisa de permissão. Notificações dependem do suporte do navegador e desta página aberta; esta versão não envia avisos com o site fechado.</p>
    </div>
    <details className="material-toolbar p-4" open>
      <summary className="cursor-pointer text-lg font-semibold">Categorias e orçamento — {month.slice(0,7).split('-').reverse().join('/')}</summary>
      <p className="my-3 text-sm text-muted-foreground">Despesas de todos os quadros por mês de pagamento, incluindo pagas e VR/VA. Resumos automáticos não são somados novamente. Limites valem somente para este mês.</p>
      {loading || categoriesLoading ? <p role="status">Carregando orçamento...</p> : <fieldset disabled={saving || !userId || !!categoriesError} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{categories.map(category => {
        const spent = currentTotals[category], before = previousTotals[category], limit = Number(limits[category]?.replace(',', '.')) || 0
        return <div key={category} className="space-y-2 rounded-xl border p-3">
          <h3 className="font-medium">{category}</h3><p className="text-sm">Este mês: <strong>{money(spent)}</strong></p>
          <p className="text-xs text-muted-foreground">Mês anterior: {money(before)} · Diferença: {money(spent-before)}</p>
          <label className="block text-sm">Limite mensal (R$)<Input aria-label={`Limite de ${category}`} type="number" step="0.01" min="0.01" placeholder="Sem limite" value={limits[category] ?? ''} onChange={event => { dirtyLimits.current = true; setLimits(previous => ({ ...previous, [category]: event.target.value })) }} /></label>
          {limit > 0 && <><progress aria-label={`Uso do orçamento de ${category}`} className="h-2 w-full accent-primary" max={limit} value={Math.min(spent,limit)} /><p className={`text-xs ${spent > limit ? 'text-destructive' : 'text-muted-foreground'}`}>{spent > limit ? `Limite excedido em ${money(spent-limit)}` : `Disponível: ${money(limit-spent)}`}</p></>}
        </div>
      })}</fieldset>}
      <Button className="mt-4" onClick={() => void saveLimits()} disabled={loading || categoriesLoading || saving || !userId || !!categoriesError}>Salvar orçamento do mês</Button>
    </details>
  </section>
}
