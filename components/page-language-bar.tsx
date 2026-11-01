'use client'

import { usePathname } from 'next/navigation'
import { DisplaySettings } from './display-settings'

export function PageLanguageBar() {
  const path = usePathname()
  const privatePage=['/planning','/reports','/savings','/tickets'].includes(path) || path.startsWith('/admin') || path.startsWith('/tickets/')
  if (!privatePage) return null
  return <div className="container mx-auto flex max-w-7xl justify-end px-4 pt-4 md:px-8"><DisplaySettings /></div>
}
