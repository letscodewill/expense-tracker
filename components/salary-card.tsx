'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pencil, Check, X } from 'lucide-react'
import type { MonthYear } from '@/components/month-year-picker'

export type SalaryCardProps = {
  selected: MonthYear
  totalExpenses: number
}

export function SalaryCard({ selected, totalExpenses }: SalaryCardProps) {
  const supabase = createClient()
  const [salary, setSalary] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchSalary = useCallback(async () => {
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('salaries')
      .select('valor')
      .eq('month', selected.month)
      .eq('year', selected.year)
      .maybeSingle()

    if (fetchError) {
      console.error('Erro ao buscar salário:', fetchError)
    }

    setSalary(data?.valor ?? null)
    setLoading(false)
  }, [supabase, selected.month, selected.year])

  useEffect(() => {
    fetchSalary()
  }, [fetchSalary])

  function startEditing() {
    setDraft(salary !== null ? String(salary) : '')
    setError('')
    setEditing(true)
  }

  async function handleSave() {
    const parsed = parseFloat(draft.replace(',', '.'))
    if (isNaN(parsed) || parsed < 0) {
      setError('Informe um valor válido.')
      return
    }

    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()

    const { error: upsertError } = await supabase
      .from('salaries')
      .upsert(
        {
          user_id: user?.id,
          month: selected.month,
          year: selected.year,
          valor: parsed,
        },
        { onConflict: 'user_id,month,year' }
      )

    setSaving(false)

    if (upsertError) {
      console.error('Erro ao salvar salário:', upsertError)
      setError('Não foi possível salvar. Tente novamente.')
      return
    }

    setSalary(parsed)
    setEditing(false)
  }

  const remaining = salary !== null ? salary - totalExpenses : null

  return (
    <div className="rounded-xl border p-4 space-y-2">
      {editing ? (
        <div className="space-y-2">
          <Label htmlFor="salary-input">Salário do mês</Label>
          <div className="flex items-center gap-2">
            <Input
              id="salary-input"
              type="number"
              step="0.01"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="0,00"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
                if (e.key === 'Escape') setEditing(false)
              }}
            />
            <Button variant="ghost" size="sm" onClick={handleSave} disabled={saving} aria-label="Salvar">
              <Check className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} aria-label="Cancelar">
              <X className="h-4 w-4" />
            </Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Salário do mês</span>
            <Button variant="ghost" size="sm" onClick={startEditing} aria-label="Editar salário">
              <Pencil className="h-4 w-4" />
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : salary === null ? (
            <p className="text-sm text-muted-foreground">Nenhum salário cadastrado para este mês.</p>
          ) : (
            <div className="space-y-1">
              <p className="text-lg font-semibold">
                {salary.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">Vai sobrar</span>
                <span
                  className={`font-semibold ${
                    (remaining ?? 0) < 0 ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {(remaining ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}