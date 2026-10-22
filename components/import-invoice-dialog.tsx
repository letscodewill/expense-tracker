'use client'
import { useCurrency } from '@/lib/use-currency'
import { useLanguage } from '@/components/language-provider'
import { extractPdfText, preparePdfForAI, PdfPasswordRequiredError } from '@/lib/pdf-text-extract'
import { useEffect, useRef, useState } from 'react'
import { checkExpenseDuplicates, type DuplicateWarning } from '@/lib/expense-duplicates'
import { DuplicateExpenseNotice } from '@/components/duplicate-expense-notice'
import { createClient } from '@/lib/supabase/client'
import { parseInvoiceText, type ParsedExpense } from '@/lib/invoice-parser'
import { fifthBusinessDayISO } from '@/lib/payment-date'
import { readSpreadsheet, suggestColumns, mapSpreadsheet, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, type ImportSheet } from '@/lib/spreadsheet-import'
import { validateAIInvoice } from '@/lib/invoice-ai'
import { useCategories } from '@/lib/use-categories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoaderCircle, Upload, X } from 'lucide-react'
import type { MonthYear } from '@/components/month-year-picker'

type Board = { id: string; name: string }
type InvoiceRow = Pick<ParsedExpense, 'nome' | 'valor'> & { category?: string }

export type ImportInvoiceDialogProps = {
  selected: MonthYear
  boards: Board[]
  onImported: (paymentPeriod: MonthYear) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}

const NEW_BOARD_VALUE = '__new__'
const MAIN_PANEL_VALUE = '__main__'

