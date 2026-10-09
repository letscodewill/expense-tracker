import { getTicketAccess } from '@/lib/tickets-server'

export async function GET() {
  const headers = { 'Cache-Control': 'private, no-store' }
  const { supabase, user, master } = await getTicketAccess()
  if (!user) return Response.json({ error: 'Não autenticado.' }, { status: 401, headers })
  if (!master) return Response.json({ error: 'Acesso negado.' }, { status: 403, headers })
  const [open, progress, latest] = await Promise.all([
    supabase.from('reports').select('protocol_number', { count: 'exact', head: true }).eq('status', 'aberto'),
    supabase.from('reports').select('protocol_number', { count: 'exact', head: true }).eq('status', 'em_atendimento'),
    supabase.from('reports').select('protocol_number,subject').order('protocol_number', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (open.error || progress.error || latest.error) return Response.json({ error: 'Não foi possível consultar os chamados.' }, { status: 503, headers })
  return Response.json({ open: open.count ?? 0, inProgress: progress.count ?? 0, latest: latest.data ?? null }, { headers })
}
