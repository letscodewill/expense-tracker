'use client'

import { useCurrency } from '@/lib/use-currency'
import { useLanguage } from '@/components/language-provider'
import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import type { MonthYear } from '@/components/month-year-picker'
import type { ExpenseSearchResult } from '@/lib/expense-search'
import { useCategories } from '@/lib/use-categories'


export function QuickExpenseSearch({ onNavigate }: { onNavigate: (period: MonthYear) => void }) {
  const { t, locale } = useLanguage()
  const currency = useCurrency()
  const monthLabel = (month: number, year: number) => new Date(year, month, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  const dateLabel = (value: string) => new Date(value + 'T12:00:00').toLocaleDateString(locale)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [category, setCategory] = useState('')
  const { categories, loading: categoriesLoading, error: categoriesError } = useCategories()
  const [results, setResults] = useState<ExpenseSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    if (!open || (!query.trim() && !start && !end && !category)) return () => controller.abort()
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query.trim(), start, end, category })
        const response = await fetch(`/api/expenses/search?${params}`, { cache: 'no-store', signal: controller.signal })
        const data = await response.json()
        if (controller.signal.aborted) return
        if (!response.ok) throw new Error(data.error)
        setResults(data.results); setHasMore(data.hasMore); setSearched(true)
      } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Não foi possível pesquisar.") }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [open, query, start, end, category])
  function changeFilters(next: { query?: string; start?: string; end?: string; category?: string }) {
    const values = { query, start, end, category, ...next }
    setQuery(values.query); setStart(values.start); setEnd(values.end); setCategory(values.category)
    setResults([]); setHasMore(false); setSearched(false); setError('')
    setLoading(!!(values.query.trim() || values.start || values.end || values.category))
  }
  function changeQuery(value: string) {
    changeFilters({ query: value })
  }
  function reset() { changeFilters({ query: '', start: '', end: '', category: '' }) }
  return <Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) reset() }}>
    <DialogTrigger render={<Button variant="outline" size="icon" aria-label={t("Pesquisar dívidas")} title={t("Pesquisar dívidas")}><Search className="size-5" /></Button>} />
    <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>{t("Pesquisar dívidas")}</DialogTitle><DialogDescription>{t("Busque por nome, valor, data de pagamento ou categoria em todos os meses. Combine os filtros para refinar os resultados.")}</DialogDescription></DialogHeader>
      <Input aria-label={t("Nome ou valor da dívida")} placeholder={t("Digite o nome ou valor…")} value={query} maxLength={100} onChange={event => changeQuery(event.target.value)} />
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="min-w-0 space-y-1 text-sm">{t("Pagamento a partir de")}<Input type="date" className="min-w-0 w-full" value={start} onChange={event => changeFilters({ start: event.target.value })} /></label>
        <label className="min-w-0 space-y-1 text-sm">{t("Pagamento até")}<Input type="date" className="min-w-0 w-full" value={end} onChange={event => changeFilters({ end: event.target.value })} /></label>
        <label className="min-w-0 space-y-1 text-sm sm:col-span-2">{t("Categoria")}<select className="h-10 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-foreground" value={category} disabled={categoriesLoading || !!categoriesError} onChange={event => changeFilters({ category: event.target.value })}>
          <option value="">{t("Todas as categorias")}</option>
          {categories.map(name => <option key={name} value={name}>{name === 'Sem categoria' ? t(name) : name}</option>)}
        </select></label>
      </div>
      {categoriesError && <p role="alert" className="text-sm text-destructive">{t(categoriesError)}</p>}
      {(query || start || end || category) && <Button variant="ghost" size="sm" className="justify-self-start" onClick={reset}>{t("Limpar filtros")}</Button>}
      <div aria-live="polite" aria-busy={loading}>
        {loading && <p className="text-sm text-muted-foreground">{t("Pesquisando...")}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
        {!loading && searched && !results.length && <p className="text-sm text-muted-foreground">{t("Nenhuma dívida encontrada.")}</p>}
        {results.length > 0 && <p className="mb-3 text-xs text-muted-foreground">{hasMore ? t("Mostrando os 50 resultados mais recentes. Refine a busca.") : t('{count} dívida(s) encontrada(s).', { count: results.length })}</p>}
        <ul className="max-h-[55dvh] space-y-3 overflow-y-auto">
          {results.map(row => {
            const [year, month] = row.data_pagamento.split('-').map(Number)
            const period = { year, month: month - 1 }
            const mismatched = row.board_month !== null && (row.board_month !== period.month || row.board_year !== period.year)
            return <li key={row.id} className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2"><p className="min-w-0 break-words font-medium">{row.nome}</p><p className="font-medium text-primary">{Number(row.valor).toLocaleString(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })}</p></div>
              <p className="mt-2 break-words text-sm">{row.board_id === null ? t(row.board_name) : row.board_name} · {monthLabel(period.month, period.year)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("Pagamento: ")}{dateLabel(row.data_pagamento)} · {t(row.status)}</p>
              {row.category && <p className="mt-1 break-words text-xs text-muted-foreground">{t("Categoria")}: {row.category === 'Sem categoria' ? t(row.category) : row.category}</p>}
              {mismatched ? <p className="mt-2 text-xs text-destructive">{t("O quadro está em ")}{monthLabel(row.board_month!, row.board_year!)}{t(" e a data de pagamento está em outro mês.")}</p> : <Button variant="ghost" size="sm" className="mt-2" onClick={() => { onNavigate(period); setOpen(false); reset() }}>{t("Ver mês no painel")}</Button>}
            </li>
          })}
        </ul>
      </div>
    </DialogContent>
  </Dialog>
}
