'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isMasterIdentity } from '@/lib/tickets'
import { validateCourtesy, type CourtesyInput } from '@/lib/pro-benefits'

export async function changeCourtesy(input: CourtesyInput): Promise<{ error: string | null }> {
  const client = await createClient()
  const { data, error } = await client.auth.getUser()
  if (error || !isMasterIdentity(data.user)) return { error: 'Acesso permitido somente ao proprietário.' }
  const owner = await client.rpc('is_support_owner')
  if (owner.error || owner.data !== true) return { error: 'Acesso permitido somente ao proprietário.' }
  const invalid = validateCourtesy(input)
  if (invalid) return { error: invalid }
  const result = await client.rpc('change_pro_courtesy', {
    action_input: input.action, user_input: input.userId, expires_input: input.expiresAt,
    reason_input: input.reason.trim(), revision_input: input.revision, request_input: input.requestId,
  })
  if (result.error || result.data !== true) {
    const safe = new Set(['Escolha uma validade futura ou sem vencimento.','O benefício foi alterado. Atualize a página antes de continuar.','Conta confirmada não encontrada.','O acesso master é permanente e não pode ser alterado por cortesia.','Não há cortesia para revogar.'])
    return { error: safe.has(result.error?.message ?? '') ? result.error!.message : 'Não foi possível confirmar a alteração do benefício. Tente novamente.' }
  }
  revalidatePath('/admin/benefits')
  revalidatePath('/')
  return { error: null }
}
