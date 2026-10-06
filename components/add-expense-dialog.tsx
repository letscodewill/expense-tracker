'use client'

import { z } from 'zod'
import { useReducer, useState, useMemo, useRef } from 'react'
import { checkExpenseDuplicates, type DuplicateWarning } from '@/lib/expense-duplicates'
import { DuplicateExpenseNotice } from '@/components/duplicate-expense-notice'
import { createClient } from '@/lib/supabase/client'
import { safeGetUser } from '@/lib/supabase/safe-get-user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus } from 'lucide-react'
import type { MonthYear } from '@/components/month-year-picker'

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
}

const MIN_INSTALLMENTS = 2
const MAX_INSTALLMENTS = 48
const RECURRING_OPTIONS = ['3', '6', '9', '12']

const MONTH_NAMES_PT = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]

const expenseSchema = z
  .object({
    nome: z.string().trim().min(1, { message: 'Informe o nome da despesa.' }),
    dataPagamento: z.string().min(1, { message: 'Informe a data de pagamento.' }),
    valor: z
      .string()
      .refine(
        (val) => {
          const n = parseFloat(val.replace(',', '.'))
          return !isNaN(n) && n > 0
        },
        { message: 'Informe um valor válido maior que zero.' }
      ),
    isInstallment: z.boolean(),
    installments: z.string(),
    isRecurring: z.boolean(),
    recurringMonths: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.isInstallment) {
      const n = parseInt(data.installments, 10)
      if (!Number.isInteger(n) || n < MIN_INSTALLMENTS || n > MAX_INSTALLMENTS) {
        ctx.addIssue({
          path: ['installments'],
          code: z.ZodIssueCode.custom,
          message: 'Informe um número de parcelas entre ' + MIN_INSTALLMENTS + ' e ' + MAX_INSTALLMENTS + '.',
        })
      }
    }
    if (data.isRecurring && !RECURRING_OPTIONS.includes(data.recurringMonths)) {
      ctx.addIssue({
        path: ['recurringMonths'],
        code: z.ZodIssueCode.custom,
        message: 'Selecione por quantos meses a despesa deve se repetir.',
      })
    }
  })

const initialState = {
  nome: '',
  dataPagamento: '',
  valor: '',
  status: 'Pendente',
  comentario: '',
  isInstallment: false,
  installments: '2',
  isRecurring: false,
  recurringMonths: '3',
  error: '',
  fieldErrors: {} as Record<string, string>,
}

type State = typeof initialState

type Action =
  | { type: 'SET_FIELD'; field: keyof Omit<State, 'fieldErrors' | 'error'>; value: string | boolean }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'RESET' }
  | { type: 'SET_FIELD_ERRORS'; errors: Record<string, string> }

function formReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value, error: '', fieldErrors: {} }
    case 'SET_ERROR':
      return { ...state, error: action.error, fieldErrors: {} }
    case 'RESET':
      return initialState
    case 'SET_FIELD_ERRORS':
      return { ...state, fieldErrors: action.errors, error: '' }
    default:
      return state
  }
}

type AddExpenseDialogProps = {
  onAdded: () => void
  expenseToEdit?: Expense | null
  onOpenChange?: (open: boolean) => void
  boardId?: string | null
  boardName?: string | null
  selected?: MonthYear
  forceOpen?: boolean
} & React.ComponentProps<typeof Dialog>

function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(y, m - 1 + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  const day = Math.min(d, lastDay)
  const out = new Date(Date.UTC(target.getFullYear(), target.getMonth(), day))
  return out.toISOString().slice(0, 10)
}

function formatBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

async function getOrCreateBoardForMonth(
  supabase: ReturnType<typeof createClient>,
  userId: string | undefined,
  name: string,
  month: number,
  year: number
): Promise<string> {
  const { data: existing, error: findError } = await supabase
    .from('boards')
    .select('id')
    .eq('name', name)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()

  if (findError) {
    console.error('Erro ao buscar quadro existente:', findError)
  }

  if (existing) return existing.id

  const { data: created, error: createError } = await supabase
    .from('boards')
    .insert({ name, user_id: userId, month, year })
    .select('id')
    .single()

  if (createError || !created) {
    throw createError ?? new Error('Falha ao criar quadro para o mês.')
  }

  return created.id
}

