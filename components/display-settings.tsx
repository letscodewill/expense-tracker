'use client'
import { Settings } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import { LanguageSelector } from '@/components/language-selector'
import { CurrencySelector } from '@/components/currency-selector'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'

export function DisplaySettings() {
  const {t}=useLanguage()
  return <Dialog><DialogTrigger render={<Button variant="outline" size="sm" className="gap-2"><Settings className="size-4" />{t('Configurações')}</Button>} />
    <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl p-6">
      <DialogHeader><DialogTitle>{t('Idioma e moeda')}</DialogTitle><DialogDescription>{t('O país define o padrão inicial. Sua escolha manual tem prioridade neste navegador.')}</DialogDescription></DialogHeader>
      <div className="space-y-3"><p className="text-sm font-medium">{t('Idioma')}</p><LanguageSelector showCurrency={false} /><p className="text-xs text-muted-foreground">{t('A moeda local é sugerida pelo país. Sua escolha manual de moeda é preservada ao trocar o idioma.')}</p></div>
      <div className="space-y-3"><p className="text-sm font-medium">{t('Moeda de exibição')}</p><CurrencySelector /><p className="text-xs text-muted-foreground">{t('Apenas exibição: não converte valores nem altera os dados salvos.')}</p></div>
    </DialogContent>
  </Dialog>
}
