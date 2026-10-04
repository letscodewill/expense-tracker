'use server'

import { revalidatePath } from 'next/cache'
import { getTicketAccess } from '@/lib/tickets-server'
import { validateTicketReply, type TicketStatus } from '@/lib/tickets'

export async function answerTicket(protocol: number, message: string, finish: boolean) {
  const { supabase, master } = await getTicketAccess()
  if (!master) return { error: 'Você não tem permissão para administrar tickets.' }
  if (typeof message !== 'string' || typeof finish !== 'boolean') return { error: 'Resposta inválida.' }
  const validation = validateTicketReply(protocol, message)
  if (validation) return { error: validation }
  const { error } = await supabase.rpc('answer_support_ticket', {
    ticket_protocol: protocol, reply_message: message.trim(), finish_ticket: finish,
  })
  if (error) return { error: 'Não foi possível responder. Atualize o painel e tente novamente.' }
  revalidatePath('/admin/tickets')
  revalidatePath('/tickets')
  return { error: null }
}

export async function changeTicketStatus(protocol: number, status: TicketStatus) {
  const { supabase, master } = await getTicketAccess()
  if (!master) return { error: 'Você não tem permissão para administrar tickets.' }
  if (!Number.isSafeInteger(protocol) || protocol < 1 || !['aberto', 'em_atendimento', 'finalizado'].includes(status)) {
    return { error: 'Protocolo ou status inválido.' }
  }
  const { error } = await supabase.rpc('change_support_ticket_status', { ticket_protocol: protocol, new_status: status })
  if (error) return { error: 'Não foi possível atualizar o ticket. Tente novamente.' }
  revalidatePath('/admin/tickets')
  revalidatePath('/tickets')
  return { error: null }
}
