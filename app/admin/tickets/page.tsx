import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { getTicketAccess } from '@/lib/tickets-server'
import { TicketsPanel } from '@/components/tickets-panel'
import type { Ticket } from '@/lib/tickets'

export default async function AdminTicketsPage() {
  const { supabase, user, master } = await getTicketAccess()
  if (!user) redirect('/login')
  if (!master) notFound()
  const { data, error } = await supabase.from('reports')
    .select('protocol_number,subject,message,user_id,user_email,user_name,created_at,status,closed_at')
    .order('protocol_number', { ascending: false }).limit(100)
  return (
    <div className="container mx-auto max-w-7xl p-4 md:p-8">
      <header className="material-app-bar mb-6 flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-sm text-muted-foreground">Atendimento • Administrador</p><h1 className="text-3xl font-medium">Painel de tickets</h1></div>
        <Link href="/" className="text-sm text-primary hover:underline">Voltar ao Dashboard</Link>
      </header>
      {error ? <p role="alert" className="rounded-2xl bg-destructive/10 p-4 text-destructive">Não foi possível carregar os tickets. Verifique a migração do suporte no Supabase e tente novamente.</p>
        : <TicketsPanel initialTickets={(data ?? []) as Ticket[]} admin />}
    </div>
  )
}
