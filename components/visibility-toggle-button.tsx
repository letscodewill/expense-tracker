'use client'

import { useLanguage } from '@/components/language-provider'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff } from 'lucide-react'
import { useValuesVisibility } from '@/context/visibility-context'

export function VisibilityToggleButton() {
  const { t } = useLanguage()

  const { hidden, toggle } = useValuesVisibility()

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      aria-label={hidden ? t('Mostrar salário e total das despesas') : t('Ocultar salário e total das despesas')}
      title={hidden ? t('Mostrar salário e total das despesas') : t('Ocultar salário e total das despesas')}
      aria-pressed={hidden}
    >
      {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </Button>
  )
}
