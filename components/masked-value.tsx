'use client'

import { useLanguage } from '@/components/language-provider'

import { useValuesVisibility } from '@/context/visibility-context'

export type MaskedValueProps = {
  value: number
  className?: string
  mask?: boolean
}

export function MaskedValue({ value, className, mask = false }: MaskedValueProps) {
  const { locale } = useLanguage()
  const { hidden } = useValuesVisibility()

  if (mask && hidden) {
    return <span className={className}>R$ ••••</span>
  }

  return (
    <span className={className}>
      {value.toLocaleString(locale, { style: 'currency', currency: 'BRL' })}
    </span>
  )
}
