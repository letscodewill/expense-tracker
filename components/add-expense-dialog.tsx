'use client'

import { z } from 'zod'
import { useReducer, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
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
}

const expenseSchema = z.object({
  nome: z.string().trim().min(1, { message: 'Informe o nome da despesa.' }),
  dataPagamento: z.string().min(1, { message: 'Informe a data de pagamento.' }),
  valor: z.string().refine((val) => !isNaN(parseFloat(val.replace(',', '.'))), {
    message: 'Informe um valor válido.',
  }),
})

const initialState = {
  nome: '',
  dataPagamento: '',
  valor: '',
  status: 'Pendente',
  comentario: '',
  error: '',
  fieldErrors: {} as Record<string, string>,
}

type State = typeof initialState

type Action =
  | { type: 'SET_FIELD'; field: keyof Omit<State, 'fieldErrors' | 'error'>; value: string }
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
  /** null/undefined = main panel. A board's uuid to attach it to that board. */
  boardId?: string | null
} & React.ComponentProps<typeof Dialog>

export function AddExpenseDialog({
  onAdded,
  expenseToEdit,
  onOpenChange,
  boardId = null,
  ...props
}: AddExpenseDialogProps) {
  const [formState, dispatch] = useReducer(formReducer, initialState)
  const { nome, dataPagamento, valor, status, comentario, error, fieldErrors } =
    formState

  const supabase = createClient()

  const [open, setOpen] = useState(!!expenseToEdit)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setOpen(!!expenseToEdit)
    if (expenseToEdit) {
      dispatch({ type: 'SET_FIELD', field: 'nome', value: expenseToEdit.nome })
      dispatch({ type: 'SET_FIELD', field: 'dataPagamento', value: expenseToEdit.data_pagamento })
      dispatch({ type: 'SET_FIELD', field: 'valor', value: String(expenseToEdit.valor) })
      dispatch({ type: 'SET_FIELD', field: 'status', value: expenseToEdit.status })
      dispatch({ type: 'SET_FIELD', field: 'comentario', value: expenseToEdit.comentario ?? '' })
    }
  }, [expenseToEdit])

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

    const { data: { user } } = await supabase.auth.getUser()

    if (expenseToEdit) {
      const { error: updateError } = await supabase
        .from('expenses')
        .update({
          nome: nome.trim(),
          data_pagamento: dataPagamento,
          valor: parseFloat(valor.replace(',', '.')) || 0,
          status,
          comentario: comentario.trim() || null,
        })
        .eq('id', expenseToEdit.id)

      setLoading(false)

      if (updateError) {
        dispatch({ type: 'SET_ERROR', error: 'Não foi possível atualizar. Tente novamente.' })
        return
      }
    } else {
      const { error: insertError } = await supabase.from('expenses').insert({
        nome: nome.trim(),
        data_pagamento: dataPagamento,
        valor: parseFloat(valor.replace(',', '.')) || 0,
        status,
        comentario: comentario.trim() || null,
        user_id: user?.id,
        board_id: boardId,
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
            <Label htmlFor="valor">Valor</Label>
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