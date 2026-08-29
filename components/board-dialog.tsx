'use client'

import { useState } from 'react'
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
import { Plus } from 'lucide-react'
import type { MonthYear } from '@/components/month-year-picker'

export type BoardDialogProps = {
  /** The board is created for this specific month/year. */
  selected: MonthYear
  onCreated: () => void
}

export function BoardDialog({ selected, onCreated }: BoardDialogProps) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Informe um nome para o quadro.')
      return
    }

    setLoading(true)
    setError('')

    const user = await safeGetUser()

    const { error: insertError } = await supabase.from('boards').insert({
      name: trimmed,
      user_id: user?.id,
      month: selected.month,
      year: selected.year,
    })

    setLoading(false)

    if (insertError) {
      setError('Não foi possível criar o quadro. Tente novamente.')
      return
    }

    setName('')
    setOpen(false)
    onCreated()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen)
        if (!isOpen) {
          setName('')
          setError('')
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Novo quadro
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo quadro</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="board-name">Nome do quadro</Label>
          <Input
            id="board-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Cartão Nubank"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? 'Criando...' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}