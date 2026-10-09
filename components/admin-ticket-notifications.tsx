'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type TicketNotice = { open: number; inProgress: number; latest: { protocol_number: number; subject: string } | null }

export function AdminTicketNotifications() {
  const [data, setData] = useState<TicketNotice | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState(false)
  const previous = useRef<number | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    let busy = false, denied = false
    async function refresh() {
      if (busy || denied || controller.signal.aborted || document.visibilityState !== 'visible') return
      busy = true
      try {
        const response = await fetch('/api/admin/notifications', { cache: 'no-store', signal: controller.signal })
        if (response.status === 401 || response.status === 403) { denied = true; setData(null); setNotice(''); return }
        if (!response.ok) throw new Error('Falha ao consultar os chamados.')
        const result: TicketNotice = await response.json()
        if (controller.signal.aborted) return
        const latest = result.latest?.protocol_number ?? 0
        if (previous.current !== null && latest > previous.current) setNotice(`Novo chamado #${latest}: ${result.latest?.subject ?? ''}`)
        previous.current = latest
        setData(result); setError(false)
      } catch { if (!controller.signal.aborted) setError(true) }
      finally { busy = false }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 60000)
    const resume = () => void refresh()
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('focus', resume)
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', resume); window.removeEventListener('focus', resume) }
  }, [])
  const pending = data ? data.open + data.inProgress : 0
  return <div className="relative shrink-0">
    <a href="/admin/tickets" aria-label={error ? 'Avisos indisponíveis. Abrir painel de tickets' : `${pending} chamados pendentes. Abrir painel de tickets`} title={error ? 'Não foi possível atualizar os avisos' : 'Chamados pendentes'} className="relative flex size-11 items-center justify-center rounded-xl hover:bg-accent">
      <Bell className="size-5" aria-hidden="true" />
      {pending > 0 && <span className="absolute right-0 top-0 min-w-5 rounded-full bg-primary px-1 text-center text-xs leading-5 text-primary-foreground">{pending > 99 ? '99+' : pending}</span>}
      {error && <span className="absolute right-1 top-1 size-2 rounded-full bg-amber-500" />}
    </a>
    {notice && <div role="status" className="fixed inset-x-4 top-4 z-40 mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-primary/30 bg-card p-4 shadow-lg">
      <Bell className="size-5 shrink-0 text-primary" aria-hidden="true" /><a href="/admin/tickets" className="min-w-0 flex-1 break-words text-sm font-medium text-primary">{notice}</a>
      <Button variant="ghost" size="icon-sm" aria-label="Dispensar aviso" onClick={() => setNotice('')}><X className="size-4" /></Button>
    </div>}
  </div>
}
