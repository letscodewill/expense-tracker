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

export function validSearchDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01') return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export type ExpenseSearchResult = {
  id: string; nome: string; valor: number; data_pagamento: string; status: string; board_id: string | null
  board_name: string; board_month: number | null; board_year: number | null; category?: string
}
