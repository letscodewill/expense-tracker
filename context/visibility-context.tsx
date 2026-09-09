'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type VisibilityContextType = {
  hidden: boolean
  toggle: () => void
}

const VisibilityContext = createContext<VisibilityContextType | undefined>(undefined)

const STORAGE_KEY = 'expense-tracker:values-hidden'

export function VisibilityProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false)

  // Carrega a preferência salva, uma vez, ao montar.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'true') setHidden(true)
  }, [])

  function toggle() {
    setHidden((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }

  return (
    <VisibilityContext.Provider value={{ hidden, toggle }}>
      {children}
    </VisibilityContext.Provider>
  )
}

export function useValuesVisibility() {
  const ctx = useContext(VisibilityContext)
  if (!ctx) {
    throw new Error('useValuesVisibility precisa estar dentro de um VisibilityProvider')
  }
  return ctx
}