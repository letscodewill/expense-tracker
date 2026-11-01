import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getServerTranslation } from '@/lib/i18n/server'
import { billingReady } from '@/lib/stripe'
import { PlansPanel } from '@/components/plans-panel'

export default async function PlansPage() {
  const { t, country } = await getServerTranslation()
  const client = await createClient()
  let signedIn = false, plan = null, billing = null
  try {
    const auth = await client.auth.getUser()
    if (auth.data.user) {
      signedIn = true
      const [p,b] = await Promise.all([client.rpc('get_my_plan'),client.rpc('get_my_billing')])
      if (!p.error) plan = p.data
      if (!b.error) billing = b.data
    }
  } catch { /* The public offer remains available during an authentication outage. */ }
  return <main className="container mx-auto max-w-5xl space-y-8 px-4 py-8 sm:py-12">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <Link href={signedIn ? '/' : '/login'} className="text-lg font-semibold text-primary">NoControle</Link>
      <Link href={signedIn ? '/' : '/login'} className="rounded-full border px-4 py-2 text-sm text-primary">{t(signedIn?'Voltar ao painel':'Entrar')}</Link>
    </header>
    <div className="space-y-3 text-center"><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('Mais controle, menos trabalho.')}</h1><p className="text-muted-foreground">{t('Escolha como cuidar das suas despesas. Seus dados continuam sendo seus.')}</p></div>
    <PlansPanel signedIn={signedIn} plan={plan} billing={billing} ready={billingReady()} initialCurrency={country === 'BR' ? 'brl' : 'usd'} />
    <footer className="flex flex-wrap justify-center gap-5 text-sm text-muted-foreground">
      <Link href="/termsofservice" className="underline">{t('Termos de uso')}</Link>
      <Link href="/privacypolicy" className="underline">{t('Política de privacidade')}</Link>
      <a href="mailto:suportenocontroleofc@gmail.com" className="underline">{t('Suporte')}</a>
    </footer>
  </main>
}
