'use client'

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'
import {
  getVisibilitySnapshot,
  getServerVisibilitySnapshot,
  subscribeVisibility,
  toggleVisibility,
} from '@/lib/values-visibility-store'

type VisibilityContextType = {
  hidden: boolean
  toggle: () => void
}

const VisibilityContext = createContext<VisibilityContextType | undefined>(undefined)

export function VisibilityProvider({ children }: { children: ReactNode }) {
  const hidden = useSyncExternalStore(
    subscribeVisibility,
    getVisibilitySnapshot,
    getServerVisibilitySnapshot,
  )

  return (
    <VisibilityContext.Provider value={{ hidden, toggle: toggleVisibility }}>
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
