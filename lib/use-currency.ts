'use client'

import { useSyncExternalStore } from 'react'
import { getCurrencySnapshot, subscribeCurrency } from '@/lib/currency'

const serverSnapshot = () => 'BRL' as const

export function useCurrency() {
  return useSyncExternalStore(subscribeCurrency, getCurrencySnapshot, serverSnapshot)
}
