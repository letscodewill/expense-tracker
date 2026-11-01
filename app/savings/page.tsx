import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getServerTranslation } from '@/lib/i18n/server'
import { SavingsHub } from '@/components/savings-hub'

export default async function SavingsPage() {
  const { t } = await getServerTranslation()
  const client = await createClient()
  let user = null
  try { user = (await client.auth.getUser()).data.user } catch { redirect('/login') }
  if (!user) redirect('/login')
  const [goals,plan] = await Promise.all([client.rpc('savings_extra_action',{action_input:'list'}),client.rpc('get_my_plan')])
  return <main className="container mx-auto max-w-4xl space-y-6 px-4 py-6 sm:p-8">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-2xl font-semibold sm:text-3xl">{t('Cofrinho')}</h1><p className="mt-2 text-sm text-muted-foreground">{t('Guarde aos poucos e acompanhe sua próxima conquista.')}</p></div>
      <Link href="/" className="rounded-full border px-4 py-2 text-sm hover:bg-accent">{t('Voltar ao painel')}</Link>
    </header>
    <SavingsHub key={user.id} goals={!goals.error && Array.isArray(goals.data) ? goals.data : []} pro={!plan.error && plan.data?.plan === 'pro'} loadError={!!goals.error} />
  </main>
}
