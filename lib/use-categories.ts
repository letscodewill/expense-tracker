'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CATEGORIES } from '@/lib/budgeting'

export const CATEGORY_CHANGE_EVENT = 'expense-categories-changed'
export function useCategories() {
  const [client] = useState(() => createClient())
  const [reload, setReload] = useState(0)
  const retry = useCallback(() => setReload(value => value + 1), [])
  const [categories, setCategories] = useState<string[]>([...CATEGORIES])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true, revision = 0, ready = false, busy = false
    async function refresh() {
      if (busy) return
      busy = true
      const current = ++revision
      if (!ready) setLoading(true)
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const data = await Promise.race([
          (async () => {
            const { data: { user }, error: authError } = await client.auth.getUser()
            if (!user || authError) throw new Error('Entre novamente para carregar suas categorias.')
            const result = await client.from('expense_categories').select('name').eq('user_id', user.id).order('name')
            if (result.error || !result.data) throw new Error('Não foi possível carregar categorias. Tente novamente.')
            return result.data
          })(),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('O carregamento das categorias demorou demais. Tente novamente.')), 20000) }),
        ])
        if (active && current === revision) { ready = true; setCategories(['Sem categoria', ...data.map(row => row.name).filter(name => name !== 'Sem categoria')]); setError('') }
      } catch (err) { if (active && current === revision) setError(err instanceof Error ? err.message : 'Falha ao carregar categorias.') }
      finally { clearTimeout(timer); busy = false; if (active && current === revision) setLoading(false) }
    }
    void refresh()
    window.addEventListener(CATEGORY_CHANGE_EVENT, refresh)
    window.addEventListener('focus', refresh)
    return () => { active = false; window.removeEventListener(CATEGORY_CHANGE_EVENT, refresh); window.removeEventListener('focus', refresh) }
  }, [client, reload])
  return { categories, error, loading, retry }
}
