'use client'

import { useValuesVisibility } from '@/context/visibility-context'

export type MaskedValueProps = {
  value: number
  className?: string
}

export function MaskedValue({ value, className }: MaskedValueProps) {
  const { hidden } = useValuesVisibility()

  if (hidden) {
    return <span className={className}>R$ ••••</span>
  }

  return (
    <span className={className}>
      {value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
    </span>
  )
}