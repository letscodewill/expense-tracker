'use client'
import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_CHANGE_EVENT, useCategories } from '@/lib/use-categories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function CategoryManager({ onChanged }: { onChanged: () => void }) {
  const client = createClient()
  const { categories, loading, error: loadError } = useCategories()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  async function change(remove?: string) {
    if (busy.current || loading || loadError) return
    const normalized = name.trim().replace(/\s+/g, ' ')
    if (!remove && (!normalized || normalized.length > 60)) { setError('Informe um nome de categoria com até 60 caracteres.'); return }
    if (!remove && categories.some(category => category.toLocaleLowerCase('pt-BR') === normalized.toLocaleLowerCase('pt-BR'))) { setError('Esta categoria já existe.'); return }
    if (remove && !window.confirm(`Remover a categoria "${remove}"? As despesas serão mantidas em "Sem categoria" e os limites dessa categoria serão removidos em todos os meses.`)) return
    busy.current = true; setSaving(true); setError('')
    try {
      const { data: { user } } = await client.auth.getUser()
      if (!user) throw new Error('Entre novamente para gerenciar categorias.')
      const result = remove
        ? await client.from('expense_categories').delete().eq('user_id', user.id).eq('name', remove).select('name')
        : await client.from('expense_categories').insert({ user_id: user.id, name: normalized }).select('name')
      if (result.error || !result.data?.length) throw new Error(result.error?.code === '23505' ? 'Esta categoria já existe.' : 'Não foi possível salvar a alteração. Tente novamente.')
      if (!remove) setName('')
      window.dispatchEvent(new Event(CATEGORY_CHANGE_EVENT)); onChanged()
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao alterar categoria.') }
    finally { busy.current = false; setSaving(false) }
  }
  return <details className="material-toolbar space-y-3 p-4">
    <summary className="cursor-pointer text-lg font-semibold">Gerenciar categorias</summary>
    <p className="text-sm text-muted-foreground">Categorias são salvas na sua conta. Remover mantém as despesas em “Sem categoria” e remove os limites associados de todos os meses.</p>
    {(error || loadError) && <p role="alert" className="text-sm text-destructive">{error || loadError}</p>}
    <div className="flex flex-col gap-2 sm:flex-row"><Input aria-label="Nome da nova categoria" maxLength={60} placeholder="Ex.: Pets" value={name} disabled={loading || saving || !!loadError} onChange={event => setName(event.target.value)} /><Button disabled={loading || saving || !!loadError} onClick={() => void change()}>Adicionar categoria</Button></div>
    <ul className="flex flex-wrap gap-2">{categories.map(category => <li key={category} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"><span>{category}</span>{category !== 'Sem categoria' && <Button size="sm" variant="ghost" disabled={loading || saving || !!loadError} aria-label={`Remover categoria ${category}`} onClick={() => void change(category)}>Remover</Button>}</li>)}</ul>
  </details>
}
