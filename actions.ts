'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/auth/update-password`,
  })

  if (error) {
    console.error('Error sending password reset email:', error)
    return redirect('/forgot-password?message=Não foi possível enviar o e-mail de recuperação.')
  }

  return redirect('/login?message=Link de recuperação enviado para seu e-mail.')
}