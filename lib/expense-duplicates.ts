import type { SupabaseClient } from '@supabase/supabase-js'

export type DuplicateCandidate = { nome: string; valor: number; data_pagamento: string }
type StoredExpense = DuplicateCandidate & { id: number; board_id: string | null }
export type DuplicateWarning = { index: number; nome: string; valor: number; month: string; existingIds: number[]; repeatedInBatch: boolean }

function key(row: DuplicateCandidate) {
  const name = row.nome.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
  return JSON.stringify([name, Math.round(row.valor * 100), row.data_pagamento.slice(0, 7)])
}

export function detectExpenseDuplicates(rows: DuplicateCandidate[], existing: StoredExpense[], excludeId?: number): DuplicateWarning[] {
  const counts = new Map<string, number>()
  const saved = new Map<string, number[]>()
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1)
  for (const row of existing) {
    if (row.id === excludeId) continue
    const fingerprint = key(row)
    saved.set(fingerprint, [...(saved.get(fingerprint) ?? []), row.id])
  }
  return rows.flatMap((row, index) => {
    const fingerprint = key(row), existingIds = saved.get(fingerprint) ?? []
    const repeatedInBatch = (counts.get(fingerprint) ?? 0) > 1
    return existingIds.length || repeatedInBatch
      ? [{ index, nome: row.nome, valor: row.valor, month: row.data_pagamento.slice(0, 7), existingIds, repeatedInBatch }]
      : []
  })
}

export async function checkExpenseDuplicates(client: SupabaseClient, userId: string, rows: DuplicateCandidate[], excludeId?: number) {
  const months = rows.map(row => row.data_pagamento.slice(0, 7)).sort()
  const last = months.at(-1)!
  const [year, month] = last.split('-').map(Number)
  const end = new Date(0)
  end.setUTCFullYear(year, month, 1)
  const existing: StoredExpense[] = []
  // Page through all actual expenses, including other boards; summary rows are mirrors.
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from('expenses')
      .select('id,nome,valor,data_pagamento,board_id').eq('user_id', userId)
      .is('represents_board_id', null).gte('data_pagamento', `${months[0]}-01`)
      .lt('data_pagamento', end.toISOString().slice(0, 10)).order('id').range(offset, offset + 999)
    if (error || !data) throw new Error('Não foi possível verificar duplicidades. Confira sua conexão e tente novamente.')
    existing.push(...data)
    if (data.length < 1000) break
  }
  return detectExpenseDuplicates(rows, existing, excludeId)
}
