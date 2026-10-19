'use client'

import { useLanguage } from '@/components/language-provider'
import { useCurrency } from '@/lib/use-currency'
import { normalizeCurrency, selectCurrency } from '@/lib/currency'

export function CurrencySelector() {
  const { t } = useLanguage()
  const currency = useCurrency()
  return <label title={t('Apenas exibição: não converte valores nem altera os dados salvos.')} className="inline-flex min-h-10 items-center rounded-xl border border-border bg-card px-2 text-card-foreground">
    <span className="sr-only">{t('Moeda de exibição')}</span>
    <select value={currency} aria-label={t('Moeda de exibição')} title={t('Apenas exibição: não converte valores nem altera os dados salvos.')} onChange={event => selectCurrency(normalizeCurrency(event.target.value))} className="min-w-0 cursor-pointer bg-card text-sm text-card-foreground focus-visible:outline-2 focus-visible:outline-primary">
      <option value="BRL">BRL (R$)</option>
      <option value="USD">USD (US$)</option>
    </select>
  </label>
}
