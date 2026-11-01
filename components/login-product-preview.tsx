'use client'

import { useCurrency } from '@/lib/use-currency'
import { useLanguage } from '@/components/language-provider'
import { CalendarCheck, PiggyBank, ReceiptText, Check, Clock, WalletCards, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export function LoginProductPreview() {
  const { t, locale } = useLanguage()
  const currency = useCurrency()
  const money = (value: number) => value.toLocaleString(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })

  return <section aria-labelledby="product-heading" className="mx-auto min-w-0 max-w-5xl space-y-10">
    <div className="mx-auto max-w-3xl space-y-5 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{t("Seu mês, mais organizado")}</p>
      <h1 id="product-heading" className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">{t('Menos digitação.')}<br /><span className="text-primary">{t('Mais clareza nas suas contas.')}</span></h1>
      <p className="mx-auto max-w-xl text-base leading-relaxed text-muted-foreground">{t('Da foto do comprovante ao planejamento do mês: importe, revise e organize suas despesas em um só lugar.')}</p>
      <div className="flex flex-wrap items-center justify-center gap-3"><Link href="/login?mode=signup" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90">{t('Começar grátis')}<ArrowRight className="size-4" aria-hidden="true" /></Link><Link href="/plans" className="inline-flex min-h-11 items-center rounded-full border bg-card px-6 py-3 text-sm font-medium text-primary hover:bg-accent">{t('Conheça os planos Free e Pro')}</Link></div>
      <p className="text-xs text-muted-foreground">{t('Comece grátis. Sem cartão de crédito.')}</p>
    </div>

    <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-4 text-left text-card-foreground shadow-lg shadow-primary/5 sm:p-5" aria-label={t("Prévia do painel com dados fictícios")}>
      <div className="mb-4 flex items-center justify-between gap-2"><p className="text-sm font-medium">{t("Uma visão do seu mês")}</p><span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{t("Demonstração")}</span></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted/60 p-3"><p className="text-[11px] text-muted-foreground">{t("Salário do mês")}</p><p className="mt-1 text-lg font-medium tabular-nums">{money(4200)}</p></div>
        <div className="rounded-xl bg-muted/60 p-3"><p className="text-[11px] text-muted-foreground">{t("Total de despesas")}</p><p className="mt-1 text-lg font-medium tabular-nums">{money(2380)}</p></div>
        <div className="col-span-2 flex items-center justify-between gap-2 rounded-xl bg-secondary p-4 text-secondary-foreground"><div><p className="text-xs font-medium">{t("Saldo previsto")}</p><p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{money(1820)}</p></div><WalletCards className="size-8 opacity-60" aria-hidden="true" /></div>
      </div>
      <div className="mt-4 space-y-3">
        {([{ name: t("Mercado"), amount: money(420), paid: false }, { name: t("Internet"), amount: money(99), paid: true }, { name: t("Cartão de crédito"), amount: money(980), paid: false }]).map(row => <div key={row.name} className="flex items-center justify-between gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0">
          <div className="flex min-w-0 items-center gap-2"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">{row.paid ? <Check className="size-4" aria-hidden="true" /> : <Clock className="size-4" aria-hidden="true" />}</span><div className="min-w-0"><p className="truncate text-sm font-medium">{row.name}</p><p className="text-[11px] text-muted-foreground">{row.paid ? t("Pago") : t("Pendente")}</p></div></div><p className="shrink-0 text-sm font-medium tabular-nums">{row.amount}</p>
        </div>)}
      </div>
      <div className="mt-4 space-y-2 rounded-xl border border-primary/15 bg-secondary/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="flex items-center gap-2 font-medium"><PiggyBank className="size-4 text-primary" aria-hidden="true" />{t('Reserva de emergência')}</span><span className="tabular-nums">{money(1200)} / {money(3000)}</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full w-2/5 rounded-full bg-primary" /></div>
      </div>
      <p className="mt-4 text-[11px] text-muted-foreground">{t("Exemplo ilustrativo com dados fictícios.")}</p>
    </div>

    <ul className="grid gap-6 text-left md:grid-cols-3">
      {([{ Icon: ReceiptText, title: t('PDF, planilha ou foto: você escolhe'), description: t('Use a leitura com IA e confira os lançamentos antes de salvar, conforme os limites do seu plano.') }, { Icon: WalletCards, title: t('O mês inteiro em uma visão'), description: t('Encontre despesas por nome, valor, data ou categoria e acompanhe seu orçamento.') }, { Icon: PiggyBank, title: t('Cada conquista começa com uma meta'), description: t('Registre o que guardou no cofrinho e veja seu objetivo ganhar forma.') }]).map(({ Icon, title, description }) => <li key={title} className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary/70 text-secondary-foreground"><Icon className="size-4" aria-hidden="true" /></span><div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p></div></li>)}
    </ul>
    <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground"><CalendarCheck className="size-4" aria-hidden="true" />{t("No computador ou no celular, no seu ritmo.")}</p>
  </section>
}
