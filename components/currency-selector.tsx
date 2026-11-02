'use client'

import { useLanguage } from '@/components/language-provider'
import { useCurrency } from '@/lib/use-currency'
import { normalizeCurrency, selectCurrency, DISPLAY_CURRENCIES, currencySymbol } from '@/lib/currency'
import { useRouter } from 'next/navigation'

export function CurrencySelector() {
  const { t, locale } = useLanguage()
  const router=useRouter()
  const currency = useCurrency()
  const names = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames([locale], { type: 'currency' }) : null
  const priority = ['BRL','USD','EUR','MXN','ARS','BOB','CLP','COP','CRC','CUP','DOP','GTQ','HNL','NIO','PAB','PEN','PYG','UYU','VES']
  const codes = [...priority.filter(code => DISPLAY_CURRENCIES.includes(code)), ...DISPLAY_CURRENCIES.filter(code => !priority.includes(code))]
  return <label title={t('Apenas exibição: não converte valores nem altera os dados salvos.')} className="inline-flex max-w-full min-h-10 items-center rounded-xl border border-border bg-card px-2 text-card-foreground">
    <span className="sr-only">{t('Moeda de exibição')}</span>
    <select value={currency} aria-label={t('Moeda de exibição')} title={t('Apenas exibição: não converte valores nem altera os dados salvos.')} onChange={event => {selectCurrency(normalizeCurrency(event.target.value));router.refresh()}} className="w-full min-w-0 max-w-full cursor-pointer bg-card text-sm text-card-foreground focus-visible:outline-2 focus-visible:outline-primary">
      {codes.map(code => <option key={code} value={code}>{code} — {names?.of(code) ?? code} ({currencySymbol(code, locale)})</option>)}
    </select>
  </label>
}
