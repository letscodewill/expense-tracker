export type Courtesy = { expires_at: string | null; reason: string; revoked_at: string | null; revision: number; updated_at: string }
export type BenefitUser = { id: string; email: string; name: string; email_confirmed_at: string | null; is_master: boolean; courtesy: Courtesy | null }
export type BenefitAudit = { id: number; action: 'grant' | 'revoke'; created_at: string; user_email: string | null; actor_email: string | null; before_value: Courtesy | null; after_value: Courtesy }
export type BenefitsOverview = { users: BenefitUser[]; total: number; history: BenefitAudit[] }
export type CourtesyInput = { action: 'grant' | 'revoke'; userId: string; expiresAt: string | null; reason: string; revision: number; requestId: string }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validateCourtesy(input: CourtesyInput): string | null {
  if (!input || !['grant','revoke'].includes(input.action) || !uuid.test(input.userId ?? '') || !uuid.test(input.requestId ?? '') || !Number.isSafeInteger(input.revision) || input.revision < 0) return 'Dados inválidos.'
  if (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.trim().length > 300) return 'Informe um motivo com até 300 caracteres.'
  if (input.expiresAt !== null && (typeof input.expiresAt !== 'string' || !Number.isFinite(Date.parse(input.expiresAt)))) return 'Escolha uma validade futura ou sem vencimento.'
  // The database checks future dates. Keeping valid past timestamps here lets
  // a retry of an already committed request resolve after its expiry time.
  return null
}

export function courtesyStatus(user: BenefitUser, now = Date.now()) {
  if (user.is_master) return 'Master'
  if (!user.courtesy) return 'Sem cortesia'
  if (user.courtesy.revoked_at) return 'Revogada'
  if (user.courtesy.expires_at && Date.parse(user.courtesy.expires_at) <= now) return 'Expirada'
  return 'Pro cortesia'
}
