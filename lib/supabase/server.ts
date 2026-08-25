import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Supabase env vars ausentes: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }

  // Defesa: chaves service_role/secret (sb_secret_*) NUNCA devem ser
  // expostas via NEXT_PUBLIC_*. Se aparecer aqui, o build está usando a
  // chave errada e a RLS do banco fica completamente bypassada no client.
  if (anonKey.startsWith('sb_secret_')) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY parece ser uma service_role key (sb_secret_*). ' +
        'Use a Publishable/anon key aqui e mantenha a service_role apenas no servidor.'
    )
  }

  return { url, anonKey }
}

export async function createClient() {
  const { url, anonKey } = getSupabaseEnv()
  const cookieStore = await cookies()

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // O setAll foi chamado a partir de um Server Component.
            // Pode ignorar se você tiver middleware atualizando as sessões.
          }
        },
      },
    }
  )
}