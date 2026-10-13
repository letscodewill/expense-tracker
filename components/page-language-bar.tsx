'use client'

import { usePathname } from 'next/navigation'
import { LanguageSelector } from './language-selector'

export function PageLanguageBar() {
  const path = usePathname()
  if (path === '/' || path === '/login') return null
  return <div className="container mx-auto flex max-w-7xl justify-end px-4 pt-4 md:px-8"><LanguageSelector compact /></div>
}
