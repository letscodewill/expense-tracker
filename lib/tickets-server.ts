import 'server-only'
import { createClient } from '@/lib/supabase/server'

export async function getTicketAccess() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return { supabase, user: null, master: false }
  let master = false
  if (data.user.email_confirmed_at) {
    const result = await supabase.rpc('is_ticket_master')
    master = !result.error && result.data === true
  }
  return { supabase, user: data.user, master }
}
