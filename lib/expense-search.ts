export function searchAmount(input: string): number | null {
  let value = input.trim().replace(/^R\$\s*/i, '')
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(value)) value = value.replaceAll('.', '')
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) return null
  const amount = Number(value.replace(',', '.'))
  return Number.isFinite(amount) && amount <= 10000000 ? amount : null
}

export function searchNamePattern(input: string): string {
  return `%${input.replace(/[\\%_]/g, '\\$&')}%`
}

export type ExpenseSearchResult = {
  id: string; nome: string; valor: number; data_pagamento: string; status: string; board_id: string | null
  board_name: string; board_month: number | null; board_year: number | null
}
