'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { answerTicket, changeTicketStatus } from '@/app/tickets/actions'
import { TICKET_LABELS, type Ticket, type TicketReply, type TicketStatus } from '@/lib/tickets'

const dateLabel = (value: string) => new Date(value).toLocaleString('pt-BR')
const statusStyle = { aberto: 'bg-amber-100 text-amber-900', em_atendimento: 'bg-blue-100 text-blue-900', finalizado: 'bg-emerald-100 text-emerald-900' }

export function TicketsPanel({ initialTickets, admin = false }: { initialTickets: Ticket[]; admin?: boolean }) {
  const [tickets, setTickets] = useState(initialTickets)
  const [selected, setSelected] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<TicketStatus | 'todos'>('todos')
  const [more, setMore] = useState(initialTickets.length === 100)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const visible = tickets.filter((ticket) => (filter === 'todos' || ticket.status === filter)
    && `${ticket.protocol_number} ${ticket.subject} ${ticket.user_name ?? ''} ${ticket.user_email ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))

  async function loadMore() {
    setLoading(true); setError('')
    try {
      const response = await fetch(`/api/tickets?offset=${tickets.length}&admin=${admin}`, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setTickets((previous) => [...previous, ...result.tickets.filter((ticket: Ticket) => !previous.some((item) => item.protocol_number === ticket.protocol_number))])
      setMore(result.tickets.length === 100)
    } catch { setError('Não foi possível carregar mais tickets. Tente novamente.') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(['aberto', 'em_atendimento', 'finalizado'] as const).map((status) => <button key={status} onClick={() => setFilter(status)} className={`rounded-3xl border p-5 text-left transition-colors hover:bg-accent ${filter === status ? 'bg-secondary' : 'bg-card'}`}>
          <span className="text-sm text-muted-foreground">{TICKET_LABELS[status]}</span><p className="mt-2 text-3xl font-medium">{tickets.filter((ticket) => ticket.status === status).length}</p>
        </button>)}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Input className="max-w-md" aria-label="Buscar nos tickets carregados" placeholder="Buscar por protocolo, assunto ou usuário" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select aria-label="Filtrar por status" className="h-12 rounded-xl border bg-card px-3 text-sm" value={filter} onChange={(event) => setFilter(event.target.value as TicketStatus | 'todos')}>
          <option value="todos">Todos os status</option>{Object.entries(TICKET_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <span className="text-xs text-muted-foreground">{tickets.length} tickets carregados</span>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.5fr)]">
        <section aria-label="Lista de tickets" className="space-y-3">
          {visible.length === 0 && <p className="rounded-3xl border bg-card p-8 text-sm text-muted-foreground">Nenhum ticket encontrado.</p>}
          {visible.map((ticket) => <button key={ticket.protocol_number} onClick={() => setSelected(ticket.protocol_number)} className={`w-full rounded-2xl border p-4 text-left transition-colors hover:bg-accent ${selected === ticket.protocol_number ? 'border-primary bg-secondary' : 'bg-card'}`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">#{ticket.protocol_number}</span><Badge className={statusStyle[ticket.status]}>{TICKET_LABELS[ticket.status]}</Badge></div>
            <p className="break-words font-medium">{ticket.subject}</p>
            {admin && <p className="mt-1 break-words text-xs text-muted-foreground">{ticket.user_name || ticket.user_email || 'Usuário'}</p>}
            <p className="mt-2 text-xs text-muted-foreground">{dateLabel(ticket.created_at)}</p>
          </button>)}
          {more && <Button variant="outline" onClick={loadMore} disabled={loading}>{loading ? 'Carregando...' : 'Carregar mais tickets'}</Button>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </section>
        {selected ? <TicketConversation key={selected} protocol={selected} admin={admin} onUpdated={(updated) => setTickets((previous) => previous.map((ticket) => ticket.protocol_number === updated.protocol_number ? updated : ticket))} />
          : <section className="rounded-3xl border bg-card p-8 text-center text-sm text-muted-foreground">Selecione um ticket para visualizar {admin ? 'e responder.' : 'as respostas do atendimento.'}</section>}
      </div>
    </div>
  )
}

function TicketConversation({ protocol, admin, onUpdated }: { protocol: number; admin: boolean; onUpdated: (ticket: Ticket) => void }) {
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [replies, setReplies] = useState<TicketReply[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    async function read() {
      try {
        const response = await fetch(`/tickets/${protocol}`, { cache: 'no-store', signal: controller.signal })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error)
        setTicket(result.ticket); setReplies(result.replies)
      } catch {
        if (!controller.signal.aborted) setError('Não foi possível carregar o ticket. Selecione outro ticket e tente novamente.')
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void read()
    return () => controller.abort()
  }, [protocol])

  async function mutate(kind: 'reply' | 'finish' | 'reopen' | 'start', finish = false) {
    setSaving(true); setError(''); setNotice('')
    try {
      const result = kind === 'reply' ? await answerTicket(protocol, message, finish)
        : await changeTicketStatus(protocol, kind === 'finish' ? 'finalizado' : kind === 'start' ? 'em_atendimento' : 'aberto')
      if (result.error) { setError(result.error); return }
      if (kind === 'reply') setMessage('')
      setNotice(kind === 'reply' ? 'Resposta registrada. O usuário pode consultá-la em Meus tickets.' : kind === 'finish' ? 'Ticket finalizado.' : kind === 'start' ? 'Ticket em atendimento.' : 'Ticket reaberto.')
      const response = await fetch(`/tickets/${protocol}`, { cache: 'no-store' })
      const details = await response.json()
      if (!response.ok) throw new Error()
      setTicket(details.ticket); setReplies(details.replies); onUpdated(details.ticket)
    } catch { setError('Não foi possível concluir a operação ou atualizar o histórico. Consulte o ticket novamente antes de reenviar.') }
    finally { setSaving(false) }
  }

  if (loading) return <section className="rounded-3xl border bg-card p-8" aria-busy>Carregando ticket...</section>
  if (!ticket) return <p role="alert" className="rounded-3xl border p-6 text-destructive">{error}</p>
  return (
    <section className="space-y-5 rounded-3xl border bg-card p-5 sm:p-7">
      <header className="space-y-2"><Badge className={statusStyle[ticket.status]}>{TICKET_LABELS[ticket.status]}</Badge><h2 className="break-words text-xl font-medium">#{ticket.protocol_number} · {ticket.subject}</h2>
        {admin && <p className="break-words text-sm text-muted-foreground">{ticket.user_name || 'Usuário'} · {ticket.user_email || 'E-mail não informado'}</p>}
        <p className="text-xs text-muted-foreground">Criado em {dateLabel(ticket.created_at)}{ticket.closed_at ? ` • Finalizado em ${dateLabel(ticket.closed_at)}` : ''}</p>
      </header>
      <article className="rounded-2xl bg-muted p-4"><p className="mb-2 text-xs font-medium">Mensagem do usuário</p><p className="whitespace-pre-wrap break-words text-sm">{ticket.message}</p></article>
      <div className="space-y-3" aria-label="Histórico de respostas">
        {replies.length === 0 && <p className="text-sm text-muted-foreground">Ainda não há respostas.</p>}
        {replies.map((reply) => <article key={reply.id} className="rounded-2xl bg-secondary p-4"><p className="mb-2 text-xs font-medium text-secondary-foreground">Atendimento · {dateLabel(reply.created_at)}</p><p className="whitespace-pre-wrap break-words text-sm text-secondary-foreground">{reply.message}</p></article>)}
      </div>
      {admin && ticket.status === 'aberto' && <Button variant="outline" disabled={saving} onClick={() => mutate('start')}>Iniciar atendimento</Button>}
      {admin && ticket.status !== 'finalizado' && <div className="space-y-3 border-t pt-4"><Label htmlFor="ticket-answer">Responder ao usuário</Label><Textarea id="ticket-answer" rows={5} maxLength={10000} value={message} onChange={(event) => setMessage(event.target.value)} disabled={saving} placeholder="Escreva a orientação ou solução para este ticket." />
        <div className="flex flex-wrap gap-2"><Button onClick={() => mutate('reply')} disabled={saving || !message.trim()}>Enviar resposta</Button><Button variant="secondary" onClick={() => mutate('reply', true)} disabled={saving || !message.trim()}>Responder e finalizar</Button><Button variant="outline" onClick={() => mutate('finish')} disabled={saving}>Finalizar ticket</Button></div>
      </div>}
      {admin && ticket.status === 'finalizado' && <Button variant="outline" disabled={saving} onClick={() => mutate('reopen')}>Reabrir ticket</Button>}
      {saving && <p role="status" className="text-sm text-muted-foreground">Salvando...</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
    </section>
  )
}
