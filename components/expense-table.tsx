'use client'

import { useLanguage } from '@/components/language-provider'
import { useEffect, useState, useCallback, useTransition, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AddExpenseDialog } from '@/components/add-expense-dialog'
import type { MonthYear } from '@/components/month-year-picker'
import { Pencil, Check, X, ChevronsUpDown, Clock, CreditCard } from 'lucide-react'
import { MaskedValue } from '@/components/masked-value'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'

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
  recurring_group_id: string | null
  recurring_number: number | null
  category?: string
}

const statusColor: Record<Expense['status'], string> = {
  Pendente: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  Pago: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  'VR/VA': 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200',
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

function isRecurringRow(e: Expense): boolean {
  return e.recurring_group_id != null && e.recurring_number != null
}

export type ExpenseTableProps = {
  boardId: string | null
  title: string
  selected: MonthYear
  onDeleteBoard?: () => void
  onChanged?: () => void
  refreshKey?: number
  defaultOpen?: boolean
}

export function ExpenseTable({
  boardId,
  title,
  selected,
  onDeleteBoard,
  onChanged,
  refreshKey,
  defaultOpen = true,
}: ExpenseTableProps) {
  const { t, locale } = useLanguage()

  const supabase = createClient()
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [focused, setFocused] = useState(false)
  const boardTriggerRef = useRef<HTMLButtonElement>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [isPending, startTransition] = useTransition()
  const [renamingBoard, setRenamingBoard] = useState(false)
  const [boardNameDraft, setBoardNameDraft] = useState(title)
  const [renamingBoardError, setRenamingBoardError] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [payingExpenseId, setPayingExpenseId] = useState<Expense['id'] | null>(null)

  const fetchExpenses = useCallback(
    async function loadExpenses(month: number, year: number, attempt = 0) {
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

        const MAX_ATTEMPTS = 3
        if (attempt + 1 < MAX_ATTEMPTS) {
          await delay(1000 * (attempt + 1))
          return loadExpenses(month, year, attempt + 1)
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
      const confirmed = window.confirm(t("Excluir esta despesa? Essa ação não pode ser desfeita."))
      if (!confirmed) return

      const { error } = await supabase.from('expenses').delete().eq('id', expense.id)
      if (!error) {
        handleChanged()
      }
    },
    [supabase, handleChanged, t]
  )

  const handleDeleteRecurringFromHere = useCallback(
    async (expense: Expense) => {
      if (!expense.recurring_group_id || expense.recurring_number == null) return
      const confirmed = window.confirm(
        t("Excluir esta e as próximas ocorrências desta despesa recorrente? Essa ação não pode ser desfeita.")
      )
      if (!confirmed) return

      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('recurring_group_id', expense.recurring_group_id)
        .gte('recurring_number', expense.recurring_number)

      if (!error) {
        handleChanged()
      }
    },
    [supabase, handleChanged, t]
  )

  const handleDeleteEntireSeries = useCallback(
    async (expense: Expense) => {
      if (!expense.installment_group_id) return
      const confirmed = window.confirm(
        t('Excluir TODAS as {count} parcelas desta compra? Essa ação não pode ser desfeita.', { count: expense.installment_total ?? 0 })
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
    [supabase, handleChanged, t]
  )

  const handleTogglePaid = useCallback(
    async (expense: Expense) => {
      const newStatus = expense.status === 'Pago' ? 'Pendente' : 'Pago'
      setPaymentError('')
      setPayingExpenseId(expense.id)
      try {
        const { data, error } = await supabase
          .from('expenses')
          .update({ status: newStatus })
          .eq('id', expense.id)
          .select('id')
        if (error || !data?.length) {
          setPaymentError('Não foi possível atualizar o pagamento. Tente novamente.')
          return
        }
        handleChanged()
      } catch {
        setPaymentError('Não foi possível atualizar o pagamento. Tente novamente.')
      } finally { setPayingExpenseId(null) }
    },
    [supabase, handleChanged]
  )

  const handleRenameBoard = useCallback(async () => {
    if (!boardId) return
    const trimmed = boardNameDraft.trim()
    if (!trimmed) {
      setRenamingBoardError('Informe um nome para o quadro.')
      return
    }
    if (trimmed === title) {
      setRenamingBoard(false)
      setRenamingBoardError('')
      return
    }

    const { error } = await supabase
      .from('boards')
      .update({ name: trimmed })
      .eq('id', boardId)

    if (error) {
      console.error('Erro ao renomear quadro:', error)
      setRenamingBoardError('Não foi possível renomear. Tente novamente.')
      return
    }

    setRenamingBoard(false)
    setRenamingBoardError('')
    onChanged?.()
  }, [boardId, boardNameDraft, title, supabase, onChanged])

  const total = expenses.reduce((sum, e) => sum + e.valor, 0)
  const pendente = expenses.reduce(
    (sum, e) => sum + (e.status === 'Pendente' ? e.valor : 0),
    0
  )
  const selectedLabel = new Date(selected.year, selected.month, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' })

  const renderBoard = (inModal = false) => (
    <div className="material-board min-w-0 space-y-3 rounded-2xl border p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
        <div className="flex flex-1 items-center gap-2 min-w-0">
          {!inModal && <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={() => setIsOpen((open) => !open)}
            aria-expanded={isOpen}
            aria-label={t("Alternar exibição do quadro")}
          >
            <ChevronsUpDown className="h-4 w-4" />
            <span className="sr-only">{t("Alternar exibição do quadro")}</span>
          </Button>}

          {boardId && renamingBoard ? (
            <div className="flex items-center gap-2 min-w-0">
              <Input
                value={boardNameDraft}
                onChange={(e) => {
                  setBoardNameDraft(e.target.value)
                  setRenamingBoardError('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleRenameBoard()
                  if (e.key === 'Escape') {
                    setRenamingBoard(false)
                    setBoardNameDraft(title)
                    setRenamingBoardError('')
                  }
                }}
                autoFocus
                className="h-9 max-w-xs text-lg font-semibold"
                placeholder={t("Nome do quadro")}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleRenameBoard()}
                aria-label={t("Salvar nome")}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRenamingBoard(false)
                  setBoardNameDraft(title)
                  setRenamingBoardError('')
                }}
                aria-label={t("Cancelar")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <h2 className="min-w-0 flex-1 text-lg font-medium tracking-tight">
                {inModal ? <span className="block truncate">{boardId ? title : t(title)}</span> : (
                  <button
                    ref={boardTriggerRef}
                    type="button"
                    className="block w-full cursor-pointer truncate rounded-md py-2 text-left transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                    aria-haspopup="dialog"
                    onClick={() => setFocused(true)}
                  >{boardId ? title : t(title)}</button>
                )}
              </h2>
              {boardId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setBoardNameDraft(title)
                    setRenamingBoardError('')
                    setRenamingBoard(true)
                  }}
                  aria-label={t("Renomear quadro")}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {renamingBoardError && (
            <p className="text-sm text-red-600">{t(renamingBoardError)}</p>
          )}
          {onDeleteBoard && (
            <Button variant="destructive" size="sm" onClick={onDeleteBoard}>{t("Excluir quadro")}</Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap justify-between gap-x-8 gap-y-2 rounded-xl bg-muted/50 px-3 py-3" aria-label={t("Resumo das despesas")}>
        {loading || isPending ? <p className="text-sm text-muted-foreground">{t("Carregando totais...")}</p>
          : fetchError ? <p className="text-sm text-destructive">{t("Totais indisponíveis. Expanda o quadro para tentar novamente.")}</p>
          : <>
            <div><p className="text-xs text-muted-foreground">{t("Total")}</p><p className="text-lg font-medium tabular-nums sm:text-xl"><MaskedValue value={total} /></p></div>
            <div><p className="text-xs text-muted-foreground">{t("Restante a pagar")}</p><p className="text-lg font-medium tabular-nums text-primary sm:text-xl"><MaskedValue value={pendente} /></p></div>
          </>}
      </div>

      {paymentError && <p role="alert" className="text-sm text-destructive">{t(paymentError)}</p>}
      {(inModal || (!focused && isOpen)) && <div className="space-y-4">
        <div className="material-table expense-list rounded-xl border">
          {loading || isPending ? (
            <p className="text-sm text-muted-foreground p-4">{t("Carregando...")}</p>
          ) : fetchError ? (
            <div className="p-4 text-center space-y-2">
              <p className="text-sm text-red-600">{t("Não foi possível carregar as despesas.")}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchExpenses(selected.month, selected.year)}
              >{t("Tentar novamente")}</Button>
            </div>
          ) : expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">{t("Nenhuma despesa em ")}{selectedLabel}.
            </p>
          ) : (
            <div className="expense-table-wrapper min-w-0 lg:overflow-x-auto">
              <Table>
                <TableHeader className="hidden lg:table-header-group">
                  <TableRow>
                    <TableHead>{t("Nome")}</TableHead>
                    <TableHead>{t("Data")}</TableHead>
                    <TableHead>{t("Valor")}</TableHead>
                    <TableHead>{t("Status")}</TableHead>
                    <TableHead>{t("Comentário")}</TableHead>
                    <TableHead>{t("Categoria")}</TableHead>
                    <TableHead className="w-[180px]">{t("Ações")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => {
                    const instLabel = installmentLabel(expense)
                    return (
                      <TableRow key={expense.id} className="group expense-row grid grid-cols-2 items-start gap-x-2 py-3 lg:table-row lg:py-0">
                        <TableCell className="expense-name col-span-2 min-w-0 lg:table-cell">
                          <span className="flex flex-wrap items-center gap-2 break-words">
                            <span>{expense.nome}</span>
                            {instLabel && (
                              <Badge variant="secondary" className="font-normal">
                                {instLabel}
                              </Badge>
                            )}
                            {isRecurringRow(expense) && (
                              <Badge variant="secondary" className="font-normal">{t("Recorrente")}</Badge>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="expense-date text-xs text-muted-foreground lg:table-cell">
                          <span className="sr-only lg:hidden">{t("Pagamento:")}</span>{parseISODate(expense.data_pagamento).toLocaleDateString(locale, {
                            timeZone: 'UTC',
                          })}
                        </TableCell>
                        <TableCell className="expense-value text-right font-medium tabular-nums lg:table-cell lg:text-left">
                          <MaskedValue value={expense.valor} />
                        </TableCell>
                        <TableCell className="expense-status lg:table-cell">
                          <Badge className={statusColor[expense.status]}>{expense.status === 'Pago' ? <Check className="mr-1 size-3" aria-hidden="true" /> : expense.status === 'VR/VA' ? <CreditCard className="mr-1 size-3" aria-hidden="true" /> : <Clock className="mr-1 size-3" aria-hidden="true" />}{t(expense.status)}</Badge>
                        </TableCell>
                        <TableCell className="expense-comment col-span-2 break-words text-xs text-muted-foreground lg:table-cell">{expense.comentario}</TableCell>
                        <TableCell className="expense-category text-right text-xs text-muted-foreground lg:text-left">{!expense.category || expense.category === 'Sem categoria' ? t('Sem categoria') : expense.category}</TableCell>
                        <TableCell className="expense-actions col-span-2 lg:table-cell">
                          <div className="flex flex-col gap-1 md:opacity-70 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
                            <div className="flex flex-wrap gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className={expense.status === 'Pago' ? 'text-yellow-600 hover:text-yellow-700' : 'text-green-600 hover:text-green-700'}
                                onClick={() => handleTogglePaid(expense)}
                                disabled={payingExpenseId !== null}
                                title={expense.status === 'Pago' ? t("Marcar como pendente") : t("Marcar como pago")}
                              >
                                {expense.status === 'Pago' ? t('Desfazer') : t('Pagar')}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setEditingExpense(expense)}>{t("Editar")}</Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteExpense(expense)}
                              >{t("Excluir")}</Button>
                            </div>
                            {isInstallmentRow(expense) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 justify-start px-2"
                                onClick={() => handleDeleteEntireSeries(expense)}
                              >{t("Excluir série completa")}</Button>
                            )}
                            {isRecurringRow(expense) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 justify-start px-2"
                                onClick={() => handleDeleteRecurringFromHere(expense)}
                              >{t("Excluir esta e as próximas")}</Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>}

      {editingExpense && (inModal || !focused) && (
        <AddExpenseDialog
          selected={selected}
          boardId={boardId}
          hideTrigger
          boardName={boardId ? title : null}
          expenseToEdit={editingExpense}
          onAdded={handleChanged}
          onOpenChange={(open) => !open && setEditingExpense(null)}
        />
      )}
    </div>
  )

  return (
    <Dialog open={focused} onOpenChange={setFocused}>
      {!focused && renderBoard()}
      <DialogContent
        className="max-h-[90dvh] w-[96vw] max-w-[96vw] gap-0 overflow-hidden rounded-2xl p-3 pt-14 sm:w-[90vw] sm:max-w-[90vw] sm:p-5 sm:pt-14 [&>[data-slot=dialog-close]]:top-1 [&>[data-slot=dialog-close]]:right-3 [&>[data-slot=dialog-close]]:z-10 [&>[data-slot=dialog-close]]:pb-2"
        finalFocus={boardTriggerRef}
      >
        <DialogTitle className="sr-only">{boardId ? title : t(title)}</DialogTitle>
        <DialogDescription className="sr-only">{selectedLabel}</DialogDescription>
        <div className="min-h-0 min-w-0 max-h-[calc(90dvh-4.25rem)] overflow-y-auto overscroll-contain pr-2 sm:max-h-[calc(90dvh-4.75rem)] sm:pr-3 [scrollbar-gutter:stable]">
          {focused && renderBoard(true)}
        </div>
      </DialogContent>
    </Dialog>
  )
}
