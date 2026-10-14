import { getServerTranslation } from '@/lib/i18n/server'
import { login, recoverPassword } from './actions'
import Link from 'next/link'
import { WalletCards, Palette, ChevronDown } from 'lucide-react'
import { LoginProductPreview } from '@/components/login-product-preview'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SignupDialog } from '@/components/signup-dialog'
import { GoogleSignInButton } from '@/components/google-signin-button'
import { ThemeSelector } from '@/components/theme-selector'
import { PwaInstallButton } from '@/components/pwa-install-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LanguageSelector } from '@/components/language-selector'
import { RecoverySubmitButton } from '@/components/recovery-submit-button'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; mode?: string }>
}) {
  const { t } = await getServerTranslation()

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
    <main className="relative isolate min-h-dvh bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10" style={{ background: 'radial-gradient(ellipse at 0% 35%, color-mix(in srgb, var(--secondary) 55%, transparent), transparent 60%), radial-gradient(ellipse at 100% 100%, color-mix(in srgb, var(--primary) 5%, transparent), transparent 50%)' }} />
      <div className="mx-auto w-full max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
          <Link href="/login" aria-label={t("NoControle, página de acesso")} className="flex items-center gap-2.5 font-semibold tracking-tight"><span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><WalletCards className="size-5" aria-hidden="true" /></span><span>NoControle</span></Link>
          <div className="ml-auto flex items-center gap-2"><LanguageSelector compact /><details className="group relative z-20">
            <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-border bg-card px-3 text-sm font-medium text-card-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden"><Palette className="size-4" aria-hidden="true" /><span>{t("Tema")}</span><ChevronDown className="size-3 transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
            <div className="absolute right-0 top-full mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-2 text-card-foreground shadow-xl"><ThemeSelector /></div>
          </details></div>
        </header>
        <div className="grid items-start gap-10 py-8 sm:py-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)] lg:items-center lg:gap-16 lg:py-12">
          <div className="order-2 lg:order-1"><LoginProductPreview /></div>
          <div className="order-1 min-w-0 lg:order-2">
        <section aria-labelledby="login-heading" className="rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-lg shadow-primary/5 sm:p-8">
          <header className="mb-6 space-y-2">
            <p className="text-xs font-medium uppercase tracking-widest text-primary">{t("Sua conta NoControle")}</p>
            <h1 id="login-heading" className="text-2xl font-medium tracking-tight sm:text-3xl">{isRecoverMode ? t("Recuperar senha") : t("Bem-vindo de volta")}</h1>
            <p className="text-sm text-muted-foreground">{isRecoverMode ? t("Enviaremos um link para você criar uma nova senha.") : t("Entre na sua conta para acompanhar suas despesas.")}</p>
          </header>

          {!isRecoverMode && <div className="mb-6 space-y-4"><GoogleSignInButton /><div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />{t("ou entre com e-mail")}<span className="h-px flex-1 bg-border" /></div></div>}
          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("E-mail")}</Label>
              <Input id="email" name="email" type="email" autoComplete="email" placeholder="voce@exemplo.com" required />
            </div>
            {!isRecoverMode && <>
              <div className="space-y-2">
                <Label htmlFor="password">{t("Senha")}</Label>
                <Input id="password" name="password" type="password" autoComplete="current-password" required />
              </div>
              <div className="text-right"><Link href="/login?mode=recover" className="text-sm font-medium text-primary hover:underline">{t("Esqueceu a senha?")}</Link></div>
            </>}
            {isRecoverMode ? <RecoverySubmitButton action={recoverPassword} /> : <Button type="submit" formAction={login} className="w-full">{t('Entrar')}</Button>}
          </form>

          {isRecoverMode ? <div className="mt-6 text-center"><Link href="/login" className="text-sm font-medium text-primary hover:underline">{t("Voltar para o login")}</Link></div>
            : <div className="mt-6 space-y-4">
              <p className="text-center text-sm text-muted-foreground">{t("Ainda não tem uma conta?")}</p>
              <div className="text-center"><SignupDialog /></div>
              <div className="flex justify-center"><PwaInstallButton /></div>
            </div>}
          {params?.message && <p role="alert" className="mt-5 rounded-2xl bg-destructive/10 p-3 text-center text-sm text-destructive">{t(params.message)}</p>}
        </section>
          </div>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 py-5 text-xs text-muted-foreground"><p>{t("NoControle · Seu dinheiro, mais organizado.")}</p><Link href="/login?mode=recover" className="hover:text-primary hover:underline">{t("Ajuda com acesso à conta")}</Link></footer>
      </div>
    </main>
  )
}
