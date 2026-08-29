import { createClient } from '@/lib/supabase/client'

/**
 * Wraps supabase.auth.getUser() so that an invalid/expired refresh token
 * (AuthApiError: refresh_token_not_found) is treated as "no user" instead
 * of crashing the caller.
 *
 * Use this from client components that need the current user for an action
 * (e.g. inserting a row with user_id). For auth-gating pages, prefer
 * server-side getUser() in middleware/Server Components.
 */
export async function safeGetUser() {
  try {
    const { data } = await createClient().auth.getUser()
    return data.user
  } catch (err) {
    console.warn('[supabase] getUser failed, treating as signed out:', err)
    return null
  }
}
