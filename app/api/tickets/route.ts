import { getTicketAccess } from '@/lib/tickets-server'

export async function GET(request: Request) {
  const { supabase, user, master } = await getTicketAccess()
  const headers = { 'Cache-Control': 'private, no-store' }
  if (!user) return Response.json({ error: 'Não autenticado.' }, { status: 401, headers })
  const params = new URL(request.url).searchParams
  if (params.get('admin') === 'true' && !master) return Response.json({ error: 'Acesso negado.' }, { status: 403, headers })
  const offset = Number(params.get('offset') ?? 0)
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) return Response.json({ error: 'Página inválida.' }, { status: 400, headers })
  let query = supabase.from('reports').select('protocol_number,subject,message,user_id,user_email,user_name,created_at,status,closed_at')
    .order('protocol_number', { ascending: false }).range(offset, offset + 99)
  if (params.get('admin') !== 'true') query = query.eq('user_id', user.id)
  const { data, error } = await query
  if (error) return Response.json({ error: 'Não foi possível carregar os tickets.' }, { status: 503, headers })
  return Response.json({ tickets: data ?? [] }, { headers })
}
