'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const handleUpdatePassword = async () => {
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setMessage('Não foi possível atualizar a senha: ' + error.message)
    } else {
      setMessage('Senha atualizada com sucesso! Redirecionando para o login...')
      setTimeout(() => router.push('/login'), 2000)
    }
  }

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="p-8 border rounded-lg shadow-md w-96 space-y-4">
        <h2 className="text-2xl font-bold text-center">Redefinir sua Senha</h2>
        <div className="flex flex-col">
            <label htmlFor="password">Nova Senha:</label>
            <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="p-2 border rounded"
            />
        </div>
        <button onClick={handleUpdatePassword} className="bg-blue-500 text-white p-2 rounded w-full">Atualizar Senha</button>
        {message && <p className="text-center text-sm mt-4">{message}</p>}
      </div>
    </div>
  )
}