import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PlanningView } from '@/components/planning-view'
import Link from 'next/link'

export default async function PlanningPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const client = await createClient()
  let user = null
  try { user = (await client.auth.getUser()).data.user } catch { redirect('/login') }
  if (!user) redirect('/login')
  const { month } = await searchParams
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month ?? '')
  const now = new Date()
  const initialPeriod = match && Number(match[1]) > 0
    ? { year: Number(match[1]), month: Number(match[2]) - 1 }
    : { year: now.getFullYear(), month: now.getMonth() }
  return <main className="container mx-auto space-y-6 p-4 md:p-8">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-2xl font-semibold sm:text-3xl">Orçamento e lembretes</h1><p className="mt-2 text-sm text-muted-foreground">Acompanhe os limites por categoria e as contas que precisam de atenção.</p></div>
      <Link href="/" className="rounded-full border px-4 py-2 text-sm hover:bg-accent">Voltar ao painel</Link>
    </header>
    <PlanningView initialPeriod={initialPeriod} />
  </main>
}
