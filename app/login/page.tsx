import { login, recoverPassword } from './actions'
import Link from 'next/link'
import { WalletCards } from 'lucide-react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SignupDialog } from '@/components/signup-dialog'
import { GoogleSignInButton } from '@/components/google-signin-button'
import { ThemeSelector } from '@/components/theme-selector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; mode?: string }>
}) {
  const params = await searchParams
  const isRecoverMode = params?.mode === 'recover'

  if (!isRecoverMode) {
    let authenticated = false
    try {
      const supabase = await createClient()
      const { data, error } = await supabase.auth.getUser()
      authenticated = !error && !!data.user
    } catch (error) {
      console.warn('[login] Could not validate existing session:', error)
    }
    if (authenticated) redirect('/')
  }

  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center bg-background px-4 py-8 text-foreground sm:py-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10" style={{ background: 'radial-gradient(ellipse at 0% 0%, color-mix(in srgb, var(--secondary) 60%, transparent), transparent 55%), radial-gradient(ellipse at 100% 100%, color-mix(in srgb, var(--primary) 8%, transparent), transparent 50%)' }} />
      <div className="relative z-10 w-full max-w-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 text-card-foreground shadow-sm">
          <span className="px-1 text-sm font-medium">Aparência</span>
          <ThemeSelector />
        </div>
        <section aria-labelledby="login-heading" className="rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-xl shadow-primary/5 sm:p-8">
          <header className="mb-8 space-y-3 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground"><WalletCards className="size-7" aria-hidden="true" /></div>
            <p className="text-xs font-medium uppercase tracking-widest text-primary">Painel de Despesas</p>
            <h1 id="login-heading" className="text-2xl font-medium tracking-tight sm:text-3xl">{isRecoverMode ? 'Recuperar senha' : 'Bem-vindo de volta'}</h1>
            <p className="text-sm text-muted-foreground">{isRecoverMode ? 'Enviaremos um link para você criar uma nova senha.' : 'Entre na sua conta para acompanhar suas despesas.'}</p>
          </header>

          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" autoComplete="email" placeholder="voce@exemplo.com" required />
            </div>
            {!isRecoverMode && <>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" name="password" type="password" autoComplete="current-password" required />
              </div>
              <div className="text-right"><Link href="/login?mode=recover" className="text-sm font-medium text-primary hover:underline">Esqueceu a senha?</Link></div>
            </>}
            <Button type="submit" formAction={isRecoverMode ? recoverPassword : login} className="w-full">{isRecoverMode ? 'Enviar link de recuperação' : 'Entrar'}</Button>
          </form>

          {isRecoverMode ? <div className="mt-6 text-center"><Link href="/login" className="text-sm font-medium text-primary hover:underline">Voltar para o login</Link></div>
            : <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" /></div>
              <GoogleSignInButton />
              <div className="text-center"><SignupDialog /></div>
            </div>}
          {params?.message && <p role="alert" className="mt-5 rounded-2xl bg-destructive/10 p-3 text-center text-sm text-destructive">{params.message}</p>}
        </section>
      </div>
    </main>
  )
}
