'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Gift, ShieldCheck } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import { changeCourtesy } from '@/app/admin/benefits/actions'
import { courtesyStatus, type BenefitUser, type BenefitsOverview, type CourtesyInput } from '@/lib/pro-benefits'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

function dateInput(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`
}

export function ProBenefitsPanel({ overview, search, offset }: { overview: BenefitsOverview; search: string; offset: number }) {
  const { t, locale } = useLanguage()
  const router = useRouter()
  const [selected, setSelected] = useState<BenefitUser | null>(null)
  const [reason, setReason] = useState('')
  const [until, setUntil] = useState('')
  const [permanent, setPermanent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [confirmation, setConfirmation] = useState<'grant' | 'revoke' | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const locked = useRef(false)
  const pending = useRef<CourtesyInput | null>(null)
  const fmt = (date: string | null) => date ? new Date(date).toLocaleString(locale) : t('Sem vencimento')

  function select(user: BenefitUser) {
    if (locked.current || uncertain) return
    setSelected(user); setReason(user.courtesy?.reason ?? ''); setUntil(dateInput(user.courtesy?.expires_at ?? null));
    setPermanent(!!user.courtesy && !user.courtesy.expires_at); setError(''); setMessage(''); pending.current = null
  }

  function review(action: 'grant' | 'revoke') {
    if (!selected || busy || uncertain) return
    setError('')
    if (!reason.trim() || reason.trim().length > 300) { setError('Informe um motivo com até 300 caracteres.'); return }
    if (action === 'grant' && !permanent && (!until || !Number.isFinite(Date.parse(until)) || Date.parse(until) <= Date.now())) { setError('Escolha uma validade futura ou sem vencimento.'); return }
    setConfirmation(action)
  }

  async function save(action: 'grant' | 'revoke') {
    if (locked.current || !selected) return
    locked.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const input = pending.current ?? { action, userId: selected.id, reason: reason.trim(), expiresAt: action==='grant' && !permanent ? new Date(until).toISOString() : null, revision: selected.courtesy?.revision ?? 0, requestId: crypto.randomUUID() }
      pending.current = input
      const result = await changeCourtesy(input)
      if (result.error) {
        setError(result.error)
        if (result.error === 'Não foi possível confirmar a alteração do benefício. Tente novamente.') setUncertain(true)
        else { pending.current = null; setUncertain(false); setConfirmation(null) }
        return
      }
      setMessage(action==='grant' ? 'Pro cortesia atualizado.' : 'Cortesia revogada.')
      setSelected(null); setConfirmation(null); pending.current = null; setUncertain(false); router.refresh()
    } catch { setError('Não foi possível confirmar a alteração do benefício. Tente novamente.'); setUncertain(pending.current !== null) }
    finally { locked.current = false; setBusy(false) }
  }

  return <div className="space-y-6">
    <form action="/admin/benefits" className="flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1"><Label htmlFor="benefits-search">{t('Buscar usuário por e-mail')}</Label><Input id="benefits-search" name="search" defaultValue={search} maxLength={100} type="search" /></div><Button type="submit" disabled={busy || uncertain}>{t('Buscar')}</Button></form>
    {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
    {message && <p role="status" className="text-sm text-primary">{t(message)}</p>}
    <section className="grid gap-3 sm:grid-cols-2">
      {overview.users.map(user => <article key={user.id} className="flex min-w-0 flex-col items-start gap-3 rounded-2xl border bg-card p-4 text-card-foreground">
        <div className="w-full min-w-0"><p className="break-all font-medium">{user.email}</p><p className="break-words text-sm text-muted-foreground">{user.name}</p></div>
        <p className="flex items-center gap-2 text-sm text-primary">{user.is_master ? <ShieldCheck className="size-4" aria-hidden="true" /> : <Gift className="size-4" aria-hidden="true" />}{t(courtesyStatus(user))}</p>
        {user.courtesy && <><p className="text-xs text-muted-foreground">{t('Validade')}: {fmt(user.courtesy.expires_at)}</p><p className="break-words text-sm">{user.courtesy.reason}</p></>}
        {!user.email_confirmed_at && <p className="text-xs text-muted-foreground">{t('A conta precisa ter o e-mail confirmado.')}</p>}
        {!user.is_master && <Button variant="outline" disabled={busy || uncertain || !user.email_confirmed_at} onClick={() => select(user)}>{t('Gerenciar benefício')}</Button>}
      </article>)}
      {overview.users.length === 0 && <p className="text-sm text-muted-foreground">{t('Nenhum usuário encontrado.')}</p>}
    </section>
    <nav className="flex items-center justify-between gap-3 text-sm" aria-label={t('Paginação de usuários')}>
      <span>{t('{count} usuário(s)', { count: overview.total })}</span>
      <div className="flex gap-3">{offset>0 && <Link className="text-primary underline" href={`/admin/benefits?search=${encodeURIComponent(search)}&offset=${Math.max(0,offset-20)}`}>{t('Anterior')}</Link>}{offset+20<overview.total && <Link className="text-primary underline" href={`/admin/benefits?search=${encodeURIComponent(search)}&offset=${offset+20}`}>{t('Próxima')}</Link>}</div>
    </nav>
    {selected && <section className="space-y-4 rounded-2xl border bg-card p-5 text-card-foreground">
      <h2 className="break-all text-lg font-medium">{selected.email}</h2>
      <div className="space-y-2"><Label htmlFor="benefit-reason">{t('Motivo do benefício ou da alteração')}</Label><Input id="benefit-reason" maxLength={300} value={reason} disabled={busy || uncertain} onChange={event => setReason(event.target.value)} /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={permanent} disabled={busy || uncertain} onChange={event => setPermanent(event.target.checked)} />{t('Sem vencimento')}</label>
      {!permanent && <div className="space-y-2"><Label htmlFor="benefit-until">{t('Válido até')}</Label><Input id="benefit-until" type="datetime-local" value={until} disabled={busy || uncertain} onChange={event => setUntil(event.target.value)} /><p className="text-xs text-muted-foreground">{t('Data e hora no fuso do seu dispositivo.')}</p></div>}
      <p className="text-xs text-muted-foreground">{t('Pro cortesia não concede acesso administrativo e não gera cobrança.')}</p>
      <div className="flex flex-wrap gap-3"><Button disabled={busy || uncertain} onClick={() => review('grant')}>{t('Conceder ou prorrogar Pro')}</Button>{selected.courtesy && !selected.courtesy.revoked_at && <Button variant="destructive" disabled={busy || uncertain} onClick={() => review('revoke')}>{t('Revogar cortesia')}</Button>}<Button variant="outline" disabled={busy || uncertain} onClick={() => setSelected(null)}>{t('Cancelar')}</Button></div>
    </section>}
    <section className="space-y-3"><h2 className="text-xl font-medium">{t('Histórico de benefícios')}</h2><p className="text-sm text-muted-foreground">{t('Últimas 20 alterações que correspondem à busca.')}</p>
      <ul className="space-y-3">{overview.history.map(event => <li key={event.id} className="space-y-1 rounded-xl border p-4 text-sm"><p className="break-all font-medium">{event.user_email ?? t('Conta removida')} · {event.action==='grant' ? t('Pro cortesia atualizado.') : t('Cortesia revogada.')}</p><p className="text-muted-foreground">{fmt(event.created_at)} · {t('Por')}: {event.actor_email ?? t('Conta removida')}</p><p className="break-words">{event.after_value.reason}</p><p>{t('Validade anterior')}: {event.before_value ? fmt(event.before_value.expires_at) : '—'} · {t('Nova validade')}: {event.action==='revoke' ? t('Revogada') : fmt(event.after_value.expires_at)}</p></li>)}</ul>
      {overview.history.length===0 && <p className="text-sm text-muted-foreground">{t('Nenhuma alteração registrada.')}</p>}
    </section>
    <Dialog open={confirmation !== null} onOpenChange={open => { if (!open && !busy && !uncertain) setConfirmation(null) }}>
      <DialogContent><DialogHeader><DialogTitle>{confirmation==='revoke' ? t('Revogar cortesia') : t('Confirmar Pro cortesia')}</DialogTitle><DialogDescription>{t('Confira a conta e a validade antes de confirmar.')}</DialogDescription></DialogHeader>
        <p className="break-all font-medium">{selected?.email}</p>
        {confirmation==='grant' && <p>{t('Validade')}: {permanent ? t('Sem vencimento') : (until ? fmt(new Date(until).toISOString()) : '—')}</p>}
        <p className="break-words text-sm">{reason}</p>
        {error && <p role="alert" className="text-destructive">{t(error)}</p>}
        <div className="flex flex-wrap gap-3"><Button disabled={busy} variant={confirmation==='revoke' ? 'destructive' : 'default'} onClick={() => confirmation && void save(confirmation)}>{busy ? t('Salvando...') : uncertain ? t('Tentar novamente') : t('Confirmar')}</Button><Button variant="outline" disabled={busy || uncertain} onClick={() => setConfirmation(null)}>{t('Cancelar')}</Button></div>
      </DialogContent>
    </Dialog>
  </div>
}
