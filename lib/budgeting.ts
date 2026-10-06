export const CATEGORIES = ['Sem categoria', 'Mercado', 'Transporte', 'Lazer', 'Moradia', 'Saúde', 'Educação', 'Alimentação', 'Assinaturas', 'Outros'] as const
export type CategorizedExpense = { id: number; nome: string; valor: number; category: string; data_pagamento: string; status: string; represents_board_id?: string | null }
export function monthStart(year: number, month: number) {
  const date = new Date(0)
  date.setUTCFullYear(year, month, 1)
  return date.toISOString().slice(0, 10)
}
export function categoryTotals(rows: CategorizedExpense[], month: string, categories: readonly string[] = CATEGORIES) {
  const totals = new Map(categories.map(category => [category, 0]))
  for (const row of rows) {
    if (row.represents_board_id || !row.data_pagamento.startsWith(month) || !Number.isFinite(row.valor)) continue
    const category = totals.has(row.category) ? row.category : 'Sem categoria'
    totals.set(category, (totals.get(category) ?? 0) + Math.round(row.valor * 100))
  }
  return Object.fromEntries([...totals].map(([category, cents]) => [category, cents / 100]))
}
export function dueExpenses(rows: CategorizedExpense[], today: string, days: number) {
  const end = new Date(`${today}T12:00:00Z`)
  end.setUTCDate(end.getUTCDate() + days)
  return rows.filter(row => !row.represents_board_id && row.status === 'Pendente' && row.data_pagamento <= end.toISOString().slice(0, 10))
    .sort((a, b) => a.data_pagamento.localeCompare(b.data_pagamento) || a.id - b.id)
}
export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
