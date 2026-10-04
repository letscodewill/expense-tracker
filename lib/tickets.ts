export const MASTER_EMAIL = 'williansantos38@gmail.com'
export type TicketStatus = 'aberto' | 'em_atendimento' | 'finalizado'
export type Ticket = {
  protocol_number: number
  subject: string
  message: string
  user_id: string
  user_email: string | null
  user_name: string | null
  created_at: string
  status: TicketStatus
  closed_at: string | null
}
export type TicketReply = { id: string; report_protocol: number; message: string; created_at: string; author_id: string }
export const TICKET_LABELS: Record<TicketStatus, string> = {
  aberto: 'Aberto', em_atendimento: 'Em atendimento', finalizado: 'Finalizado',
}
export function isMasterIdentity(user: { email?: string; email_confirmed_at?: string } | null): boolean {
  return !!user?.email_confirmed_at && user.email?.toLowerCase() === MASTER_EMAIL
}
export function validateTicketReply(protocol: number, message: string): string | null {
  if (!Number.isSafeInteger(protocol) || protocol < 1) return 'Protocolo inválido.'
  if (!message.trim()) return 'Escreva uma resposta para o usuário.'
  if (message.trim().length > 10000) return 'A resposta deve ter no máximo 10.000 caracteres.'
  return null
}
