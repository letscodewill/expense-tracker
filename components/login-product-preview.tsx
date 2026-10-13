'use client'

import { useLanguage } from '@/components/language-provider'
import { CalendarCheck, ChartPie, ReceiptText, Check, Clock, WalletCards } from 'lucide-react'

export function LoginProductPreview() {
  const { t, locale } = useLanguage()
  const money = (value: number) => value.toLocaleString(locale, { style: 'currency', currency: 'BRL' })

  return <section aria-labelledby="product-heading" className="min-w-0 space-y-7 lg:pr-6">
    <div className="max-w-xl space-y-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{t("Seu mês, mais organizado")}</p>
      <h2 id="product-heading" className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">{t("Saiba quanto falta pagar.")}<br /><span className="text-primary">{t("Planeje seu mês.")}</span></h2>
      <p className="max-w-md text-base leading-relaxed text-muted-foreground">{t("Reúna despesas, faturas e orçamento em um só lugar. Uma visão clara para acompanhar seu dinheiro e decidir com tranquilidade.")}</p>
    </div>

    <div className="rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-lg shadow-primary/5 sm:p-5" aria-label={t("Prévia do painel com dados fictícios")}>
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
      <p className="mt-4 text-[11px] text-muted-foreground">{t("Exemplo ilustrativo com dados fictícios.")}</p>
    </div>

    <ul className="space-y-4">
      {([{ Icon: WalletCards, title: t("Cada despesa no seu lugar"), description: t("Organize contas e cartões em quadros por mês.") }, { Icon: ReceiptText, title: t("Menos trabalho com suas faturas"), description: t("Importe PDFs e planilhas e revise antes de salvar.") }, { Icon: ChartPie, title: t("Planejamento que acompanha você"), description: t("Acompanhe categorias, orçamento e vencimentos.") }]).map(({ Icon, title, description }) => <li key={title} className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary/70 text-secondary-foreground"><Icon className="size-4" aria-hidden="true" /></span><div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p></div></li>)}
    </ul>
    <p className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarCheck className="size-4" aria-hidden="true" />{t("No computador ou no celular, no seu ritmo.")}</p>
  </section>
}
