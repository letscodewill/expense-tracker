'use client'

import { useLanguage } from '@/components/language-provider'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, X, Receipt, LayoutGrid, Upload } from 'lucide-react'

export type FloatingActionMenuProps = {
  onNewExpense: () => void
  onNewBoard: () => void
  onImportInvoice: () => void
}

export function FloatingActionMenu({
  onNewExpense,
  onNewBoard,
  onImportInvoice,
}: FloatingActionMenuProps) {
  const { t } = useLanguage()

  const [open, setOpen] = useState(false)

  function handleAction(action: () => void) {
    setOpen(false)
    action()
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="flex flex-col items-end gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm bg-background border rounded-md px-2 py-1 shadow-sm">{t("Novo lançamento")}</span>
            <Button
              size="icon"
              variant="secondary"
              className="rounded-full shadow-md"
              onClick={() => handleAction(onNewExpense)}
              aria-label={t("Novo lançamento")}
            >
              <Receipt className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm bg-background border rounded-md px-2 py-1 shadow-sm">{t("Novo quadro")}</span>
            <Button
              size="icon"
              variant="secondary"
              className="rounded-full shadow-md"
              onClick={() => handleAction(onNewBoard)}
              aria-label={t("Novo quadro")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm bg-background border rounded-md px-2 py-1 shadow-sm">{t("Importar fatura")}</span>
            <Button
              size="icon"
              variant="secondary"
              className="rounded-full shadow-md"
              onClick={() => handleAction(onImportInvoice)}
              aria-label={t("Importar fatura")}
            >
              <Upload className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Button
        size="icon"
        className="material-fab rounded-2xl h-16 w-16 shadow-lg"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t("Fechar menu") : t("Abrir menu de ações")}
        aria-expanded={open}
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </Button>
    </div>
  )
}
