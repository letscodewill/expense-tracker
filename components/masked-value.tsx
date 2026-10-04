'use client'

import { useValuesVisibility } from '@/context/visibility-context'

export type MaskedValueProps = {
  value: number
  className?: string
  mask?: boolean
}

export function MaskedValue({ value, className, mask = false }: MaskedValueProps) {
  const { hidden } = useValuesVisibility()

  if (mask && hidden) {
    return <span className={className}>R$ ••••</span>
  }

  return (
    <span className={className}>
      {value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
    </span>
  )
}
