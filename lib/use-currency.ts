'use client'

import { useSyncExternalStore } from 'react'
import { getCurrencySnapshot, subscribeCurrency } from '@/lib/currency'
import { useRegionalDefaults } from '@/components/language-provider'

export function useCurrency() {
  const {initialCurrency}=useRegionalDefaults()
  return useSyncExternalStore(subscribeCurrency, getCurrencySnapshot, ()=>initialCurrency)
}
