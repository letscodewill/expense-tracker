'use client'

import { useFormStatus } from 'react-dom'
import { useLanguage } from '@/components/language-provider'
import { Button } from '@/components/ui/button'

export function RecoverySubmitButton({ action }: { action: (formData: FormData) => void | Promise<void> }) {
  const { pending } = useFormStatus()
  const { t } = useLanguage()
  return <Button type="submit" formAction={action} disabled={pending} aria-busy={pending} className="w-full">{t(pending ? 'Enviando link...' : 'Enviar link de recuperação')}</Button>
}
