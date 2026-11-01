'use client'
import { useFormStatus } from 'react-dom'
import { useLanguage } from '@/components/language-provider'
import { Button } from '@/components/ui/button'

export function LoginSubmitButton() {
  const { pending } = useFormStatus()
  const { t } = useLanguage()
  return <Button type="submit" disabled={pending} className="w-full">{t(pending ? 'Entrando...' : 'Entrar')}</Button>
}
