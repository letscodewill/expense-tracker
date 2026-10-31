import type { SupabaseClient } from '@supabase/supabase-js'
import type { MonthYear } from '@/components/month-year-picker'

export const MONTH_START_KEY = 'nocontrole_month_start'
export type MonthStartPreference = { home: string | null; answered: string[] }

export function parseMonth(value: unknown): MonthYear | null {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null
  const year = Number(value.slice(0, 4))
  return year > 0 ? { year, month: Number(value.slice(5)) - 1 } : null
}
export function monthKey(period: MonthYear) {
  return `${String(period.year).padStart(4, '0')}-${String(period.month + 1).padStart(2, '0')}`
}
export function monthPreference(value: unknown): MonthStartPreference {
  const input = value && typeof value === 'object' ? value as Partial<MonthStartPreference> : {}
  return { home: parseMonth(input.home) ? input.home! : null, answered: Array.isArray(input.answered)
    ? [...new Set(input.answered.filter(key => parseMonth(key)))].sort().slice(-24) : [] }
}
export function initialMonth(home: unknown, now = new Date()): MonthYear {
  const current = { year: now.getFullYear(), month: now.getMonth() }
  const saved = parseMonth(home)
  return saved ?? current
}
export function followingMonth(key: string): string | null {
  const period = parseMonth(key)
  if (!period || key === '9999-12') return null
  return monthKey(period.month === 11 ? { year: period.year + 1, month: 0 } : { ...period, month: period.month + 1 })
}
export function mayOfferNextMonth(key: string, preference: MonthStartPreference, now = new Date()) {
  return !!followingMonth(key) && key >= monthKey(initialMonth(preference.home, now)) && !preference.answered.includes(key)
}

export async function isMonthSettled(client: SupabaseClient, userId: string, key: string): Promise<boolean> {
  const period = parseMonth(key)
  const to = followingMonth(key)
  if (!period || !to) return false
  let count = 0
  // Read the underlying expenses from every board, excluding mirrored totals.
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from('expenses').select('id,status')
      .eq('user_id', userId).is('represents_board_id', null)
      .gte('data_pagamento', `${key}-01`).lt('data_pagamento', `${to}-01`)
      .order('id').range(offset, offset + 999)
    if (error || !data) throw new Error('Não foi possível verificar as pendências do mês. Tente novamente.')
    if (data.some(row => row.status !== 'Pago' && row.status !== 'VR/VA')) return false
    count += data.length
    if (data.length < 1000) return count > 0
  }
}

export async function saveMonthChoice(client: SupabaseClient, userId: string, key: string | null, advance: boolean) {
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user || user.id !== userId) throw new Error('Sua sessão mudou. Entre novamente para salvar esta preferência.')
  const previous = monthPreference(user.user_metadata?.[MONTH_START_KEY])
  let home: string | null = null
  if (key !== null) {
    if (!mayOfferNextMonth(key, previous) || !await isMonthSettled(client, userId, key))
      throw new Error('O mês não está mais disponível para avanço. Atualize o painel e confira as pendências.')
    home = advance ? followingMonth(key) : key
  }
  const preference: MonthStartPreference = { home, answered: key ? [...new Set([...previous.answered, key])].sort().slice(-24) : previous.answered }
  const result = await client.auth.updateUser({ data: { [MONTH_START_KEY]: preference } })
  const applied = monthPreference(result.data.user?.user_metadata?.[MONTH_START_KEY])
  if (result.error || result.data.user?.id !== userId || JSON.stringify(applied) !== JSON.stringify(preference))
    throw new Error('Não foi possível salvar sua preferência. Tente novamente.')
  return preference
}
