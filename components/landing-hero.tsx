'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, CheckCheck, FileImage, ReceiptText, ScanLine } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import { useCurrency } from '@/lib/use-currency'

export function LandingHero() {
  const {t,locale}=useLanguage()
  const currency=useCurrency()
  const [stage,setStage]=useState(0)
  const money=(value:number)=>new Intl.NumberFormat(locale,{style:'currency',currency,currencyDisplay:'narrowSymbol',minimumFractionDigits:2,maximumFractionDigits:2}).format(value)
  const stages=['Comprovante','Revisão','No painel']
  return <section aria-labelledby="landing-title" className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-10 sm:px-8 sm:py-16 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:py-20">
    <div className="min-w-0">
      <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-secondary/50 px-3 py-1.5 text-xs font-medium text-primary"><ScanLine className="size-4" aria-hidden="true"/>{t('Menos digitação. Mais controle.')}</p>
      <h1 id="landing-title" className="max-w-xl text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl lg:text-[3.4rem]">{t('Transforme comprovantes em')} <span className="text-primary">{t('despesas organizadas.')}</span></h1>
      <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">{t('Envie uma foto ou fatura, revise os dados e saiba o que ainda falta pagar. Suas parcelas, orçamento e metas no mesmo lugar.')}</p>
      <div className="mt-7"><Link href="/login?mode=signup" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-7 py-3 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/15 transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:w-auto">{t('Começar grátis')}<ArrowRight className="size-4" aria-hidden="true"/></Link><p className="mt-3 text-xs text-muted-foreground">{t('Comece grátis. Sem cartão de crédito.')}</p></div>
      <a href="#plans" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline underline-offset-4">{t('Ver planos e limites')}<ArrowRight className="size-3.5" aria-hidden="true"/></a>
    </div>
    <div className="min-w-0 rounded-[2rem] border border-border bg-card p-4 text-card-foreground shadow-2xl shadow-primary/10 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{t('Do comprovante ao painel')}</span><span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">{t('Demonstração')}</span></div>
      <div role="group" aria-label={t('Etapas da demonstração')} className="mb-5 grid grid-cols-3 gap-1 rounded-2xl bg-muted/60 p-1">{stages.map((label,index)=><button key={label} type="button" aria-pressed={stage===index} onClick={()=>setStage(index)} className={`min-h-11 rounded-xl px-1 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary sm:text-sm ${stage===index?'bg-primary text-primary-foreground shadow-sm':'text-muted-foreground hover:bg-accent'}`}><span className="mr-1 opacity-70">{index+1}.</span>{t(label)}</button>)}</div>
      <div aria-live="polite" aria-atomic="true" className="flex min-h-72 flex-col justify-center rounded-2xl border border-border bg-background/70 p-5 sm:p-6">
        {stage===0?<div className="mx-auto w-full max-w-xs rounded-xl border border-dashed border-border bg-card p-5 shadow-sm"><ReceiptText className="mx-auto mb-4 size-8 text-primary" aria-hidden="true"/><p className="text-center text-xs font-medium uppercase tracking-widest">{t('Comprovante ilustrativo')}</p><div className="my-4 border-t border-dashed border-border"/><div className="flex justify-between gap-3 text-sm"><span>{t('Mercado')}</span><span className="font-semibold tabular-nums">{money(82.41)}</span></div><p className="mt-3 text-xs text-muted-foreground">{t('Compra aprovada')}</p><div className="mt-5 flex items-center gap-2 border-t border-dashed border-border pt-4 text-xs text-primary"><FileImage className="size-4" aria-hidden="true"/>{t('Foto, PDF ou planilha')}</div></div>:stage===1?<div className="space-y-4"><p className="text-sm font-semibold">{t('Confira antes de salvar')}</p>{[['Descrição',t('Mercado')],['Valor',money(82.41)],['Categoria',t('Mercado')]].map(([label,value])=><div key={label} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 text-sm"><span className="text-muted-foreground">{t(label)}</span><span className="font-medium">{value}</span></div>)}<p className="flex items-start gap-2 rounded-xl bg-secondary p-3 text-xs leading-relaxed text-secondary-foreground"><CheckCheck className="size-4 shrink-0" aria-hidden="true"/>{t('Você escolhe o quadro e o mês de pagamento.')}</p></div>:<div><span className="mb-4 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs text-secondary-foreground"><Check className="size-4" aria-hidden="true"/>{t('Exemplo de lançamento organizado')}</span><p className="text-xs text-muted-foreground">{t('Cartão de crédito')}</p><div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4"><div><p className="font-medium">{t('Mercado')}</p><p className="mt-1 text-xs text-muted-foreground">{t('Pendente')}</p></div><span className="text-xl font-semibold tabular-nums">{money(82.41)}</span></div><p className="mt-5 text-sm leading-relaxed text-muted-foreground">{t('Agora a despesa faz parte da visão do seu mês.')}</p></div>}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><p className="max-w-64 text-[11px] leading-relaxed text-muted-foreground">{t('Exemplo ilustrativo com dados fictícios.')}</p><button type="button" onClick={()=>setStage((stage+1)%3)} className="inline-flex min-h-11 items-center gap-2 text-xs font-medium text-primary underline underline-offset-4">{t(stage===2?'Rever exemplo':'Próxima etapa')}<ArrowRight className="size-3.5" aria-hidden="true"/></button></div>
    </div>
  </section>
}
