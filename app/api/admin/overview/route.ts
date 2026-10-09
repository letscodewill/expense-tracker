import { getTicketAccess } from '@/lib/tickets-server'
import { isMasterIdentity } from '@/lib/tickets'

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' }
  const { supabase, user } = await getTicketAccess()
  if (!user) return Response.json({ error: 'Não autenticado.' }, { status: 401, headers })
  if (!isMasterIdentity(user)) return Response.json({ error: 'Acesso negado.' }, { status: 403, headers })
  const owner = await supabase.rpc('is_support_owner')
  if (owner.error || owner.data !== true) return Response.json({ error: 'Acesso negado.' }, { status: 403, headers })
  const params = new URL(request.url).searchParams
  const offset = Number(params.get('offset') ?? 0)
  const search = (params.get('search') ?? '').trim()
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000 || search.length > 100) {
    return Response.json({ error: 'Busca inválida.' }, { status: 400, headers })
  }
  const { data, error } = await supabase.rpc('get_admin_overview', { page_offset: offset, search_value: search })
  if (error || !data) return Response.json({ error: 'Não foi possível carregar os indicadores.' }, { status: 503, headers })
  return Response.json(data, { headers })
}
