'use client'

import { useLanguage } from '@/components/language-provider'
import { startTransition, useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pencil, Check, X } from 'lucide-react'
import type { MonthYear } from '@/components/month-year-picker'
import { VisibilityToggleButton } from './visibility-toggle-button'
import { MaskedValue } from './masked-value'

export type SalaryCardProps = {
  selected: MonthYear
  totalExpenses: number
}

export function SalaryCard({ selected, totalExpenses }: SalaryCardProps) {
  const { t } = useLanguage()

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
    startTransition(() => { void fetchSalary() })
  }, [fetchSalary])

  function startEditing() {
    setDraft(salary !== null ? String(salary) : '')
    setError('')
    setEditing(true)
  }

  async function handleSave() {
    const parsed = parseFloat(draft.replace(',', '.'))
    if (isNaN(parsed) || parsed < 0) {
      setError("Informe um valor válido.")
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
      setError("Não foi possível salvar. Tente novamente.")
      return
    }

    setSalary(parsed)
    setEditing(false)
  }

  const remaining = salary !== null ? salary - totalExpenses : null

  return (
    <div className="material-salary rounded-2xl border p-4 sm:p-5 space-y-4">
      {editing ? (
        <div className="space-y-2">
          <Label htmlFor="salary-input">{t("Salário do mês")}</Label>
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
            <Button variant="ghost" size="sm" onClick={handleSave} disabled={saving} aria-label={t("Salvar")}>
              <Check className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} aria-label={t("Cancelar")}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {error && <p className="text-sm text-red-600">{t(error)}</p>}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium">{t("Resumo do mês")}</h2>
            <Button variant="ghost" size="sm" onClick={startEditing} aria-label={t("Editar salário")}>
              <Pencil className="h-4 w-4" /><span className="ml-2 hidden sm:inline">{t("Editar salário")}</span>
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-[1fr_1fr_1.4fr]">
            <div className="rounded-xl border border-border/70 bg-card p-4 text-card-foreground">
              <div className="flex items-center justify-between gap-1"><span className="text-xs text-muted-foreground">{t("Salário do mês")}</span><VisibilityToggleButton /></div>
              <p className="mt-3 text-xl font-medium tabular-nums sm:text-2xl">{loading ? t("Carregando...") : salary === null ? t("Não informado") : <MaskedValue value={salary} mask />}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card p-4 text-card-foreground">
              <p className="text-xs text-muted-foreground">{t("Total de despesas")}</p>
              <p className="mt-3 text-xl font-medium tabular-nums sm:text-2xl"><MaskedValue value={totalExpenses} /></p>
            </div>
            <div className="col-span-2 rounded-xl bg-secondary p-4 text-secondary-foreground lg:col-span-1">
              <p className="text-xs font-medium">{t("Vai sobrar")}</p>
              <p className={`mt-3 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl ${remaining !== null && remaining < 0 ? 'text-red-700 dark:text-red-300' : ''}`}>{loading ? '—' : remaining === null ? '—' : <MaskedValue value={remaining} />}</p>
              <p className="mt-2 text-xs opacity-80">{salary === null ? t("Informe o salário para ver o saldo previsto.") : t("Salário menos o total de despesas do mês.")}</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
