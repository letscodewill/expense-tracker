import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  // Only allow an internal path. In particular, "@host" must never be
  // concatenated to the origin, where it would become URL credentials.
  const destination = new URL('/', origin)
  if (next.startsWith('/') && !next.startsWith('//') && !/[\\\u0000-\u0020\u007f]/.test(next)) {
    const candidate = new URL(next, origin)
    if (candidate.origin === origin) destination.href = candidate.href
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(destination)
    }

    return NextResponse.redirect(
      `${origin}/login?message=Não foi possível validar o link.`
    )
  }

  return NextResponse.redirect(
    `${origin}/login?message=Link inválido ou expirado.`
  )
}
