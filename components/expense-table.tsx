'use client'

import { useEffect, useState, useCallback, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AddExpenseDialog } from '@/components/add-expense-dialog'
import { MONTH_NAMES_PT, type MonthYear } from '@/components/month-year-picker'

type Expense = {
  id: number
  nome: string
  data_pagamento: string
  valor: number
  status: 'Pendente' | 'Pago' | 'VR/VA'
  comentario: string | null
  installment_group_id: string | null
  installment_number: number | null
  installment_total: number | null
  valor_total: number | null
}

const statusColor: Record<Expense['status'], string> = {
  Pendente: 'bg-yellow-500',
  Pago: 'bg-green-500',
  'VR/VA': 'bg-blue-500',
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function monthRangeISO(month: number, year: number): { from: string; to: string } {
  const from = new Date(Date.UTC(year, month, 1))
  const to = new Date(Date.UTC(year, month + 1, 1))
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { from: fmt(from), to: fmt(to) }
}

function isInstallmentRow(e: Expense): boolean {
  return e.installment_group_id != null && e.installment_number != null && e.installment_total != null
}

function installmentLabel(e: Expense): string | null {
  if (!isInstallmentRow(e)) return null
  return '(' + e.installment_number + '/' + e.installment_total + ')'
}

export type ExpenseTableProps = {
  boardId: string | null
  title: string
  selected: MonthYear
  onDeleteBoard?: () => void
  onChanged?: () => void
  refreshKey?: number
}

export function ExpenseTable({
  boardId,
  title,
  selected,
  onDeleteBoard,
  onChanged,
  refreshKey,
}: ExpenseTableProps) {
  const supabase = createClient()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [isPending, startTransition] = useTransition()

  const fetchExpenses = useCallback(
    async (month: number, year: number, attempt = 0) => {
      if (attempt === 0) {
        setLoading(true)
        setFetchError(false)
      }

      const { from, to } = monthRangeISO(month, year)

      let query = supabase
        .from('expenses')
        .select('*')
        .gte('data_pagamento', from)
        .lt('data_pagamento', to)
        .order('data_pagamento', { ascending: true })

      query = boardId ? query.eq('board_id', boardId) : query.is('board_id', null)

      const { data, error } = await query

      if (error) {
        console.error(`Erro ao buscar despesas (tentativa ${attempt + 1}):`, error)

        const MAX_ATTEMPTS = 3 // 1 tentativa inicial + 2 retries automáticos
        if (attempt + 1 < MAX_ATTEMPTS) {
          await delay(1000 * (attempt + 1)) // 1s, depois 2s
          return fetchExpenses(month, year, attempt + 1)
        }

        setFetchError(true)
        setLoading(false)
        return
      }

      if (data) setExpenses(data)
      setFetchError(false)
      setLoading(false)
    },
    [supabase, boardId]
  )

  useEffect(() => {
    startTransition(() => {
      fetchExpenses(selected.month, selected.year)
    })
  }, [selected.month, selected.year, fetchExpenses, refreshKey])

  const handleChanged = useCallback(() => {
    fetchExpenses(selected.month, selected.year)
    onChanged?.()
  }, [fetchExpenses, selected.month, selected.year, onChanged])

  const handleDeleteExpense = useCallback(
    async (expense: Expense) => {
      const confirmed = window.confirm('Excluir esta despesa? Essa ação não pode ser desfeita.')
      if (!confirmed) return

      const { error } = await supabase.from('expenses').delete().eq('id', expense.id)
      if (!error) {
        handleChanged()
      }
    },
    [supabase, handleChanged]
  )

  const handleDeleteEntireSeries = useCallback(
    async (expense: Expense) => {
      if (!expense.installment_group_id) return
      const confirmed = window.confirm(
        'Excluir TODAS as ' +
          expense.installment_total +
          ' parcelas desta compra? Essa ação não pode ser desfeita.'
      )
      if (!confirmed) return

      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('installment_group_id', expense.installment_group_id)
      if (!error) {
        handleChanged()
      }
    },
    [supabase, handleChanged]
  )

  const total = expenses.reduce((sum, e) => sum + e.valor, 0)
  const pendente = expenses.reduce(
    (sum, e) => sum + (e.status !== 'Pago' ? e.valor : 0),
    0
  )
  const selectedLabel = MONTH_NAMES_PT[selected.month] + ' de ' + selected.year

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-2">
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          <AddExpenseDialog boardId={boardId} onAdded={handleChanged} />
          {onDeleteBoard && (
            <Button variant="destructive" size="sm" onClick={onDeleteBoard}>
              Excluir quadro
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border">
        {loading || isPending ? (
          <p className="text-sm text-muted-foreground p-4">Carregando...</p>
        ) : fetchError ? (
          <div className="p-4 text-center space-y-2">
            <p className="text-sm text-red-600">Não foi possível carregar as despesas.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchExpenses(selected.month, selected.year)}
            >
              Tentar novamente
            </Button>
          </div>
        ) : expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4">
            Nenhuma despesa em {selectedLabel}.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Comentário</TableHead>
                <TableHead className="w-[180px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => {
                const instLabel = installmentLabel(expense)
                return (
                  <TableRow key={expense.id}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <span>{expense.nome}</span>
                        {instLabel && (
                          <Badge variant="secondary" className="font-normal">
                            {instLabel}
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      {parseISODate(expense.data_pagamento).toLocaleDateString('pt-BR', {
                        timeZone: 'UTC',
                      })}
                    </TableCell>
                    <TableCell>
                      {expense.valor.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColor[expense.status]}>{expense.status}</Badge>
                    </TableCell>
                    <TableCell>{expense.comentario}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setEditingExpense(expense)}>
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteExpense(expense)}
                          >
                            Excluir
                          </Button>
                        </div>
                        {isInstallmentRow(expense) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 justify-start px-2"
                            onClick={() => handleDeleteEntireSeries(expense)}
                          >
                            Excluir série completa
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>Total</TableCell>
                <TableCell>
                  {total.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </TableCell>
                <TableCell colSpan={3}></TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>Pendente de pagamento</TableCell>
                <TableCell>
                  {pendente.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </TableCell>
                <TableCell colSpan={3}></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </div>

      {editingExpense && (
        <AddExpenseDialog
          boardId={boardId}
          expenseToEdit={editingExpense}
          onAdded={handleChanged}
          onOpenChange={(open) => !open && setEditingExpense(null)}
        />
      )}
    </div>
  )
}