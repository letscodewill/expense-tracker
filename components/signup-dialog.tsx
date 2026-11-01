'use client'

import { useLanguage } from '@/components/language-provider'
import { useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { signup } from '@/app/login/actions'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { isStrongSignupPassword, SIGNUP_PASSWORD_HINT } from '@/lib/signup-password'

export function SignupDialog({ initialOpen = false, triggerClassName = 'w-full' }: { initialOpen?: boolean; triggerClassName?: string } = {}) {
  const { t } = useLanguage()
  const router = useRouter()
  const [open, setOpen] = useState(initialOpen)
  const inFlight = useRef(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')

  function reset() {
    setName(''); setEmail(''); setPassword(''); setConfirmPassword(''); setError('')
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (inFlight.current) return
    setError('')

    if (!name.trim()) {
      setError("Informe seu nome.")
      return
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.")
      return
    }

    if (!isStrongSignupPassword(password)) {
      setError(SIGNUP_PASSWORD_HINT)
      return
    }

    const formData = new FormData()
    formData.set('name', name)
    formData.set('email', email)
    formData.set('password', password)

    inFlight.current = true
    startTransition(async () => {
      try {
        const result = await signup(formData)
        if ('error' in result) { setError(result.error); return }
        setOpen(false)
        reset()
        router.replace('/login?message=' + encodeURIComponent('Verifique seu email para continuar o processo de cadastro.'))
        router.refresh()
      } catch {
        setError('Não foi possível cadastrar o usuário. Tente novamente.')
      } finally { inFlight.current = false }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (inFlight.current) return
        setOpen(isOpen)
        if (!isOpen) reset()
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" className={triggerClassName}>{t("Criar conta")}</Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Criar conta")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="signup-name">{t("Nome:")}</Label>
            <Input
              id="signup-name"
              type="text"
              autoComplete="name"
              maxLength={100}
              disabled={isPending}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="signup-email">{t("E-mail:")}</Label>
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              maxLength={254}
              disabled={isPending}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="signup-password">{t("Senha:")}</Label>
            <Input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              aria-describedby="signup-password-hint"
              disabled={isPending}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p id="signup-password-hint" className="text-xs leading-relaxed text-muted-foreground">{t(SIGNUP_PASSWORD_HINT)}</p>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="signup-confirm-password">{t("Confirmar senha:")}</Label>
            <Input
              id="signup-confirm-password"
              type="password"
              autoComplete="new-password"
              maxLength={128}
              disabled={isPending}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
          <p className="text-xs leading-relaxed text-muted-foreground">
            <Link href="/termsofservice" target="_blank" rel="noopener noreferrer" className="text-primary underline">{t("Termos de uso")}</Link>
            {' · '}
            <Link href="/privacypolicy" target="_blank" rel="noopener noreferrer" className="text-primary underline">{t("Política de privacidade")}</Link>
          </p>

          <DialogFooter>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? t('Criando...') : t("Criar conta")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
