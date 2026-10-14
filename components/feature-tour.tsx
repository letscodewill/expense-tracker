'use client'

import { startTransition, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import { createClient } from '@/lib/supabase/client'
import { claimTourVisit, dismissFeatureTour, FEATURE_TOUR_OPEN_EVENT, FEATURE_TOUR_STEPS, tourVisitKey } from '@/lib/feature-tour'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FeatureTourArtwork } from './feature-tour-artwork'

const slides = [
  { title: 'Cadastre suas despesas no mês certo', description: 'Use o botão +, escolha o mês de pagamento e o quadro. Se o quadro ainda não existir naquele mês, ele será criado ao salvar.' },
  { title: 'Importe e confira suas faturas', description: 'Envie um PDF ou uma planilha Excel/CSV. Revise nomes, valores, categorias e o mês de pagamento antes de confirmar a importação.' },
  { title: 'Planeje seu orçamento', description: 'Crie categorias, defina limites mensais e acompanhe a comparação entre meses. Veja também os lembretes das contas próximas do vencimento.' },
  { title: 'Encontre uma despesa em segundos', description: 'Toque na lupa ao lado do seletor de mês. Pesquise um nome ou valor para descobrir em qual quadro e mês a despesa está cadastrada.' },
  { title: 'Seu painel, do seu jeito', description: 'Escolha temas claros ou escuros, sua paleta de cores e o idioma Português ou English. Sua foto de perfil também pode ser alterada.' },
] as const

export function FeatureTourLauncher() {
  const { t } = useLanguage()
  return <Button variant="outline" size="sm" data-close-navigation onClick={() => window.dispatchEvent(new Event(FEATURE_TOUR_OPEN_EVENT))}><Sparkles className="mr-2 size-4" />{t('Ver novidades')}</Button>
}

export function FeatureTour({ userId, signedInAt, dismissed }: { userId: string; signedInAt: string; dismissed: boolean }) {
  const { t } = useLanguage()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [hideAgain, setHideAgain] = useState(dismissed)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)
  useEffect(() => {
    const visitKey = tourVisitKey(userId, signedInAt)
    // Storage may be unavailable, but this should never prevent using the app.
    let show = !dismissed
    try { show = claimTourVisit(window.sessionStorage, visitKey, dismissed) } catch {}
    if (show) startTransition(() => setOpen(true))
    const reopen = () => { if (!busy.current) { setIndex(0); setHideAgain(dismissed); setError(''); setOpen(true) } }
    window.addEventListener(FEATURE_TOUR_OPEN_EVENT, reopen)
    return () => window.removeEventListener(FEATURE_TOUR_OPEN_EVENT, reopen)
  }, [userId, signedInAt, dismissed])

  async function finish() {
    if (busy.current) return
    setError('')
    if (hideAgain === dismissed) { setOpen(false); return }
    busy.current = true; setSaving(true)
    try {
      await dismissFeatureTour(createClient(), userId, hideAgain)
      setOpen(false)
      router.refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar sua preferência. Tente novamente.') }
    finally { busy.current = false; setSaving(false) }
  }

  const slide = slides[index]
  return <Dialog open={open} onOpenChange={value => { if (!value) void finish() }}>
    <DialogContent initialFocus={() => document.getElementById('feature-tour-title')} className="flex max-h-[92dvh] flex-col overflow-hidden rounded-3xl p-5 sm:max-w-2xl sm:p-7" showCloseButton={!saving}>
      <DialogHeader className="shrink-0 pr-7"><div className="flex items-center gap-2 text-xs font-medium text-primary"><Sparkles className="size-4" />{t('Conheça o NoControle')}<span className="ml-auto text-muted-foreground">{t('{current} de {total}', { current: index + 1, total: slides.length })}</span></div><DialogTitle id="feature-tour-title" tabIndex={-1} className="text-xl outline-none sm:text-2xl">{t(slide.title)}</DialogTitle><DialogDescription>{t('Um guia rápido para aproveitar as funcionalidades do seu painel.')}</DialogDescription></DialogHeader>
      <div key={index} className="min-h-0 space-y-3 overflow-y-auto">
      <FeatureTourArtwork step={FEATURE_TOUR_STEPS[index]} label={t(slide.title)} />
      <p aria-live="polite" className="text-sm leading-relaxed text-muted-foreground">{t(slide.description)}</p>
      <p className="text-[11px] text-muted-foreground">{t('Imagens ilustrativas. Seus dados não são alterados pelo tutorial.')}</p>
      <div role="group" aria-label={t('Etapas do tutorial')} className="flex justify-center gap-1">{slides.map((slide, position) => <button key={slide.title} type="button" disabled={saving} aria-label={t('Ir para etapa {number}', { number: position + 1 })} aria-current={index === position ? 'step' : undefined} onClick={() => setIndex(position)} className="flex size-8 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-primary"><span className={`h-2 rounded-full transition-all ${index === position ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/35'}`} /></button>)}</div>
      </div>
      <div className="shrink-0 space-y-2 border-t pt-4"><label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={hideAgain} disabled={saving} onChange={event => setHideAgain(event.target.checked)} className="size-4 shrink-0 accent-primary" />{t('Não mostrar novamente')}</label><p className="text-xs text-muted-foreground">{t('Ao fechar, sua escolha será salva na conta e valerá também em outros aparelhos.')}</p></div>
      {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
      {saving && <p role="status" className="text-sm text-muted-foreground">{t('Salvando...')}</p>}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2"><Button variant="ghost" disabled={saving} onClick={() => void finish()}>{t('Agora não')}</Button><div className="flex gap-2"><Button variant="outline" disabled={saving || index === 0} onClick={() => setIndex(value => Math.max(0, value - 1))}><ChevronLeft className="size-4" />{t('Anterior')}</Button>{index < slides.length - 1 ? <Button disabled={saving} onClick={() => setIndex(value => Math.min(slides.length - 1, value + 1))}>{t('Próxima')}<ChevronRight className="size-4" /></Button> : <Button disabled={saving} onClick={() => void finish()}>{t(saving ? 'Salvando...' : 'Entendi')}</Button>}</div></div>
    </DialogContent>
  </Dialog>
}
