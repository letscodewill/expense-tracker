'use client'

import { Button } from '@/components/ui/button'
import { Eye, EyeOff } from 'lucide-react'
import { useValuesVisibility } from '@/context/visibility-context'

export function VisibilityToggleButton() {
  const { hidden, toggle } = useValuesVisibility()

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      aria-label={hidden ? 'Mostrar salário' : 'Ocultar salário'}
      title={hidden ? 'Mostrar salário' : 'Ocultar salário'}
      aria-pressed={hidden}
    >
      {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </Button>
  )
}
