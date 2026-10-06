import type { MetadataRoute } from 'next'
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/', name: 'NoControle — Painel de despesas', short_name: 'NoControle',
    description: 'Organize despesas, faturas e orçamento em um só lugar.', lang: 'pt-BR',
    start_url: '/', scope: '/', display: 'standalone', background_color: '#141218', theme_color: '#6750a4',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
