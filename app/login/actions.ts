'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBaseUrl } from '@/lib/env/base-url'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error(error)
    return redirect('/login?message=Não foi possível autenticar o usuário.')
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getBaseUrl()}/auth/callback`,
    },
  })

  if (error) {
    return redirect('/login?message=Não foi possível cadastrar o usuário.')
  }

  revalidatePath('/', 'layout')
  return redirect('/login?message=Verifique seu email para continuar o processo de cadastro.')
}

export async function recoverPassword(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string

  console.log('DEBUG redirectTo (recover):', `${getBaseUrl()}/auth/callback`)

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getBaseUrl()}/auth/callback`,
  })


  if (error) {
    console.error(error)
    return redirect(
      '/login?mode=recover&message=Não foi possível enviar o email de recuperação.'
    )
  }

  return redirect(
    '/login?mode=recover&message=Se o e-mail estiver cadastrado, um link de recuperação foi enviado.'
  )
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}