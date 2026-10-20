'use client'

import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import { PiggyBank, Trophy, ArrowDownLeft, ArrowUpRight, Target } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/language-provider'
import { useCurrency } from '@/lib/use-currency'
import { savingsCents, savingsProgress, type SavingsAccount } from '@/lib/savings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

type Action = 'goal' | 'deposit' | 'withdraw'
type Attempt = { action: Action; cents: number; id: string }
const initialAccount: SavingsAccount = { balance_cents: 0, goal_cents: null }
const safeErrors = new Set(['O valor da retirada é maior que o saldo do cofrinho.', 'O saldo ultrapassaria o limite permitido.'])

export function SavingsPanel() {
  const { t, locale } = useLanguage()
  const currency = useCurrency()
  const client = createClient()
  const [account, setAccount] = useState<SavingsAccount>(initialAccount)
  const [goal, setGoal] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [celebrate, setCelebrate] = useState(false)
  const inFlight = useRef(false)
  const attempt = useRef<Attempt | null>(null)
  const goalInput = useRef<HTMLInputElement>(null)
  const progress = savingsProgress(account)
  const money = (cents: number) => (cents / 100).toLocaleString(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })

  const load = useCallback(async () => {
    try {
      const { data, error } = await client.rpc('savings_account_action', { action_input: 'read' })
      if (error || !data) throw new Error('load')
      setLoadFailed(false); setError('')
      setAccount(data)
      setGoal(data.goal_cents ? (data.goal_cents / 100).toFixed(2) : '')
    } catch { setLoadFailed(true); setError('Não foi possível carregar o cofrinho. Tente novamente.') }
    finally { setLoading(false) }
  }, [client])

  useEffect(() => { startTransition(() => { void load() }) }, [load])

  async function submit(action: Action) {
    if (inFlight.current || loading || loadFailed) return
    const cents = savingsCents(action === 'goal' ? goal : amount)
    if (!attempt.current && cents === null) { setError('Informe um valor positivo com até duas casas decimais.'); return }
    if (!attempt.current && action === 'withdraw' && cents! > account.balance_cents) { setError('O valor da retirada é maior que o saldo do cofrinho.'); return }
    inFlight.current = true; setBusy(true); setError(''); setMessage('')
    try {
      // Retain this ID across an uncertain network response, even if the server
      // already committed it. All forms remain locked until the retry resolves.
      const current = attempt.current ?? { action, cents: cents!, id: crypto.randomUUID() }
      attempt.current = current
      const { data, error } = await client.rpc('savings_account_action', {
        action_input: current.action, amount_input: current.cents, request_input: current.id,
      })
      if (error || !data) {
        if (error && ['22023', '23514', '42501'].includes(error.code)) {
          attempt.current = null; setUncertain(false)
          setError(safeErrors.has(error.message) ? error.message : 'Não foi possível salvar o cofrinho. Tente novamente.')
          return
        }
        throw new Error('uncertain')
      }
      const reached = savingsProgress(data).achieved
      if (reached && (!progress.achieved || (current.action === 'goal' && data.goal_cents !== account.goal_cents))) setCelebrate(true)
      setAccount(data)
      setGoal(data.goal_cents ? (data.goal_cents / 100).toFixed(2) : '')
      if (current.action !== 'goal') setAmount('')
      setMessage(current.action === 'goal' ? 'Meta salva.' : current.action === 'deposit' ? 'Valor adicionado ao cofrinho.' : 'Retirada registrada.')
      attempt.current = null; setUncertain(false)
    } catch {
      setUncertain(attempt.current !== null)
      setError(attempt.current ? 'Não foi possível confirmar a operação. Tente novamente para verificar a mesma movimentação.' : 'Não foi possível salvar o cofrinho. Tente novamente.')
    } finally { inFlight.current = false; setBusy(false) }
  }

  function changeGoal() {
    setCelebrate(false)
    setGoal('')
    goalInput.current?.focus()
  }

  const disabled = busy || loading || loadFailed || uncertain
  return <div className="space-y-5">
    <section className="rounded-3xl border border-border bg-card p-5 text-card-foreground sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3"><span className="rounded-2xl bg-primary/10 p-3 text-primary"><PiggyBank className="size-7" aria-hidden="true" /></span><div><p className="text-sm text-muted-foreground">{t('Saldo do cofrinho')}</p><p className="text-3xl font-semibold tabular-nums sm:text-4xl">{loading || loadFailed ? '—' : money(account.balance_cents)}</p></div></div>
        {progress.achieved && !loadFailed && <div className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary"><Trophy className="size-5" aria-hidden="true" />{t('Objetivo alcançado!')}</div>}
      </div>
      {loading ? <p className="mt-6 text-sm text-muted-foreground">{t('Carregando...')}</p> : !loadFailed && <div className="mt-7 space-y-3">
        <div className="flex flex-wrap justify-between gap-2 text-sm"><span>{account.goal_cents ? `${t('Meta')}: ${money(account.goal_cents)}` : t('Defina uma meta para começar.')}</span><span className="font-medium tabular-nums">{(Math.floor(progress.percent * 10) / 10).toLocaleString(locale, { maximumFractionDigits: 1 })}%</span></div>
        <progress aria-label={t('Progresso da meta')} max={100} value={progress.percent} className="savings-progress block h-4 w-full overflow-hidden rounded-full bg-muted accent-primary" />
        {account.goal_cents && <p className="text-sm text-muted-foreground">{progress.achieved ? t('Parabéns! Você chegou à sua meta.') : t('Faltam {amount} para atingir sua meta.', { amount: money(progress.remaining) })}</p>}
        {progress.achieved && <Button variant="outline" disabled={disabled} onClick={changeGoal}>{t('Alterar meta')}</Button>}
      </div>}
    </section>

    <div aria-live="polite" className="space-y-2">
      {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
      {message && <p role="status" className="text-sm text-primary">{t(message)}</p>}
      {loadFailed && <Button variant="outline" onClick={() => { setLoading(true); setLoadFailed(false); setError(''); void load() }}>{t('Tentar novamente')}</Button>}
      {uncertain && <Button disabled={busy} onClick={() => attempt.current && void submit(attempt.current.action)}>{t('Tentar novamente')}</Button>}
    </div>

    <div className="grid gap-5 md:grid-cols-2">
      <form onSubmit={event => { event.preventDefault(); void submit('goal') }} className="space-y-4 rounded-2xl border bg-card p-5 text-card-foreground">
        <h2 className="flex items-center gap-2 text-lg font-medium"><Target className="size-5 text-primary" aria-hidden="true" />{t('Sua meta')}</h2>
        <div className="space-y-2"><Label htmlFor="savings-goal">{t('Valor da meta')} ({currency})</Label><Input ref={goalInput} id="savings-goal" inputMode="decimal" maxLength={15} value={goal} onChange={event => setGoal(event.target.value)} disabled={disabled} placeholder="1000,00" required /></div>
        <Button type="submit" disabled={disabled} className="w-full">{t('Salvar meta')}</Button>
        <p className="text-xs leading-relaxed text-muted-foreground">{t('Alterar a meta não zera o valor já guardado.')}</p>
      </form>
      <section className="space-y-4 rounded-2xl border bg-card p-5 text-card-foreground">
        <h2 className="text-lg font-medium">{t('Movimentar cofrinho')}</h2>
        <div className="space-y-2"><Label htmlFor="savings-amount">{t('Valor')} ({currency})</Label><Input id="savings-amount" inputMode="decimal" maxLength={15} value={amount} onChange={event => setAmount(event.target.value)} disabled={disabled} placeholder="50,00" /></div>
        <div className="flex flex-wrap gap-2"><Button disabled={disabled} onClick={() => void submit('deposit')} className="flex-1 gap-2"><ArrowDownLeft className="size-4" aria-hidden="true" />{t('Adicionar valor')}</Button><Button variant="outline" disabled={disabled || account.balance_cents === 0} onClick={() => void submit('withdraw')} className="flex-1 gap-2"><ArrowUpRight className="size-4" aria-hidden="true" />{t('Retirar valor')}</Button></div>
      </section>
    </div>
    <p className="text-sm leading-relaxed text-muted-foreground">{t('O cofrinho é um controle do que você guardou. Não transfere dinheiro e não altera suas despesas ou seu salário.')}</p>
    <Dialog open={celebrate} onOpenChange={setCelebrate}>
      <DialogContent className="text-center sm:max-w-md" finalFocus={goalInput}>
        <Trophy className="mx-auto mt-3 size-16 text-primary" aria-hidden="true" />
        <DialogHeader><DialogTitle className="text-xl">{t('Objetivo alcançado!')}</DialogTitle><DialogDescription>{t('Parabéns! Você chegou à sua meta. Quer definir um novo objetivo?')}</DialogDescription></DialogHeader>
        <div className="flex flex-wrap justify-center gap-2"><Button variant="outline" onClick={() => setCelebrate(false)}>{t('Agora não')}</Button><Button onClick={changeGoal}>{t('Alterar meta')}</Button></div>
      </DialogContent>
    </Dialog>
  </div>
}
