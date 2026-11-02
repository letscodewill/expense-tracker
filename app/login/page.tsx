import { getServerTranslation } from '@/lib/i18n/server'
import { login, recoverPassword } from './actions'
import Link from 'next/link'
import { Palette, ChevronDown } from 'lucide-react'
import Image from 'next/image'
import { LoginBrandBackground } from '@/components/login-brand-background'
import { LoginProductPreview } from '@/components/login-product-preview'
import { LoginAccess } from '@/components/login-access'
import { LoginSubmitButton } from '@/components/login-submit-button'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SignupDialog } from '@/components/signup-dialog'
import { GoogleSignInButton } from '@/components/google-signin-button'
import { ThemeSelector } from '@/components/theme-selector'
import { PwaInstallButton } from '@/components/pwa-install-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RecoverySubmitButton } from '@/components/recovery-submit-button'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ message?: string; mode?: string }> }) {
  const { t } = await getServerTranslation()
  const params = await searchParams
  const isRecoverMode = params?.mode === 'recover'
  const standalone = isRecoverMode || params?.mode === 'email'
  if (!isRecoverMode) {
    let authenticated = false
    try {
      const { data, error } = await (await createClient()).auth.getUser()
      authenticated = !error && !!data.user
    } catch (error) { console.warn('[login] Could not validate existing session:', error) }
    if (authenticated) redirect('/')
  }
  return <main className="login-page relative isolate min-h-dvh bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8">
    <LoginBrandBackground />
    <div className="mx-auto w-full max-w-6xl">
      <header className="relative z-20 flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
        <Link href="/login" aria-label={t('NoControle, página de acesso')} className="flex items-center gap-2.5 font-semibold tracking-tight"><Image src="/icons/icon-192.png" width={36} height={36} alt="" className="rounded-xl shadow-sm" /><span>NoControle</span></Link>
        <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2">
          <details className="group relative">
            <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-border bg-card px-3 text-sm font-medium text-card-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden"><Palette className="size-4" aria-hidden="true" /><span>{t('Tema')}</span><ChevronDown className="size-3" aria-hidden="true" /></summary>
            <div className="absolute right-0 top-full mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-2 text-card-foreground shadow-xl"><ThemeSelector /></div>
          </details>
          {!standalone && <><div><SignupDialog key={params?.mode || 'default'} initialOpen={params?.mode === 'signup'} triggerClassName="min-h-10 px-4" /></div><LoginAccess action={login} /></>}
          {standalone && <Link href="/login" className="rounded-full border px-4 py-2 text-sm text-primary hover:bg-accent">{t('Voltar')}</Link>}
        </div>
      </header>
      {params?.message && <p role="alert" className="mx-auto mt-6 max-w-xl rounded-2xl border bg-card p-4 text-center text-sm">{t(params.message)}</p>}
      {standalone ? <section aria-labelledby="login-heading" className="login-auth-card relative mx-auto my-12 w-full max-w-md rounded-3xl border border-border bg-card p-6 text-card-foreground sm:p-8">
        <header className="mb-6 space-y-2"><p className="text-xs font-medium uppercase tracking-widest text-primary">{t('Sua conta NoControle')}</p><h1 id="login-heading" className="text-2xl font-medium">{t(isRecoverMode?'Recuperar senha':'Entrar com e-mail')}</h1><p className="text-sm text-muted-foreground">{t(isRecoverMode?'Enviaremos um link para você criar uma nova senha.':'Entre na sua conta para acompanhar suas despesas.')}</p></header>
        {!isRecoverMode && <div className="mb-6 space-y-4"><GoogleSignInButton /><p className="text-center text-xs text-muted-foreground">{t('ou entre com e-mail')}</p></div>}
        <form action={isRecoverMode?undefined:login} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="email">{t('E-mail')}</Label><Input id="email" name="email" type="email" autoComplete="email" required /></div>
          {!isRecoverMode && <><div className="space-y-2"><Label htmlFor="password">{t('Senha')}</Label><Input id="password" name="password" type="password" autoComplete="current-password" required /></div><div className="text-right"><Link href="/login?mode=recover" className="text-sm font-medium text-primary hover:underline">{t('Esqueceu a senha?')}</Link></div></>}
          {isRecoverMode?<RecoverySubmitButton action={recoverPassword} />:<LoginSubmitButton />}
        </form>
        <div className="mt-6 text-center"><Link href={isRecoverMode?'/login?mode=email':'/login?mode=signup'} className="text-sm font-medium text-primary hover:underline">{t(isRecoverMode?'Voltar para o login':'Criar conta')}</Link></div>
      </section> : <div className="py-10 sm:py-14 lg:py-16"><LoginProductPreview /><div className="mt-8 flex justify-center"><PwaInstallButton /></div></div>}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 py-5 text-xs text-muted-foreground"><p>{t('NoControle · Seu dinheiro, mais organizado.')}</p><nav className="flex flex-wrap gap-4"><Link href="/welcome" className="hover:text-primary hover:underline">{t('Como funciona')}</Link><Link href="/privacypolicy" className="hover:text-primary hover:underline">{t('Política de privacidade')}</Link><Link href="/termsofservice" className="hover:text-primary hover:underline">{t('Termos de uso')}</Link><Link href="/login?mode=recover" className="hover:text-primary hover:underline">{t('Ajuda com acesso à conta')}</Link></nav></footer>
    </div>
  </main>
}
