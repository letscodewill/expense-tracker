'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBaseUrl } from '@/lib/env/base-url'
import { recoveryErrorMessage } from '@/lib/password-recovery'
import { isStrongSignupPassword, SIGNUP_PASSWORD_HINT } from '@/lib/signup-password'

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
    return redirect('/login?mode=email&message=' + encodeURIComponent('Não foi possível autenticar o usuário.'))
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData): Promise<{ error: string } | { success: true }> {
  const emailValue = formData.get('email'), nameValue = formData.get('name')
  const password = formData.get('password')
  if (typeof nameValue !== 'string' || !nameValue.trim() || nameValue.trim().length > 100) return { error: 'Informe seu nome.' }
  if (typeof emailValue !== 'string' || emailValue.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue.trim())) return { error: 'Informe um e-mail válido.' }
  if (!isStrongSignupPassword(password)) return { error: SIGNUP_PASSWORD_HINT }
  const supabase = await createClient()
  const email = emailValue.trim(), name = nameValue.trim()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
      },
      emailRedirectTo: `${getBaseUrl()}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.code === 'weak_password' ? SIGNUP_PASSWORD_HINT : 'Não foi possível cadastrar o usuário. Tente novamente.' }
  }

  revalidatePath('/', 'layout')
  return { success: true as const }
}

export async function recoverPassword(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getBaseUrl()}/auth/callback?next=/auth/update-password`,
  })

  if (error) {
    console.error('[password-recovery] Request failed:', { code: error.code, status: error.status })
    return redirect(
      `/login?mode=recover&message=${encodeURIComponent(recoveryErrorMessage(error))}`
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
