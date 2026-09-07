import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  // Pegue o parâmetro "next", se não existir, mande para a sua rota correta: /auth/update-password
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Cria a resposta de redirecionamento
      const response = NextResponse.redirect(`${origin}${next}`)
      
      // IMPORTANTE: Alguns middlewares ou versões do Next exigem que os cookies 
      // gerados na troca de sessão sejam repassados na resposta se você estiver usando Server Components.
      return response
    }
    
    console.error('Erro na troca de código do Supabase:', error)
    return NextResponse.redirect(`${origin}/login?message=Não foi possível validar o link de recuperação.`)
  }

  return NextResponse.redirect(`${origin}/login?message=Link de recuperação inválido ou expirado.`)
}
