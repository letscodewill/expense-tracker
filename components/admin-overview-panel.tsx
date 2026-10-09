'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AdminOverview } from '@/lib/admin-overview'

const dateLabel = (value: string | null) => value ? new Date(value).toLocaleString('pt-BR') : 'Sem registro'

export function AdminOverviewPanel({ initialData }: { initialData: AdminOverview }) {
  const [data, setData] = useState(initialData)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  async function load(nextSearch: string, nextOffset: number) {
    if (inFlight.current) return
    inFlight.current = true
    setLoading(true); setError('')
    try {
      const response = await fetch(`/api/admin/overview?search=${encodeURIComponent(nextSearch)}&offset=${nextOffset}`, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setData(result); setSearch(nextSearch); setOffset(nextOffset)
    } catch { setError('Não foi possível atualizar os indicadores. Tente novamente.') }
    finally { inFlight.current = false; setLoading(false) }
  }
  const cards = [
    ['Usuários cadastrados', data.summary.registered], ['E-mails confirmados', data.summary.confirmed],
    ['Acessos nos últimos 7 dias', data.summary.active7], ['Acessos nos últimos 30 dias', data.summary.active30],
    ['Atividade em despesas · 30 dias', data.summary.used30], ['Novos cadastros · 30 dias', data.summary.new30],
  ] as const
  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([label, value]) => <section key={label} className="rounded-3xl border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-medium">{value}</p></section>)}</div>
    <p className="text-sm text-muted-foreground">Acessos consideram login ou uso do painel. Atividade em despesas considera lançamentos existentes e alterações registradas a partir da ativação deste painel. Os registros de acesso são atualizados a cada 5 minutos enquanto o sistema está visível.</p>
    <section className="space-y-4 rounded-3xl border bg-card p-4 sm:p-6">
      <h2 className="text-xl font-medium">Usuários da plataforma</h2>
      <form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); void load(draft.trim(), 0) }}>
        <Input aria-label="Buscar usuário por nome ou e-mail" placeholder="Nome ou e-mail" value={draft} maxLength={100} onChange={event => setDraft(event.target.value)} className="min-w-0 flex-1" />
        <Button type="submit" disabled={loading}>Buscar</Button><Button type="button" variant="outline" disabled={loading} onClick={() => void load(search, offset)}>Atualizar</Button>
      </form>
      {loading && <p role="status" className="text-sm text-muted-foreground">Atualizando...</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Usuário</th><th className="p-3">Cadastro</th><th className="p-3">Último acesso</th><th className="p-3">Última atividade em despesas</th></tr></thead><tbody>
        {data.users.map(user => <tr key={user.id} className="border-b last:border-0"><td className="p-3"><p className="font-medium">{user.name || 'Usuário'}</p><p className="break-all text-muted-foreground">{user.email}</p><p className="text-xs text-muted-foreground">{user.confirmed ? 'E-mail confirmado' : 'E-mail não confirmado'}</p></td><td className="p-3">{dateLabel(user.created_at)}</td><td className="p-3">{dateLabel(user.last_access)}</td><td className="p-3">{dateLabel(user.last_action)}</td></tr>)}
      </tbody></table></div>
      {!data.users.length && <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{data.matching ? `${offset + 1}–${offset + data.users.length} de ${data.matching}` : '0 usuários'}</p><div className="flex gap-2"><Button variant="outline" disabled={loading || offset === 0} onClick={() => void load(search, Math.max(0, offset - 50))}>Anterior</Button><Button variant="outline" disabled={loading || offset + data.users.length >= data.matching} onClick={() => void load(search, offset + 50)}>Próxima</Button></div></div>
    </section>
  </div>
}
