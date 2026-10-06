'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Download } from 'lucide-react'

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
export function PwaInstallButton() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [open, setOpen] = useState(false)
  const [ios, setIos] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)')
    const refresh = () => setInstalled(standalone.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)
    const onPrompt = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent) }
    const onInstalled = () => { setInstalled(true); setPrompt(null); setOpen(false) }
    // Defer the initial platform read to avoid state changes during effect setup.
    queueMicrotask(refresh)
    standalone.addEventListener('change', refresh)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => { standalone.removeEventListener('change', refresh); window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [])
  async function install() {
    if (busy) return
    if (!prompt) {
      setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
      setOpen(true)
      return
    }
    setBusy(true)
    try {
      await prompt.prompt()
      const result = await prompt.userChoice
      if (result.outcome === 'accepted') setInstalled(true)
    } catch { setOpen(true) }
    finally { setPrompt(null); setBusy(false) }
  }
  if (installed) return null
  return <>
    <Button variant="outline" size="sm" onClick={() => void install()} disabled={busy}><Download className="mr-1 size-4" aria-hidden="true" />Instalar aplicativo</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Instalar NoControle</DialogTitle><DialogDescription>Adicione o sistema à tela inicial para abrir como aplicativo.</DialogDescription></DialogHeader>
      {ios ? <ol className="list-decimal space-y-3 pl-5 text-sm"><li>Abra este site no Safari.</li><li>Toque em Compartilhar e escolha “Adicionar à Tela de Início”.</li><li>Se aparecer “Abrir como App”, deixe ativado e toque em Adicionar.</li></ol> : <ol className="list-decimal space-y-3 pl-5 text-sm"><li>No Android, abra este site no Chrome ou Edge.</li><li>Abra o menu do navegador e procure “Instalar aplicativo” ou “Adicionar à tela inicial”.</li><li>No computador, procure a opção de instalação na barra de endereço ou no menu.</li></ol>}
      <p className="text-sm text-muted-foreground">Use o endereço HTTPS do sistema. Se estiver em um navegador dentro de outro aplicativo, abra o link no navegador do celular. O sistema precisa de internet para consultar e salvar despesas.</p>
    </DialogContent></Dialog>
  </>
}
