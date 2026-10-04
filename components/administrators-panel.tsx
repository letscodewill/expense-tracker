'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateAdministrator } from '@/app/admin/administrators/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type Administrator = { user_id: string; email: string; is_owner: boolean }
export function AdministratorsPanel({ administrators }: { administrators: Administrator[] }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [removing, setRemoving] = useState<string | null>(null)
  async function update(operation: 'add' | 'remove', value: string) {
    setBusy(true)
    setMessage('')
    try {
      const result = await updateAdministrator(operation, value)
      if (result.error) setMessage(result.error)
      else {
        setMessage(operation === 'add' ? 'Administrador adicionado.' : 'Acesso removido.')
        setEmail('')
        setRemoving(null)
        router.refresh()
      }
    } catch { setMessage('Não foi possível atualizar. Tente novamente.') }
    finally { setBusy(false) }
  }
  return <section className="space-y-6 rounded-3xl border bg-card p-6">
    <p className="text-muted-foreground">Administradores podem ver, responder e finalizar tickets. Somente você pode gerenciar estes acessos. A conta precisa estar cadastrada e ter o e-mail confirmado.</p>
    <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); void update('add', email) }}>
      <div className="min-w-0 flex-1"><label htmlFor="administrator-email">E-mail do administrador</label><Input id="administrator-email" type="email" required maxLength={254} value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></div>
      <Button type="submit" disabled={busy}>Adicionar</Button>
    </form>
    {message && <p role="status" aria-live="polite">{message}</p>}
    <ul className="divide-y">{administrators.map(admin => <li key={admin.user_id} className="flex flex-wrap items-center justify-between gap-3 py-4">
      <span className="break-all">{admin.email}{admin.is_owner && ' • Proprietário'}</span>
      {!admin.is_owner && (removing === admin.user_id ? <div className="flex flex-wrap items-center gap-2"><span>Remover acesso?</span><Button variant="destructive" disabled={busy} onClick={() => void update('remove', admin.user_id)}>Confirmar remoção</Button><Button variant="outline" disabled={busy} onClick={() => setRemoving(null)}>Cancelar</Button></div> : <Button variant="outline" disabled={busy} onClick={() => setRemoving(admin.user_id)}>Remover</Button>)}
    </li>)}</ul>
  </section>
}
