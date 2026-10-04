import type { SupabaseClient } from '@supabase/supabase-js'

export const AVATAR_BUCKET = 'profile-photos'
export const AVATAR_MAX_SIZE = 2 * 1024 * 1024
const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
type ProfileUser = { id: string; user_metadata?: Record<string, unknown>; identities?: { provider: string; identity_data?: Record<string, unknown> }[] }

export function avatarPath(user: ProfileUser): string | null {
  const value = user.user_metadata?.profile_photo_path
  if (typeof value !== 'string' || !value.startsWith(`${user.id}/`)) return null
  return /^[0-9a-f-]+\/[0-9a-f-]+\.(jpg|png|webp)$/.test(value) ? value : null
}

export function googlePhoto(user: ProfileUser): string | null {
  const google = user.identities?.find(identity => identity.provider === 'google')?.identity_data
  for (const value of [google?.avatar_url, google?.picture, user.user_metadata?.avatar_url, user.user_metadata?.picture]) {
    if (typeof value !== 'string') continue
    try {
      const url = new URL(value)
      if (url.protocol === 'https:' && !url.username && !url.password && (url.hostname === 'googleusercontent.com' || url.hostname.endsWith('.googleusercontent.com'))) return url.href
    } catch { /* Ignore invalid provider image URLs. */ }
  }
  return null
}

export function validateAvatar(file: { size: number; type: string }): string | null {
  if (!extensions[file.type]) return 'Escolha uma imagem JPG, PNG ou WebP.'
  if (!file.size || file.size > AVATAR_MAX_SIZE) return 'A imagem deve ter até 2 MB e não pode estar vazia.'
  return null
}

export async function saveProfilePhoto(supabase: SupabaseClient, file: File | null) {
  if (file) {
    const error = validateAvatar(file)
    if (error) return { error }
  }
  const { data, error: authError } = await supabase.auth.getUser()
  if (authError || !data.user) return { error: 'Entre novamente para alterar sua foto.' }
  const previous = avatarPath(data.user)
  const bucket = supabase.storage.from(AVATAR_BUCKET)
  const path = file ? `${data.user.id}/${crypto.randomUUID()}.${extensions[file.type]}` : null
  if (file && path) {
    const result = await bucket.upload(path, file, { contentType: file.type, upsert: false })
    if (result.error) return { error: 'Não foi possível enviar a foto. Tente novamente.' }
  }
  const updated = await supabase.auth.updateUser({ data: { profile_photo_path: path } })
  if (updated.error) {
    if (path) await bucket.remove([path]).catch(() => undefined)
    return { error: 'Não foi possível salvar a foto do perfil. Tente novamente.' }
  }
  // Only remove an old file after the new preference has been saved.
  if (previous && previous !== path) await bucket.remove([previous]).catch(() => undefined)
  return { error: null }
}
