'use client'
import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/components/language-provider'
import { BILLING_OFFERS, type BillingOffer } from '@/lib/billing-offers'
import { Button } from '@/components/ui/button'
import { trackMarketingEvent } from '@/lib/meta-marketing'

type Plan = { plan?: string; source?: string; expires_at?: string | null } | null
type Billing = { has_customer?: boolean; subscriptions?: { status: string; period_end: string | null; cancel_at_period_end: boolean }[]; limits_enabled?: boolean } | null
export function PlansPanel({ signedIn, plan, billing, ready, initialCurrency }: { signedIn: boolean; plan: Plan; billing: Billing; ready: boolean; initialCurrency: 'brl' | 'usd' }) {
  const { t, locale } = useLanguage(), router = useRouter()
  const [currency, setCurrency] = useState(initialCurrency)
  const [interval, setInterval] = useState<'month'|'year'>('year')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), inFlight = useRef(false)
  const key: BillingOffer = `${currency}_${interval}`, offer = BILLING_OFFERS[key]
  const money = (cents: number) => (cents/100).toLocaleString(locale,{ style:'currency',currency:currency.toUpperCase() })
  async function act(action: 'checkout'|'portal'|'refresh') {
    if(inFlight.current) return
    inFlight.current=true;setBusy(true);setError('')
    try {
      const response = await fetch('/api/billing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,offer:key})})
      const data = await response.json()
      if(!response.ok) {setError(data.error || 'Não foi possível concluir a operação. Tente novamente.');return}
      if(action==='refresh') {router.refresh();return}
      const url = new URL(data.url)
      if(url.protocol!=='https:' || !['checkout.stripe.com','billing.stripe.com'].includes(url.hostname)) throw new Error('Invalid checkout')
      if(action==='checkout') trackMarketingEvent('InitiateCheckout',{value:offer.amount/100,currency:offer.currency.toUpperCase()})
      window.location.assign(url.href)
    }catch{setError('Não foi possível concluir a operação. Tente novamente.')}
    finally{inFlight.current=false;setBusy(false)}
  }
  const pro = plan?.plan==='pro'
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-center gap-4 rounded-2xl border bg-card p-4">
      <label className="space-y-1 text-sm"><span className="block">{t('Moeda de cobrança')}</span><select className="rounded-xl border bg-background px-3 py-2" value={currency} onChange={e=>setCurrency(e.target.value as 'brl'|'usd')} disabled={busy}><option value="brl">BRL — R$</option><option value="usd">USD — US$</option></select></label>
      <label className="space-y-1 text-sm"><span className="block">{t('Periodicidade')}</span><select className="rounded-xl border bg-background px-3 py-2" value={interval} onChange={e=>setInterval(e.target.value as 'month'|'year')} disabled={busy}><option value="month">{t('Mensal')}</option><option value="year">{t('Anual')}</option></select></label>
      <p className="max-w-md text-xs text-muted-foreground">{t('Esta escolha define a cobrança real. Ela é independente da moeda usada para exibir suas despesas.')}</p>
    </div>
    {signedIn && <section className="space-y-3 rounded-2xl border bg-card p-5">
      <p className="font-medium">{t('Seu plano')}: {t(pro ? 'NoControle Total' : 'NoControle Essencial')}{plan?.source==='master' ? ` · ${t('Master')}` : plan?.source==='courtesy' ? ` · ${t('Total cortesia')}` : ''}</p>
      {plan?.expires_at && <p className="text-sm text-muted-foreground">{t('Acesso até')}: {new Date(plan.expires_at).toLocaleDateString(locale)}</p>}
      {billing?.subscriptions?.some(s=>s.cancel_at_period_end) && <p className="text-sm">{t('Cancelamento agendado. Seu acesso continua até o fim do período pago.')}</p>}
      <p className="text-sm text-muted-foreground">{t('Já concluiu o pagamento? Atualize a situação para consultar a confirmação da Stripe.')}</p>
      <div className="flex flex-wrap gap-3">
        {billing?.has_customer && !pro && <Button variant="outline" onClick={()=>act('portal')} disabled={busy||!ready}>{t('Gerenciar assinatura')}</Button>}
        {billing?.has_customer && <Button variant="outline" onClick={()=>act('refresh')} disabled={busy||!ready}>{t('Atualizar situação')}</Button>}
      </div>
    </section>}
    {!ready && <p role="status" className="rounded-xl bg-secondary p-4 text-sm">{t('As assinaturas ainda estão sendo configuradas. Tente novamente mais tarde.')}</p>}
    {error && <p role="alert" className="rounded-xl border border-destructive p-4 text-sm text-destructive">{t(error)}</p>}
    <div className="grid gap-5 md:grid-cols-2">
      <section className="space-y-5 rounded-3xl border bg-card p-6 sm:p-8">
        <h2 className="text-xl font-semibold">{t('NoControle Essencial')}</h2><p className="text-3xl font-semibold">{t('Grátis')}</p>
        <ul className="space-y-3 text-sm"><li>{t('Lançamentos manuais ilimitados')}</li><li>{t('1 quadro secundário por mês, além do principal')}</li><li>{t('Categorias e orçamento')}</li><li>{t('1 análise com IA por mês, entre PDF e imagem')}</li><li>{t('Exportação básica dos seus dados')}</li><li>{t('1 meta no cofrinho')}</li></ul>
        <Link href={signedIn?'/':'/login'} className="inline-flex rounded-full border px-5 py-3 text-sm font-medium">{t(signedIn?'Voltar ao painel':'Começar grátis')}</Link>
      </section>
      <section className="space-y-5 rounded-3xl border-2 border-primary bg-card p-6 sm:p-8">
        <h2 className="text-xl font-semibold">{t('NoControle Total')}</h2>
        <p className="text-3xl font-semibold">{money(offer.amount)}<span className="text-sm font-normal text-muted-foreground"> / {t(interval==='year'?'ano':'mês')}</span></p>
        {interval==='year' && <p className="text-sm text-muted-foreground">{t('Cobrado de uma vez por ano. Renovação automática anual.')}</p>}
        {interval==='month' && <p className="text-sm text-muted-foreground">{t('Renovação automática mensal.')}</p>}
        <ul className="space-y-3 text-sm"><li>{t('Tudo do Essencial')}</li><li>{t('Quadros secundários ilimitados')}</li><li>{t('10 análises com IA por mês, entre PDFs, imagens e planilhas')}</li><li>{t('Relatórios completos e exportação PDF, TXT, CSV e Excel')}</li><li>{t('Várias metas no cofrinho')}</li></ul>
        {signedIn && pro ? <div className="space-y-3">
          <p className="text-sm font-medium text-primary">{t('Total ativo')}</p>
          <p className="text-sm text-muted-foreground">{t(plan?.source==='master' ? 'Seu acesso master já inclui todos os recursos Total. Não é necessário contratar uma assinatura.' : plan?.source==='courtesy' ? 'Sua conta já tem Total por cortesia. Não é necessário contratar uma assinatura enquanto o benefício estiver ativo.' : 'Sua assinatura Total já está ativa. Você pode consultar os pagamentos e o cancelamento no portal.')}</p>
          {billing?.has_customer ? <Button onClick={()=>act('portal')} disabled={busy||!ready} className="w-full">{t('Gerenciar assinatura')}</Button> : <Link href="/" className="inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground">{t('Voltar ao painel')}</Link>}
        </div> : signedIn ? <Button onClick={()=>act('checkout')} disabled={busy||!ready} className="w-full">{t(busy?'Aguarde...':'Assinar Total')}</Button>
          : <Link href="/login" className="inline-flex rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground">{t('Entre ou crie sua conta para assinar')}</Link>}
        <p className="text-xs text-muted-foreground">{t('Cancele a renovação pelo portal da assinatura. Cancelar não apaga suas despesas. Reembolsos podem ser solicitados ao suporte, conforme os termos e a legislação aplicável.')}</p>
      </section>
    </div>
  </div>
}
