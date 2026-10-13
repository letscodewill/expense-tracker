import { createClient } from '@/lib/supabase/server'
import { searchAmount, searchNamePattern } from '@/lib/expense-search'

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' }
  const supabase = await createClient()
  const auth = await supabase.auth.getUser()
  if (auth.error || !auth.data.user) return Response.json({ error: 'Entre novamente para pesquisar.' }, { status: 401, headers })
  const term = (new URL(request.url).searchParams.get('q') ?? '').trim()
  if (!term || term.length > 100) return Response.json({ error: 'Digite um nome ou valor de até 100 caracteres.' }, { status: 400, headers })
  const userId = auth.data.user.id
  const base = () => supabase.from('expenses').select('id,nome,valor,data_pagamento,status,board_id')
    .eq('user_id', userId).is('represents_board_id', null).order('data_pagamento', { ascending: false }).order('id').limit(51)
  const amount = searchAmount(term)
  const queries = [base().ilike('nome', searchNamePattern(term))]
  if (amount !== null) queries.push(base().eq('valor', amount))
  const responses = await Promise.all(queries)
  if (responses.some(result => result.error)) return Response.json({ error: 'Não foi possível pesquisar. Tente novamente.' }, { status: 503, headers })
  const unique = [...new Map(responses.flatMap(result => result.data ?? []).map(row => [row.id, row])).values()]
    .sort((a, b) => b.data_pagamento.localeCompare(a.data_pagamento) || String(a.id).localeCompare(String(b.id)))
  const rows = unique.slice(0, 50)
  const boardIds = [...new Set(rows.map(row => row.board_id).filter(Boolean))]
  const boards = boardIds.length ? await supabase.from('boards').select('id,name,month,year').eq('user_id', userId).in('id', boardIds) : { data: [], error: null }
  if (boards.error) return Response.json({ error: 'Não foi possível localizar os quadros. Tente novamente.' }, { status: 503, headers })
  const byId = new Map((boards.data ?? []).map(board => [board.id, board]))
  return Response.json({ results: rows.map(row => {
    const board = byId.get(row.board_id)
    return { ...row, board_name: row.board_id ? board?.name ?? 'Quadro indisponível' : 'Painel principal', board_month: board?.month ?? null, board_year: board?.year ?? null }
  }), hasMore: unique.length > 50 }, { headers })
}