export function AddExpenseDialog({
  onAdded,
  expenseToEdit,
  onOpenChange,
  boardId = null,
  boardName = null,
  selected,
  forceOpen,
  ...props
}: AddExpenseDialogProps) {
  const [formState, dispatch] = useReducer(formReducer, initialState)
  const {
    nome, dataPagamento, valor, status, comentario,
    isInstallment, installments, isRecurring, recurringMonths,
    error, fieldErrors,
  } = formState

  const supabase = createClient()

  const [open, setOpen] = useState(!!expenseToEdit || !!forceOpen)
  const [loading, setLoading] = useState(false)
  const inFlight = useRef(false)
  const [duplicateReview, setDuplicateReview] = useState<{ key: string; draft: string; warnings: DuplicateWarning[] } | null>(null)
  const [acceptedDuplicates, setAcceptedDuplicates] = useState('')
  const draftKey = JSON.stringify([nome, dataPagamento, valor, status, comentario, isInstallment, installments, isRecurring, recurringMonths, boardId, selected, expenseToEdit?.id])
  const [previousExpense, setPreviousExpense] = useState<Expense | null | undefined>(undefined)
  const [previousForceOpen, setPreviousForceOpen] = useState(forceOpen)

  // Adjust the form before committing a changed editing target, without an effect.
  if (expenseToEdit !== previousExpense || forceOpen !== previousForceOpen) {
    setPreviousExpense(expenseToEdit)
    setPreviousForceOpen(forceOpen)
    setOpen(!!expenseToEdit || !!forceOpen)
    if (expenseToEdit) {
      dispatch({ type: 'SET_FIELD', field: 'nome', value: expenseToEdit.nome })
      dispatch({ type: 'SET_FIELD', field: 'dataPagamento', value: expenseToEdit.data_pagamento })
      dispatch({ type: 'SET_FIELD', field: 'valor', value: String(expenseToEdit.valor) })
      dispatch({ type: 'SET_FIELD', field: 'status', value: expenseToEdit.status })
      dispatch({ type: 'SET_FIELD', field: 'comentario', value: expenseToEdit.comentario ?? '' })
    }
  }

  const preview = useMemo(() => {
    if (!isInstallment || !dataPagamento) return null
    const n = parseInt(installments, 10)
    if (!Number.isInteger(n) || n < MIN_INSTALLMENTS || n > MAX_INSTALLMENTS) return null
    const total = parseFloat(valor.replace(',', '.'))
    if (isNaN(total) || total <= 0) return null

    const baseCents = Math.floor((total * 100) / n)
    const remainder = Math.round(total * 100) - baseCents * n
    const installmentValues = Array.from({ length: n }, (_, i) =>
      (baseCents + (i < remainder ? 1 : 0)) / 100
    )
    const first = installmentValues[0]
    const lastDate = addMonthsISO(dataPagamento, n - 1)
    const lastDateLabel = (() => {
      const [y, m, d] = lastDate.split('-').map(Number)
      return d.toString().padStart(2, '0') + ' ' + MONTH_NAMES_PT[m - 1] + ' ' + y
    })()
    const firstDateLabel = (() => {
      const [y, m, d] = dataPagamento.split('-').map(Number)
      return d.toString().padStart(2, '0') + ' ' + MONTH_NAMES_PT[m - 1] + ' ' + y
    })()
    return { perInstallment: first, firstDateLabel, lastDateLabel, total, n }
  }, [isInstallment, dataPagamento, installments, valor])

  async function handleSubmit() {
    if (inFlight.current) return
    const result = expenseSchema.safeParse(formState)

    if (!result.success) {
      const errors: Record<string, string> = {}
      result.error.issues.forEach((issue) => {
        errors[issue.path[0] as string] = issue.message
      })
      dispatch({ type: 'SET_FIELD_ERRORS', errors })
      return
    }

    inFlight.current = true
    setLoading(true)
    dispatch({ type: 'SET_ERROR', error: '' })

    try {
    const user = await safeGetUser()
    if (!user) {
      dispatch({ type: 'SET_ERROR', error: 'Entre novamente para salvar a despesa.' })
      return
    }
    const totalValor = parseFloat(valor.replace(',', '.')) || 0
    const selectedStart = selected ? new Date(Date.UTC(selected.year, selected.month, 1)).toISOString().slice(0, 10) : null
    let recurringStart = dataPagamento
    if (!expenseToEdit && isRecurring && selected && selectedStart && recurringStart < selectedStart) {
      const [year, month] = recurringStart.split('-').map(Number)
      recurringStart = addMonthsISO(recurringStart, (selected.year - year) * 12 + selected.month - (month - 1))
    }
    const count = expenseToEdit ? 1 : isInstallment ? Number(installments) : isRecurring ? Number(recurringMonths) : 1
    const cents = Math.round(totalValor * 100)
    const candidates = Array.from({ length: count }, (_, index) => ({
      nome: nome.trim(),
      valor: !expenseToEdit && isInstallment ? (Math.floor(cents / count) + (index < cents % count ? 1 : 0)) / 100 : totalValor,
      data_pagamento: addMonthsISO(!expenseToEdit && isRecurring ? recurringStart : dataPagamento, index),
    }))
    const duplicates = await checkExpenseDuplicates(supabase, user.id, candidates, expenseToEdit?.id)
    const reviewKey = JSON.stringify([draftKey, duplicates])
    if (duplicates.length && acceptedDuplicates !== reviewKey) {
      setDuplicateReview({ key: reviewKey, draft: draftKey, warnings: duplicates })
      setAcceptedDuplicates('')
      return
    }

    if (expenseToEdit) {
      const { error: updateError } = await supabase
        .from('expenses')
        .update({
          nome: nome.trim(),
          data_pagamento: dataPagamento,
          valor: totalValor,
          status,
          comentario: comentario.trim() || null,
        })
        .eq('id', expenseToEdit.id)

      setLoading(false)

      if (updateError) {
        dispatch({ type: 'SET_ERROR', error: 'Não foi possível atualizar. Tente novamente.' })
        return
      }
    } else if (isInstallment) {
      const n = parseInt(installments, 10)
      const groupId = crypto.randomUUID()
      const totalCents = Math.round(totalValor * 100)
      const baseCents = Math.floor(totalCents / n)
      const remainder = totalCents - baseCents * n

      try {
        const rows = []
        for (let i = 0; i < n; i++) {
          const cents = baseCents + (i < remainder ? 1 : 0)
          const dataParcela = addMonthsISO(dataPagamento, i)

          let targetBoardId = boardId
          if (i > 0 && boardId && boardName) {
            const [y, m] = dataParcela.split('-').map(Number)
            targetBoardId = await getOrCreateBoardForMonth(supabase, user?.id, boardName, m - 1, y)
          }

          rows.push({
            nome: nome.trim(),
            data_pagamento: dataParcela,
            valor: cents / 100,
            status,
            comentario: comentario.trim() || null,
            user_id: user?.id,
            board_id: targetBoardId,
            installment_group_id: groupId,
            installment_number: i + 1,
            installment_total: n,
            valor_total: totalValor,
            recurring_group_id: null,
            recurring_number: null,
          })
        }

        const { error: insertError } = await supabase.from('expenses').insert(rows)
        setLoading(false)

        if (insertError) {
          console.error('Supabase insert (installments) error:', insertError)
          dispatch({
            type: 'SET_ERROR',
            error: 'Não foi possível salvar: ' + (insertError.message || 'erro desconhecido'),
          })
          return
        }
      } catch (err) {
        setLoading(false)
        console.error('Erro ao processar parcelas:', err)
        dispatch({ type: 'SET_ERROR', error: 'Não foi possível criar os quadros para as parcelas futuras.' })
        return
      }
    } else if (isRecurring) {
      const n = parseInt(recurringMonths, 10)
      const groupId = crypto.randomUUID()

      try {
        const rows = []
        for (let i = 0; i < n; i++) {
          const dataOcorrencia = addMonthsISO(recurringStart, i)

          let targetBoardId = boardId
          if (boardId && boardName && (i > 0 || (selected && dataOcorrencia.slice(0, 7) !== selectedStart!.slice(0, 7)))) {
            const [y, m] = dataOcorrencia.split('-').map(Number)
            targetBoardId = await getOrCreateBoardForMonth(supabase, user?.id, boardName, m - 1, y)
          }

          rows.push({
            nome: nome.trim(),
            data_pagamento: dataOcorrencia,
            valor: totalValor,
            status,
            comentario: comentario.trim() || null,
            user_id: user?.id,
            board_id: targetBoardId,
            installment_group_id: null,
            installment_number: null,
            installment_total: null,
            valor_total: null,
            recurring_group_id: groupId,
            recurring_number: i + 1,
          })
        }

        const { error: insertError } = await supabase.from('expenses').insert(rows)
        setLoading(false)

        if (insertError) {
          console.error('Supabase insert (recurring) error:', insertError)
          dispatch({
            type: 'SET_ERROR',
            error: 'Não foi possível salvar: ' + (insertError.message || 'erro desconhecido'),
          })
          return
        }
      } catch (err) {
        setLoading(false)
        console.error('Erro ao processar recorrência:', err)
        dispatch({ type: 'SET_ERROR', error: 'Não foi possível criar os quadros para os meses seguintes.' })
        return
      }
    } else {
      const { error: insertError } = await supabase.from('expenses').insert({
        nome: nome.trim(),
        data_pagamento: dataPagamento,
        valor: totalValor,
        status,
        comentario: comentario.trim() || null,
        user_id: user?.id,
        board_id: boardId,
        installment_group_id: null,
        installment_number: null,
        installment_total: null,
        valor_total: null,
        recurring_group_id: null,
        recurring_number: null,
      })

      setLoading(false)

      if (insertError) {
        dispatch({ type: 'SET_ERROR', error: 'Não foi possível salvar. Tente novamente.' })
        return
      }
    }

    dispatch({ type: 'RESET' })
    setOpen(false)
    onOpenChange?.(false)
    onAdded()
    setDuplicateReview(null)
    setAcceptedDuplicates('')
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : 'Não foi possível salvar. Tente novamente.' })
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (inFlight.current) return; setOpen(isOpen); onOpenChange?.(isOpen); if (!isOpen) { dispatch({ type: 'RESET' }); setDuplicateReview(null); setAcceptedDuplicates('') } }} {...props}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Novo lançamento
          </Button>
        }
      />
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{expenseToEdit ? 'Editar despesa' : 'Nova despesa'}</DialogTitle>
        </DialogHeader>

        <fieldset disabled={loading} className="space-y-4 py-2">
          {duplicateReview?.draft === draftKey && <DuplicateExpenseNotice warnings={duplicateReview.warnings} confirmed={acceptedDuplicates === duplicateReview.key} onConfirm={value => setAcceptedDuplicates(value ? duplicateReview.key : '')} />}
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'nome', value: e.target.value })}
              placeholder="Ex: Cartão Itaú"
            />
            {fieldErrors.nome && <p className="text-sm text-red-600">{fieldErrors.nome}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="data">Data de pagamento</Label>
            <Input
              id="data"
              type="date"
              min={!expenseToEdit && isRecurring && selected ? new Date(Date.UTC(selected.year, selected.month, 1)).toISOString().slice(0, 10) : undefined}
              value={dataPagamento}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'dataPagamento', value: e.target.value })}
            />
            {fieldErrors.dataPagamento && <p className="text-sm text-red-600">{fieldErrors.dataPagamento}</p>}
            {!expenseToEdit && isRecurring && selected && (
              <p className="text-sm text-muted-foreground">A recorrência começa no mês selecionado ou depois. Uma data anterior será ajustada para o mês selecionado, mantendo o dia quando possível.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="valor">{isInstallment ? 'Valor total' : 'Valor'}</Label>
            <Input
              id="valor"
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'valor', value: e.target.value })}
              placeholder="0,00"
            />
            {fieldErrors.valor && <p className="text-sm text-red-600">{fieldErrors.valor}</p>}
          </div>

          {!expenseToEdit && (
            <div className="flex items-center gap-2">
              <input
                id="is-installment"
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={isInstallment}
                onChange={(e) => {
                  dispatch({ type: 'SET_FIELD', field: 'isInstallment', value: e.target.checked })
                  if (e.target.checked) dispatch({ type: 'SET_FIELD', field: 'isRecurring', value: false })
                }}
              />
              <Label htmlFor="is-installment" className="cursor-pointer">
                Esta dívida é parcelada
              </Label>
            </div>
          )}

          {!expenseToEdit && isInstallment && (
            <div className="space-y-2">
              <Label htmlFor="installments">Número de parcelas</Label>
              <Input
                id="installments"
                type="number"
                min={MIN_INSTALLMENTS}
                max={MAX_INSTALLMENTS}
                step="1"
                value={installments}
                onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'installments', value: e.target.value })}
              />
              {fieldErrors.installments && <p className="text-sm text-red-600">{fieldErrors.installments}</p>}
              {preview && (
                <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                  <p>
                    <span className="text-muted-foreground">Valor por parcela:</span>{' '}
                    <span className="font-medium">{formatBRL(preview.perInstallment)}</span>
                  </p>
                  <p className="text-muted-foreground">
                    {preview.n}× de {formatBRL(preview.perInstallment)} — de {preview.firstDateLabel} até {preview.lastDateLabel} (total {formatBRL(preview.total)})
                  </p>
                </div>
              )}
            </div>
          )}

          {!expenseToEdit && (
            <div className="flex items-center gap-2">
              <input
                id="is-recurring"
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={isRecurring}
                onChange={(e) => {
                  dispatch({ type: 'SET_FIELD', field: 'isRecurring', value: e.target.checked })
                  if (e.target.checked) dispatch({ type: 'SET_FIELD', field: 'isInstallment', value: false })
                }}
              />
              <Label htmlFor="is-recurring" className="cursor-pointer">
                Esta despesa é recorrente (mesmo valor todo mês)
              </Label>
            </div>
          )}

          {!expenseToEdit && isRecurring && (
            <div className="space-y-2">
              <Label>Repetir por quantos meses</Label>
              <Select
                value={recurringMonths}
                onValueChange={(v) => dispatch({ type: 'SET_FIELD', field: 'recurringMonths', value: v ?? '3' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRING_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt} meses
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.recurringMonths && (
                <p className="text-sm text-red-600">{fieldErrors.recurringMonths}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => dispatch({ type: 'SET_FIELD', field: 'status', value: v ?? 'Pendente' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Pago">Pago</SelectItem>
                <SelectItem value="VR/VA">VR/VA</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comentario">Comentário</Label>
            <Input
              id="comentario"
              value={comentario}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'comentario', value: e.target.value })}
              placeholder="Opcional"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </fieldset>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
