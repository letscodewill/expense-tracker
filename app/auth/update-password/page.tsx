'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [messageKind, setMessageKind] = useState<'error' | 'success'>('error')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  // The recovery email link is opened as a redirect through /auth/callback,
  // which already exchanges the code for a session. So by the time this page
  // mounts, we should already have a Supabase session. We verify it and, if
  // the user landed here without a valid recovery session, we send them back
  // to /login.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session)
      setReady(true)
    })
  }, [])

  const handleUpdatePassword = async () => {
    setMessage('')

    if (password.length < 6) {
      setMessageKind('error')
      setMessage('A senha deve ter no mínimo 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setMessageKind('error')
      setMessage('As senhas não coincidem.')
      return
    }

    setLoading(true)
    setMessageKind('error')

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    setLoading(false)

    if (error) {
      setMessage('Não foi possível atualizar a senha: ' + (error.message || 'erro desconhecido'))
      return
    }

    setMessageKind('success')
    setMessage('Senha atualizada com sucesso! Redirecionando...')
    // Mantém o usuário logado (Supabase já renovou a sessão com a nova senha).
    router.push('/')
    router.refresh()
  }

  if (!ready) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  if (!hasSession) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="p-8 border rounded-lg shadow-md w-96 space-y-4">
          <h2 className="text-2xl font-bold text-center">Link inválido</h2>
          <p className="text-center text-sm text-muted-foreground">
            Este link de recuperação é inválido ou expirou. Solicite um novo.
          </p>
          <button
            onClick={() => router.push('/login?mode=recover')}
            className="bg-blue-500 text-white p-2 rounded w-full"
          >
            Solicitar novo link
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="p-8 border rounded-lg shadow-md w-96 space-y-4">
        <h2 className="text-2xl font-bold text-center">Redefinir sua senha</h2>
        <div className="flex flex-col">
          <label htmlFor="password">Nova senha:</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="p-2 border rounded"
            autoComplete="new-password"
            minLength={6}
            autoFocus
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="confirm">Confirmar nova senha:</label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="p-2 border rounded"
            autoComplete="new-password"
            minLength={6}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleUpdatePassword()
            }}
          />
        </div>
        <button
          onClick={handleUpdatePassword}
          disabled={loading}
          className="bg-blue-500 text-white p-2 rounded w-full disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Atualizar senha'}
        </button>
        {message && (
          <p
            className={
              'text-center text-sm mt-4 ' +
              (messageKind === 'success' ? 'text-green-600' : 'text-red-600')
            }
          >
            {message}
          </p>
        )}
      </div>
    </div>
  )
}