export function ImportInvoiceDialog({
  selected,
  boards,
  onImported,
  open: openProp,
  onOpenChange,
  hideTrigger,
}: ImportInvoiceDialogProps) {
  const { t, locale } = useLanguage()
  const currency = useCurrency()

  const [supabase] = useState(() => createClient())
  const { categories, loading: categoriesLoading, error: categoriesError, retry: retryCategories } = useCategories()
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = (value: boolean) => {
    setOpenState(value)
    onOpenChange?.(value)
  }
  const [step, setStep] = useState<'upload' | 'mapping' | 'review'>('upload')
  const [useAI, setUseAI] = useState(false)
  const [processedWithAI, setProcessedWithAI] = useState(false)
  const [warnings, setWarnings] = useState<string[]>([])
  const [sheets, setSheets] = useState<ImportSheet[]>([])
  const [sheetIndex, setSheetIndex] = useState(0)
  const [nameColumn, setNameColumn] = useState(0)
  const [amountColumn, setAmountColumn] = useState(1)
  const [hasHeader, setHasHeader] = useState(true)
  const [parsing, setParsing] = useState(false)
  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [paymentMonth, setPaymentMonth] = useState<MonthYear | null>(null)
  const paymentPeriod = paymentMonth ?? selected
  const paymentDate = fifthBusinessDayISO(paymentPeriod.year, paymentPeriod.month)
  const paymentDateLabel = paymentDate.split('-').reverse().join('/')
  const sameBoardMonth = paymentPeriod.month === selected.month && paymentPeriod.year === selected.year
  const boardPeriodKey = `${paymentPeriod.year}-${paymentPeriod.month}`
  const [periodBoards, setPeriodBoards] = useState<{ key: string; boards: Board[]; error: string } | null>(null)
  const [boardsRetry, setBoardsRetry] = useState(0)
  const boardsRequest = useRef(0)
  const boardOptions = sameBoardMonth ? boards : periodBoards?.key === boardPeriodKey ? periodBoards.boards : []
  const loadingBoardOptions = !sameBoardMonth && periodBoards?.key !== boardPeriodKey
  const boardOptionsError = !sameBoardMonth && periodBoards?.key === boardPeriodKey ? periodBoards.error : ''
  const [destination, setDestination] = useState<string>(MAIN_PANEL_VALUE)
  const [newBoardName, setNewBoardName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [pdfPassword, setPdfPassword] = useState('')
  const inFlight = useRef(false)
  const processingFile = useRef(false)
  const createdBoard = useRef<{ key: string; id: string } | null>(null)
  const [duplicateReview, setDuplicateReview] = useState<{ key: string; draft: string; warnings: DuplicateWarning[] } | null>(null)
  const [acceptedDuplicates, setAcceptedDuplicates] = useState('')
  const draftKey = JSON.stringify([rows, paymentDate, destination, newBoardName])

  useEffect(() => {
    const revision = ++boardsRequest.current
    if (!open || step !== 'review' || sameBoardMonth) return
    let active = true
    const key = `${paymentPeriod.year}-${paymentPeriod.month}`
    async function loadBoards() {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser()
        if (authError || !auth.user) throw new Error('session')
        const { data, error } = await supabase.from('boards').select('id,name')
          .eq('user_id', auth.user.id).eq('month', paymentPeriod.month).eq('year', paymentPeriod.year).order('name')
        if (error || !data) throw new Error('boards')
        if (active && revision === boardsRequest.current) setPeriodBoards({ key, boards: data, error: '' })
      } catch {
        if (active && revision === boardsRequest.current) setPeriodBoards({ key, boards: [], error: 'Não foi possível carregar os quadros deste mês. Tente novamente.' })
      }
    }
    void loadBoards()
    return () => { active = false }
  }, [open, step, sameBoardMonth, paymentPeriod.month, paymentPeriod.year, supabase, boardsRetry])

  async function processFile(file: File, password?: string) {
    if (processingFile.current) return
    processingFile.current = true
    setParsing(true)
    setProcessedWithAI(false)
    setError('')

    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error("O arquivo deve ter no máximo 3 MB.")
      if (/\.(xlsx|csv)$/i.test(file.name)) {
        const loaded = await readSpreadsheet(file)
        if (!loaded.length) throw new Error("A planilha está vazia.")
        setSheets(loaded)
        selectSheet(0, loaded)
        setWarnings([])
        setNeedsPassword(false)
        setStep('mapping')
        return
      }
      const isImage = /\.(jpe?g|png|webp)$/i.test(file.name)
      if (!isImage && !/\.pdf$/i.test(file.name)) throw new Error("Selecione PDF, Excel, CSV ou imagem JPG, PNG ou WebP.")
      if (isImage && !useAI) throw new Error('Ative a leitura com IA antes de enviar uma imagem.')
      let parsed: InvoiceRow[]
      if (useAI) {
        if (categoriesLoading || categoriesError) throw new Error(categoriesError || 'Aguarde suas categorias carregarem e selecione o arquivo novamente.')
        const prepared = isImage ? file : await preparePdfForAI(file, password)
        setPdfPassword('')
        setNeedsPassword(false)
        setPendingFile(null)
        const form = new FormData()
        form.append('file', prepared)
        const response = await fetch('/api/invoices/analyze', { method: 'POST', body: form })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || "Não foi possível analisar a fatura.")
        const analyzed = validateAIInvoice(result, categories)
        parsed = analyzed.rows
        setWarnings(analyzed.warnings)
        setProcessedWithAI(true)
      } else {
        const text = await extractPdfText(file, password)
        parsed = parseInvoiceText(text, selected.year)
        setWarnings([])
      }
      if (parsed.length > MAX_IMPORT_ROWS) throw new Error(t('Importe no máximo {max} despesas por vez.', { max: MAX_IMPORT_ROWS }))

      if (parsed.length === 0) {
        setError(
          "Não conseguimos identificar despesas automaticamente neste arquivo. " +
          "Você pode adicionar linhas manualmente abaixo."
        )
      }

      setRows(parsed.map(({ nome, valor, category }) => ({ nome, valor, category: category ?? 'Sem categoria' })))
      setStep('review')
      setNeedsPassword(false)
      setPdfPassword('')
      setPendingFile(null)
    } catch (err) {
      if (err instanceof PdfPasswordRequiredError) {
        setNeedsPassword(true)
        setPendingFile(file)
        setPdfPassword('')
        if (password) setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : "Não foi possível ler este arquivo. Verifique o formato e tente novamente.")
      }
    } finally {
      processingFile.current = false
      setParsing(false)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setNeedsPassword(false)
    setPdfPassword('')
    setPendingFile(null)
    await processFile(file)
    e.target.value = ''
  }

  function selectSheet(index: number, loaded = sheets) {
    setSheetIndex(index)
    const suggested = suggestColumns(loaded[index].cells)
    setNameColumn(suggested.name)
    setAmountColumn(suggested.amount)
    setHasHeader(suggested.header)
  }

  function reviewSpreadsheet() {
    try {
      const result = mapSpreadsheet(sheets[sheetIndex].cells, nameColumn, amountColumn, hasHeader)
      if (!result.rows.length) throw new Error("Nenhuma despesa válida. Confira as colunas selecionadas.")
      setRows(result.rows)
      setWarnings(result.warnings)
      setError('')
      setStep('review')
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível ler as colunas.") }
  }

  async function handleSubmitPassword() {
    if (!pendingFile || !pdfPassword || parsing) return
    await processFile(pendingFile, pdfPassword)
  }

  function reset() {
    setDuplicateReview(null)
    setAcceptedDuplicates('')
    createdBoard.current = null
    setStep('upload')
    setRows([])
    setDestination(MAIN_PANEL_VALUE)
    setNewBoardName('')
    setError('')
    setPaymentMonth(null)
    setPeriodBoards(null)
    setPendingFile(null)
    setNeedsPassword(false)
    setPdfPassword('')
    setSheets([])
    setWarnings([])
    setUseAI(false)
  }

  function updateRow(index: number, field: keyof InvoiceRow, value: string) {
    setRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? { ...row, [field]: field === 'valor' ? parseFloat(value.replace(',', '.')) || 0 : value }
          : row
      )
    )
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  function addEmptyRow() {
    if (rows.length >= MAX_IMPORT_ROWS) return
    setRows((prev) => [...prev, { nome: '', valor: 0 }])
  }

  async function handleConfirm() {
    if (loadingBoardOptions || boardOptionsError) return
    if (destination !== MAIN_PANEL_VALUE && destination !== NEW_BOARD_VALUE && !boardOptions.some(board => board.id === destination)) return
    if (inFlight.current) return
    if (categoriesLoading || categoriesError || rows.some(row => !categories.includes(row.category ?? 'Sem categoria'))) {
      setError(categoriesError || "Escolha categorias disponíveis antes de importar.")
      return
    }
    const validRows = rows.filter((row) => row.nome.trim() && row.nome.length <= 200 && Number.isFinite(row.valor) && row.valor > 0 && row.valor <= 10000000)
    if (validRows.length === 0 || validRows.length !== rows.length || rows.length > MAX_IMPORT_ROWS) {
      setError("Corrija ou remova as linhas inválidas. Informe nome e valor maior que zero em todas as despesas.")
      return
    }
    if (destination === NEW_BOARD_VALUE && !newBoardName.trim()) {
      setError("Informe um nome para o novo quadro.")
      return
    }

    inFlight.current = true
    setSaving(true)
    setError('')

    try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError("Entre novamente para salvar as despesas.")
      setSaving(false)
      return
    }

    const candidates = validRows.map(row => ({ ...row, data_pagamento: paymentDate }))
    const duplicates = await checkExpenseDuplicates(supabase, user.id, candidates)
    const reviewKey = JSON.stringify([draftKey, duplicates])
    if (duplicates.length && acceptedDuplicates !== reviewKey) {
      setDuplicateReview({ key: reviewKey, draft: draftKey, warnings: duplicates })
      setAcceptedDuplicates('')
      setError("Revise as possíveis duplicidades abaixo antes de importar.")
      return
    }

    let targetBoardId: string | null = null

    if (destination === NEW_BOARD_VALUE) {
      const boardKey = JSON.stringify([user.id, newBoardName.trim(), paymentPeriod])
      if (createdBoard.current?.key === boardKey) {
        targetBoardId = createdBoard.current.id
      } else {
      const { data: newBoard, error: boardError } = await supabase
        .from('boards')
        .insert({
          name: newBoardName.trim(),
          user_id: user?.id,
          month: paymentPeriod.month,
          year: paymentPeriod.year,
        })
        .select('id')
        .single()

      if (boardError || !newBoard) {
        console.error('Erro ao criar quadro:', boardError)
        setError("Não foi possível criar o novo quadro.")
        setSaving(false)
        return
      }
      targetBoardId = newBoard.id
      createdBoard.current = { key: boardKey, id: newBoard.id }
      }
    } else if (destination !== MAIN_PANEL_VALUE) {
      targetBoardId = destination
    }

    const payload = validRows
      .map((r) => ({
        nome: r.nome.trim(),
        data_pagamento: paymentDate,
        valor: r.valor,
        category: r.category ?? 'Sem categoria',
        status: 'Pendente' as const,
        comentario: null,
        user_id: user?.id,
        board_id: targetBoardId,
      }))

    const { error: insertError } = await supabase.from('expenses').insert(payload)

    setSaving(false)

    if (insertError) {
      console.error('Erro ao importar despesas:', insertError)
      setError("Não foi possível salvar as despesas. Tente novamente.")
      return
    }

    setOpen(false)
    reset()
    onImported(paymentPeriod)
    } catch {
      setError("Não foi possível salvar as despesas. Verifique sua conexão e tente novamente.")
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (parsing || inFlight.current) return
        setOpen(isOpen)
        if (!isOpen) reset()
      }}
    >
      {!hideTrigger && (
  <DialogTrigger
    render={
      <Button variant="outline" size="sm">
        <Upload className="h-4 w-4 mr-1" />{t("Importar fatura ")}</Button>
    }
  />
)}
      <DialogContent className={step === 'review' ? 'invoice-review-dialog' : 'max-h-[90dvh] overflow-y-auto max-w-2xl sm:max-w-2xl'}>
        <DialogHeader>
          <DialogTitle>{t("Importar fatura, planilha ou imagem")}</DialogTitle>
          <DialogDescription>{t("Confira os nomes, valores e o mês de pagamento antes de importar.")}</DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <Label htmlFor="invoice-pdf">{t("Selecione PDF, Excel, CSV ou imagem")}</Label>
            <Input
              id="invoice-pdf"
              type="file"
              accept=".pdf,.xlsx,.csv,.jpg,.jpeg,.png,.webp,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              disabled={parsing || (useAI && (categoriesLoading || !!categoriesError))}
            />
            <p className="text-sm text-muted-foreground">{t("Até 3 MB e 500 despesas por importação. PDFs e imagens compartilham a cota de 4 análises com IA por mês. A leitura padrão e as planilhas não usam essa cota. No Google Planilhas, baixe como Excel ou CSV.")}</p>
            <label className="flex items-start gap-3 rounded-2xl border p-4 text-sm">
              <input type="checkbox" checked={useAI} disabled={parsing || needsPassword} onChange={(event) => setUseAI(event.target.checked)} className="mt-1" />
              <span><span className="font-medium">{t("Ler PDF ou imagem com inteligência artificial")}</span><span className="mt-1 block text-muted-foreground">{t("Ao ativar a IA, o PDF ou a imagem será enviado à OpenAI para análise. PDFs com senha são abertos no navegador; a senha não é enviada. Até 20 páginas por PDF. Planilhas são lidas sem IA.")}</span></span>
            </label>
            {useAI && <div className="rounded-xl border border-border bg-muted/50 p-3 text-sm" aria-live="polite" aria-busy={categoriesLoading || parsing}>
              {parsing || categoriesLoading ? <p role="status" className="flex items-center gap-2 text-muted-foreground">
                <LoaderCircle className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                {parsing ? t('Analisando o arquivo...') : t('Preparando a IA e carregando suas categorias...')}
              </p> : categoriesError ? <div className="space-y-2">
                <p role="alert" className="text-destructive">{t(categoriesError)}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => retryCategories?.()}>{t('Tentar novamente')}</Button>
              </div> : <p role="status" className="text-primary">{t('IA pronta. Selecione seu PDF ou imagem para analisar.')}</p>}
            </div>}
            <p className="text-sm text-muted-foreground">{t('Imagens: JPG, PNG ou WebP de notificações de cartão, comprovantes de maquininha ou cupons fiscais. Envie uma imagem nítida por vez e ative a IA. Cada comprovante gera uma despesa pelo total, sem detalhar produtos. Recorte dados pessoais desnecessários e revise tudo antes de salvar.')}</p>
            {parsing && !useAI && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{t("Lendo o arquivo...")}</p>}

            {needsPassword && (
              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="pdf-password">{t("Este PDF está protegido. Digite a senha:")}</Label>
                <p className="text-sm text-muted-foreground">{t("A senha é usada apenas para abrir o PDF no seu navegador. Nada é importado antes da revisão.")}</p>
                <div className="flex gap-2">
                  <Input
                    id="pdf-password"
                    type="password"
                    autoComplete="off"
                    disabled={parsing}
                    value={pdfPassword}
                    onChange={(e) => setPdfPassword(e.target.value)}
                  />
                  <Button onClick={handleSubmitPassword} disabled={parsing || !pdfPassword}>{t("Confirmar")}</Button>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{t(error)}</p>}
          </div>
        )}

        {step === 'mapping' && <div className="space-y-4 py-4">
          <div className="space-y-2"><Label htmlFor="import-sheet">{t("Aba da planilha")}</Label>
            <select id="import-sheet" className="w-full rounded-xl border bg-background p-3" value={sheetIndex} onChange={(event) => selectSheet(Number(event.target.value))}>
              {sheets.map((sheet, index) => <option key={index} value={index}>{sheet.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hasHeader} onChange={(event) => setHasHeader(event.target.checked)} />{t("A primeira linha contém os títulos das colunas")}</label>
          <div className="grid gap-4 sm:grid-cols-2">
            {([{ label: t("Coluna do nome"), id: 'import-name-column', value: nameColumn, update: setNameColumn }, { label: t("Coluna do valor"), id: 'import-amount-column', value: amountColumn, update: setAmountColumn }]).map((field) => <div key={field.id} className="space-y-2">
              <Label htmlFor={field.id}>{t(field.label)}</Label>
              <select id={field.id} className="w-full rounded-xl border bg-background p-3" value={field.value} onChange={(event) => field.update(Number(event.target.value))}>
                {Array.from({ length: Math.max(...sheets[sheetIndex].cells.map((cell) => cell.length)) }, (_, index) => <option key={index} value={index}>{t("Coluna ")}{index + 1}{hasHeader ? ` — ${sheets[sheetIndex].cells[0]?.[index] || t("Sem título")}` : ''}</option>)}
              </select>
            </div>)}
          </div>
          <div className="max-h-48 overflow-auto rounded-xl border"><Table><TableHeader><TableRow>{sheets[sheetIndex].cells[0]?.map((_, index) => <TableHead key={index}>{t("Coluna ")}{index + 1}</TableHead>)}</TableRow></TableHeader><TableBody>{sheets[sheetIndex].cells.slice(0, 5).map((cell, index) => <TableRow key={index}>{cell.map((value, column) => <TableCell key={column}>{value}</TableCell>)}</TableRow>)}</TableBody></Table></div>
          {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
          <Button onClick={reviewSpreadsheet}>{t("Conferir despesas")}</Button>
        </div>}

        {step === 'review' && (
          <div className="invoice-review-body flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            {duplicateReview?.draft === draftKey && <DuplicateExpenseNotice warnings={duplicateReview.warnings} confirmed={acceptedDuplicates === duplicateReview.key} onConfirm={value => setAcceptedDuplicates(value ? duplicateReview.key : '')} />}
            {error && <p className="text-sm text-red-600">{t(error)}</p>}
            {warnings.length > 0 && <details className="rounded-xl border p-3 text-sm"><summary className="cursor-pointer font-medium">{warnings.length}{t(" aviso(s) na leitura — confira antes de importar")}</summary><ul className="mt-2 list-disc space-y-1 pl-5">{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
            <p className="text-sm font-medium">{t("Total das despesas: ")}{rows.reduce((sum, row) => sum + row.valor, 0).toLocaleString(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })}{t(". Confira com a fatura; créditos e estornos não são importados como despesas.")}</p>
            {processedWithAI && <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{t("A IA sugeriu categorias da sua conta. Confira e altere antes de importar. Descrições incertas ficam em “Sem categoria”.")}</p>}

            <div className="flex flex-wrap items-end gap-4 rounded-2xl bg-muted p-4">
              <div className="space-y-2">
                <Label htmlFor="invoice-payment-month">{t("Mês de pagamento")}</Label>
                <Input
                  id="invoice-payment-month"
                  type="month"
                  value={`${paymentPeriod.year}-${String(paymentPeriod.month + 1).padStart(2, '0')}`}
                  disabled={saving}
                  onChange={(event) => {
                    const match = /^(\d{4})-(\d{2})$/.exec(event.target.value)
                    if (!match) return
                    const year = Number(match[1])
                    const month = Number(match[2]) - 1
                    if (year < 1 || month < 0 || month > 11) return
                    setPaymentMonth({ year, month })
                    if (destination !== MAIN_PANEL_VALUE && destination !== NEW_BOARD_VALUE) {
                      setDestination(MAIN_PANEL_VALUE)
                    }
                  }}
                />
              </div>
              <div className="space-y-1 text-sm">
                <p className="font-medium">{t("Pagamento em ")}<time dateTime={paymentDate}>{paymentDateLabel}</time></p>
                <p className="text-muted-foreground">{t("Todas as despesas serão pagas no quinto dia útil do mês escolhido.")}</p>
                <p className="text-muted-foreground">{t("Consideramos segunda a sexta, sem feriados.")}</p>
              </div>
            </div>

            <div className="invoice-review-table min-h-48 flex-1 overflow-auto rounded-2xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[240px]">{t("Nome")}</TableHead>
                    <TableHead className="w-[160px]">{t("Pagamento")}</TableHead>
                    <TableHead className="w-[160px]">{t("Valor")}{` (${currency})`}</TableHead>
                    <TableHead className="min-w-[180px]">{t("Categoria")}</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          value={row.nome}
                          onChange={(e) => updateRow(index, 'nome', e.target.value)}
                          className="h-8"
                          aria-label={t('Nome da despesa {number}', { number: index + 1 })}
                          disabled={saving}
                        />
                      </TableCell>
                      <TableCell>
                        <time dateTime={paymentDate}>{paymentDateLabel}</time>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={row.valor}
                          onChange={(e) => updateRow(index, 'valor', e.target.value)}
                          className="h-8"
                          aria-label={t('Valor da despesa {number}', { number: index + 1 })}
                          disabled={saving}
                        />
                      </TableCell>
                      <TableCell><select aria-label={t('Categoria da despesa {number}', { number: index + 1 })} value={row.category ?? "Sem categoria"} disabled={saving || categoriesLoading || !!categoriesError} onChange={event => updateRow(index, 'category', event.target.value)} className="w-full rounded-lg border bg-background p-2">{categories.map(category => <option key={category} value={category}>{category === 'Sem categoria' ? t(category) : category}</option>)}</select></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => removeRow(index)} disabled={saving} aria-label={t('Remover despesa {number}', { number: index + 1 })}>
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button variant="outline" size="sm" onClick={addEmptyRow} disabled={saving || rows.length >= MAX_IMPORT_ROWS} className="self-start">{t("Adicionar linha manualmente")}</Button>

            <div className="space-y-2 pt-2 border-t">
              <Label>{t("Adicionar despesas em:")}</Label>
              <Select value={destination} onValueChange={(value) => setDestination(value ?? MAIN_PANEL_VALUE)} disabled={saving || loadingBoardOptions || !!boardOptionsError}>
                <SelectTrigger>
                  <SelectValue>{destination === MAIN_PANEL_VALUE ? t("Painel principal") : destination === NEW_BOARD_VALUE ? t("+ Criar novo quadro") : boardOptions.find((board) => board.id === destination)?.name}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MAIN_PANEL_VALUE}>{t("Painel principal")}</SelectItem>
                  {boardOptions.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_BOARD_VALUE}>{t("+ Criar novo quadro")}</SelectItem>
                </SelectContent>
              </Select>
              {loadingBoardOptions && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{t('Carregando os quadros do mês selecionado...')}</p>}
              {boardOptionsError && <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{t(boardOptionsError)}</p><Button variant="outline" size="sm" onClick={() => { setPeriodBoards(null); setBoardsRetry(value => value + 1) }}>{t('Tentar novamente')}</Button></div>}

              {destination === NEW_BOARD_VALUE && (
                <Input
                  placeholder={t("Nome do novo quadro")}
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  disabled={saving}
                />
              )}
            </div>
          </div>
        )}

        <DialogFooter className="shrink-0">
          {step !== 'upload' && <Button variant="outline" disabled={saving || parsing} onClick={reset}>{t("Escolher outro arquivo")}</Button>}
          {step === 'review' && (
            <Button onClick={handleConfirm} disabled={saving || loadingBoardOptions || !!boardOptionsError}>
              {saving ? t('Importando...') : t('Importar {count} despesa(s)', { count: rows.length })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
