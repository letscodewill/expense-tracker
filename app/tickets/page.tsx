import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTicketAccess } from '@/lib/tickets-server'
import { TicketsPanel } from '@/components/tickets-panel'
import { ReportDialog } from '@/components/report-dialog'
import type { Ticket } from '@/lib/tickets'

export default async function MyTicketsPage() {
  const { supabase, user } = await getTicketAccess()
  if (!user) redirect('/login')
  const { data, error } = await supabase.from('reports')
    .select('protocol_number,subject,message,user_id,user_email,user_name,created_at,status,closed_at')
    .eq('user_id', user.id).order('protocol_number', { ascending: false }).limit(100)
  return (
    <div className="container mx-auto max-w-7xl p-4 md:p-8">
      <header className="material-app-bar mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-medium">Meus tickets</h1>
        <div className="flex items-center gap-4"><ReportDialog /><Link href="/" className="text-sm text-primary hover:underline">Voltar ao Dashboard</Link></div>
      </header>
      {error ? <p role="alert" className="text-destructive">Não foi possível carregar seus tickets. Tente novamente.</p>
        : <TicketsPanel initialTickets={(data ?? []) as Ticket[]} />}
    </div>
  )
}
