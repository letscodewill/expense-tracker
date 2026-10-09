import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getTicketAccess } from '@/lib/tickets-server'
import { isMasterIdentity } from '@/lib/tickets'
import { AdminOverviewPanel } from '@/components/admin-overview-panel'
import type { AdminOverview } from '@/lib/admin-overview'

export default async function AdminPage() {
  const { supabase, user } = await getTicketAccess()
  if (!user) redirect('/login')
  if (!isMasterIdentity(user)) notFound()
  const owner = await supabase.rpc('is_support_owner')
  if (owner.error || owner.data !== true) notFound()
  const result = await supabase.rpc('get_admin_overview', { page_offset: 0, search_value: '' })
  return <div className="container mx-auto max-w-7xl p-4 md:p-8">
    <header className="material-app-bar mb-6 flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-muted-foreground">Administração • NoControle</p><h1 className="text-3xl font-medium">Visão geral</h1></div><Link href="/" className="text-sm text-primary hover:underline">Voltar ao Dashboard</Link></header>
    <nav aria-label="Administração" className="mb-6 flex flex-wrap gap-3"><Link href="/admin/tickets" className="rounded-xl border px-4 py-3 text-sm hover:bg-accent">Atender chamados</Link><Link href="/admin/administrators" className="rounded-xl border px-4 py-3 text-sm hover:bg-accent">Gerenciar administradores</Link></nav>
    {result.error || !result.data ? <p role="alert" className="rounded-2xl bg-destructive/10 p-4 text-destructive">Não foi possível carregar os indicadores. Tente novamente.</p> : <AdminOverviewPanel initialData={result.data as AdminOverview} />}
  </div>
}
