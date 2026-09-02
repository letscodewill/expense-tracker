'use client'

import { z } from 'zod'
import { useReducer, useState, useEffect, useMemo } from 'react'
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



const MIN_INSTALLMENTS = 2
const MAX_INSTALLMENTS = 48

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
  })
  .superRefine((data, ctx) => {
    if (!data.isInstallment) return
    const n = parseInt(data.installments, 10)
    if (!Number.isInteger(n) || n < MIN_INSTALLMENTS || n > MAX_INSTALLMENTS) {
      ctx.addIssue({
        path: ['installments'],
        code: z.ZodIssueCode.custom,
        message: 'Informe um número de parcelas entre ' + MIN_INSTALLMENTS + ' e ' + MAX_INSTALLMENTS + '.',
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
    case 'SET_ERROR': {
      return { ...state, error: action.error, fieldErrors: {} }
    }
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
  forceOpen?: boolean
} & React.ComponentProps<typeof Dialog>

/**
 * Adds `months` calendar months to the given ISO date string, preserving the day
 * (clamped to the last day of the target month if the original day doesn't fit).
 */
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

export function AddExpenseDialog({
  onAdded,
  expenseToEdit,
  onOpenChange,
  boardId = null,
  forceOpen,
  ...props
}: AddExpenseDialogProps) {
  const [formState, dispatch] = useReducer(formReducer, initialState)
  const { nome, dataPagamento, valor, status, comentario, isInstallment, installments, error, fieldErrors } =
    formState

  const supabase = createClient()

  const [open, setOpen] = useState(!!expenseToEdit)
  const [loading, setLoading] = useState(false)

useEffect(() => {
  setOpen(!!expenseToEdit || !!forceOpen)
  if (expenseToEdit) {
    dispatch({ type: 'SET_FIELD', field: 'nome', value: expenseToEdit.nome })
    dispatch({ type: 'SET_FIELD', field: 'dataPagamento', value: expenseToEdit.data_pagamento })
    dispatch({ type: 'SET_FIELD', field: 'valor', value: String(expenseToEdit.valor) })
    dispatch({ type: 'SET_FIELD', field: 'status', value: expenseToEdit.status })
    dispatch({ type: 'SET_FIELD', field: 'comentario', value: expenseToEdit.comentario ?? '' })
  }
}, [expenseToEdit, forceOpen])

  // Live preview for the installment block.
  const preview = useMemo(() => {
    if (!isInstallment || !dataPagamento) return null
    const n = parseInt(installments, 10)
    if (!Number.isInteger(n) || n < MIN_INSTALLMENTS || n > MAX_INSTALLMENTS) return null
    const total = parseFloat(valor.replace(',', '.'))
    if (isNaN(total) || total <= 0) return null

    // Distribute cents so the sum of installments exactly equals the total.
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
    return {
      perInstallment: first,
      firstDateLabel,
      lastDateLabel,
      total,
      n,
    }
  }, [isInstallment, dataPagamento, installments, valor])

  async function handleSubmit() {
    const result = expenseSchema.safeParse(formState)

    if (!result.success) {
      const errors: Record<string, string> = {}
      result.error.issues.forEach((issue) => {
        errors[issue.path[0] as string] = issue.message
      })
      dispatch({ type: 'SET_FIELD_ERRORS', errors })
      return
    }

    setLoading(true)
    dispatch({ type: 'SET_ERROR', error: '' })

    const user = await safeGetUser()
    const totalValor = parseFloat(valor.replace(',', '.')) || 0

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
      // Convert to integer cents to avoid floating-point drift (e.g. 0.1 + 0.2).
      const totalCents = Math.round(totalValor * 100)
      const baseCents = Math.floor(totalCents / n)
      const remainder = totalCents - baseCents * n

      const rows = Array.from({ length: n }, (_, i) => {
        const cents = baseCents + (i < remainder ? 1 : 0)
        return {
          nome: nome.trim(),
          data_pagamento: addMonthsISO(dataPagamento, i),
          valor: cents / 100,
          status,
          comentario: comentario.trim() || null,
          user_id: user?.id,
          board_id: boardId,
          installment_group_id: groupId,
          installment_number: i + 1,
          installment_total: n,
          valor_total: totalValor,
        }
      })

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
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); onOpenChange?.(isOpen); if (!isOpen) dispatch({ type: 'RESET' })}} {...props}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Novo lançamento
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{expenseToEdit ? 'Editar despesa' : 'Nova despesa'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) =>
                dispatch({ type: 'SET_FIELD', field: 'nome', value: e.target.value })
              }
              placeholder="Ex: Cartão Itaú"
            />
            {fieldErrors.nome && (
              <p className="text-sm text-red-600">{fieldErrors.nome}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="data">Data de pagamento</Label>
            <Input
              id="data"
              type="date"
              value={dataPagamento}
              onChange={(e) =>
                dispatch({
                  type: 'SET_FIELD',
                  field: 'dataPagamento',
                  value: e.target.value,
                })
              }
            />
            {fieldErrors.dataPagamento && (
              <p className="text-sm text-red-600">{fieldErrors.dataPagamento}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="valor">
              {isInstallment ? 'Valor total' : 'Valor'}
            </Label>
            <Input
              id="valor"
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) =>
                dispatch({ type: 'SET_FIELD', field: 'valor', value: e.target.value })
              }
              placeholder="0,00"
            />
            {fieldErrors.valor && (
              <p className="text-sm text-red-600">{fieldErrors.valor}</p>
            )}
          </div>

          {!expenseToEdit && (
            <div className="flex items-center gap-2">
              <input
                id="is-installment"
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={isInstallment}
                onChange={(e) =>
                  dispatch({ type: 'SET_FIELD', field: 'isInstallment', value: e.target.checked })
                }
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
                onChange={(e) =>
                  dispatch({ type: 'SET_FIELD', field: 'installments', value: e.target.value })
                }
              />
              {fieldErrors.installments && (
                <p className="text-sm text-red-600">{fieldErrors.installments}</p>
              )}
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

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) =>
                dispatch({ type: 'SET_FIELD', field: 'status', value: v ?? 'Pendente' })
              }
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
              onChange={(e) =>
                dispatch({
                  type: 'SET_FIELD',
                  field: 'comentario',
                  value: e.target.value,
                })
              }
              placeholder="Opcional"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}