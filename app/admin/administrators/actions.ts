'use server'

import { createClient } from '@/lib/supabase/server'
import { isMasterIdentity } from '@/lib/tickets'
import { revalidatePath } from 'next/cache'

export async function updateAdministrator(operation: 'add' | 'remove', value: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !isMasterIdentity(data.user)) return { error: 'Acesso permitido somente ao proprietário.' }
  const owner = await supabase.rpc('is_support_owner')
  if (owner.error || owner.data !== true) return { error: 'Acesso permitido somente ao proprietário.' }
  if (typeof value !== 'string' || !['add', 'remove'].includes(operation)) return { error: 'Dados inválidos.' }
  const normalized = value.trim().toLowerCase()
  if (operation === 'add' && (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))) return { error: 'Informe um e-mail válido.' }
  if (operation === 'remove' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalized)) return { error: 'Administrador inválido.' }
  const result = operation === 'add'
    ? await supabase.rpc('add_ticket_administrator', { account_email: normalized })
    : await supabase.rpc('remove_ticket_administrator', { account_id: normalized })
  if (result.error) return { error: operation === 'add' ? 'Não foi possível adicionar. Verifique se a conta existe e tem o e-mail confirmado.' : 'Não foi possível remover este administrador.' }
  revalidatePath('/')
  revalidatePath('/admin/administrators')
  revalidatePath('/admin/tickets')
  return { error: null }
}
