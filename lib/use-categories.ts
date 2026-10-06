'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CATEGORIES } from '@/lib/budgeting'

export const CATEGORY_CHANGE_EVENT = 'expense-categories-changed'
export function useCategories() {
  const client = createClient()
  const [categories, setCategories] = useState<string[]>([...CATEGORIES])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true, revision = 0
    async function refresh() {
      const current = ++revision
      setLoading(true)
      try {
        const { data: { user }, error: authError } = await client.auth.getUser()
        if (!user || authError) throw new Error('Entre novamente para carregar suas categorias.')
        const { data, error } = await client.from('expense_categories').select('name').eq('user_id', user.id).order('name')
        if (error || !data) throw new Error('Não foi possível carregar categorias. Reabra esta página para tentar novamente.')
        if (active && current === revision) { setCategories(['Sem categoria', ...data.map(row => row.name).filter(name => name !== 'Sem categoria')]); setError('') }
      } catch (err) { if (active && current === revision) setError(err instanceof Error ? err.message : 'Falha ao carregar categorias.') }
      finally { if (active && current === revision) setLoading(false) }
    }
    void refresh()
    window.addEventListener(CATEGORY_CHANGE_EVENT, refresh)
    window.addEventListener('focus', refresh)
    return () => { active = false; window.removeEventListener(CATEGORY_CHANGE_EVENT, refresh); window.removeEventListener('focus', refresh) }
  }, [client])
  return { categories, error, loading }
}
