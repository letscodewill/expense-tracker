import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isMasterIdentity } from '@/lib/tickets'
import { getServerTranslation } from '@/lib/i18n/server'
import { ProBenefitsPanel } from '@/components/pro-benefits-panel'
import type { BenefitsOverview } from '@/lib/pro-benefits'

export default async function BenefitsPage({ searchParams }: { searchParams: Promise<{ search?: string; offset?: string }> }) {
  const { t } = await getServerTranslation()
  const client = await createClient()
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) redirect('/login')
  if (!isMasterIdentity(data.user)) notFound()
  const owner = await client.rpc('is_support_owner')
  if (owner.error || owner.data !== true) notFound()
  const params = await searchParams
  const search = (typeof params.search === 'string' ? params.search : '').trim().slice(0,100)
  const parsed = Number(params.offset ?? 0)
  const offset = Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 100000 ? parsed : 0
  const result = await client.rpc('admin_pro_overview', { search_input: search, offset_input: offset })
  return <main className="container mx-auto max-w-6xl space-y-6 p-4 md:p-8">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-semibold sm:text-3xl">{t('Planos e benefícios')}</h1><p className="mt-2 text-sm text-muted-foreground">{t('Conceda Pro cortesia sem cobrança e acompanhe cada alteração.')}</p></div><Link href="/admin" className="rounded-full border px-4 py-2 text-sm hover:bg-accent">{t('Painel administrativo')}</Link></header>
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">{t('Sua conta é master: acesso Pro permanente e gestão exclusiva dos benefícios.')}</div>
    {result.error || !result.data ? <p role="alert" className="text-destructive">{t('Não foi possível carregar os benefícios. Atualize a página para tentar novamente.')}</p> : <ProBenefitsPanel key={`${search}:${offset}`} overview={result.data as BenefitsOverview} search={search} offset={offset} />}
  </main>
}
