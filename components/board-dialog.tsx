'use client'

import { useLanguage } from '@/components/language-provider'
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
  selected: MonthYear
  onCreated: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}

export function BoardDialog({
  selected,
  onCreated,
  open: openProp,
  onOpenChange,
  hideTrigger,
}: BoardDialogProps) {
  const { t } = useLanguage()
  const supabase = createClient()
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = (value: boolean) => {
    setOpenState(value)
    onOpenChange?.(value)
  }
  
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Informe um nome para o quadro.")
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
      setError("Não foi possível criar o quadro. Tente novamente.")
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
{!hideTrigger && (
  <DialogTrigger
    render={
      <Button variant="outline" size="sm">
        <Plus className="h-4 w-4 mr-1" />{t("Novo quadro ")}</Button>
    }
  />
)}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Novo quadro")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="board-name">{t("Nome do quadro")}</Label>
          <Input
            id="board-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("Ex: Cartão Nubank")}
          />
          {error && <p className="text-sm text-red-600">{t(error)}</p>}
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