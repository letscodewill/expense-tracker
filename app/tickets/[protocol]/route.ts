import { getTicketAccess } from '@/lib/tickets-server'

export async function GET(_request: Request, { params }: { params: Promise<{ protocol: string }> }) {
  const { supabase, user, master } = await getTicketAccess()
  const headers = { 'Cache-Control': 'private, no-store' }
  if (!user) return Response.json({ error: 'Não autenticado.' }, { status: 401, headers })
  const protocol = Number((await params).protocol)
  if (!Number.isSafeInteger(protocol) || protocol < 1) return Response.json({ error: 'Protocolo inválido.' }, { status: 400, headers })
  let query = supabase.from('reports')
    .select('protocol_number,subject,message,user_id,user_email,user_name,created_at,status,closed_at')
    .eq('protocol_number', protocol)
  if (!master) query = query.eq('user_id', user.id)
  const { data: ticket, error } = await query.maybeSingle()
  if (error) return Response.json({ error: 'Não foi possível carregar o ticket.' }, { status: 503, headers })
  if (!ticket) return Response.json({ error: 'Ticket não encontrado.' }, { status: 404, headers })
  const { data: replies, error: replyError } = await supabase.from('report_replies')
    .select('id,report_protocol,message,created_at,author_id').eq('report_protocol', protocol)
    .order('created_at', { ascending: true })
  if (replyError) return Response.json({ error: 'Não foi possível carregar as respostas.' }, { status: 503, headers })
  return Response.json({ ticket, replies: replies ?? [] }, { headers })
}
