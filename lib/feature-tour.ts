import type { SupabaseClient } from '@supabase/supabase-js'

// Change deliberately when publishing a new presentation, not on every deploy.
export const FEATURE_TOUR_VERSION = '2026-10-introduction'
export const FEATURE_TOUR_METADATA_KEY = 'nocontrole_dismissed_tour'
export const FEATURE_TOUR_OPEN_EVENT = 'nocontrole:open-feature-tour'
export const FEATURE_TOUR_STEPS = ['expense', 'import', 'planning', 'search', 'appearance'] as const
export type FeatureTourStep = typeof FEATURE_TOUR_STEPS[number]

export function tourVisitKey(userId: string, signedInAt: string) {
  return `nocontrole:tour:${FEATURE_TOUR_VERSION}:${userId}:${signedInAt}`
}
export function claimTourVisit(storage: Pick<Storage, 'getItem' | 'setItem'>, key: string, dismissed: boolean) {
  if (dismissed) return false
  try {
    if (storage.getItem(key) === '1') return false
    storage.setItem(key, '1')
  } catch { /* The guide remains available if browser storage is blocked. */ }
  return true
}
export async function dismissFeatureTour(client: SupabaseClient, expectedUserId: string, dismissed = true) {
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user || user.id !== expectedUserId) throw new Error('Sua sessão mudou. Entre novamente para salvar esta preferência.')
  const result = await client.auth.updateUser({ data: { [FEATURE_TOUR_METADATA_KEY]: dismissed ? FEATURE_TOUR_VERSION : null } })
  const applied = result.data.user?.user_metadata?.[FEATURE_TOUR_METADATA_KEY] === FEATURE_TOUR_VERSION
  if (result.error || result.data.user?.id !== expectedUserId || applied !== dismissed) {
    throw new Error('Não foi possível salvar sua preferência. Tente novamente.')
  }
}
