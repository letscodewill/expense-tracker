'use client'
import { extractPdfText, PdfPasswordRequiredError } from '@/lib/pdf-text-extract'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseInvoiceText, type ParsedExpense } from '@/lib/invoice-parser'
import { fifthBusinessDayISO } from '@/lib/payment-date'
import { readSpreadsheet, suggestColumns, mapSpreadsheet, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, type ImportSheet } from '@/lib/spreadsheet-import'
import { validateAIInvoice } from '@/lib/invoice-ai'
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
import { Upload, X } from 'lucide-react'
import type { MonthYear } from '@/components/month-year-picker'

type Board = { id: string; name: string }
type InvoiceRow = Pick<ParsedExpense, 'nome' | 'valor'>

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
  const supabase = createClient()
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = (value: boolean) => {
    setOpenState(value)
    onOpenChange?.(value)
  }
  const [step, setStep] = useState<'upload' | 'mapping' | 'review'>('upload')
  const [useAI, setUseAI] = useState(false)
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
  const [destination, setDestination] = useState<string>(MAIN_PANEL_VALUE)
  const [newBoardName, setNewBoardName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [pdfPassword, setPdfPassword] = useState('')

  async function processFile(file: File, password?: string) {
    setParsing(true)
    setError('')

    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('O arquivo deve ter no máximo 3 MB.')
      if (/\.(xlsx|csv)$/i.test(file.name)) {
        const loaded = await readSpreadsheet(file)
        if (!loaded.length) throw new Error('A planilha está vazia.')
        setSheets(loaded)
        selectSheet(0, loaded)
        setWarnings([])
        setNeedsPassword(false)
        setStep('mapping')
        return
      }
      if (!/\.pdf$/i.test(file.name)) throw new Error('Selecione um arquivo PDF, Excel (.xlsx) ou CSV.')
      let parsed: InvoiceRow[]
      if (useAI) {
        const form = new FormData()
        form.append('file', file)
        const response = await fetch('/api/invoices/analyze', { method: 'POST', body: form })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Não foi possível analisar a fatura.')
        const analyzed = validateAIInvoice(result)
        parsed = analyzed.rows
        setWarnings(analyzed.warnings)
      } else {
        const text = await extractPdfText(file, password)
        parsed = parseInvoiceText(text, selected.year)
        setWarnings([])
      }
      if (parsed.length > MAX_IMPORT_ROWS) throw new Error(`Importe no máximo ${MAX_IMPORT_ROWS} despesas por vez.`)

      if (parsed.length === 0) {
        setError(
          'Não conseguimos identificar despesas automaticamente neste PDF. ' +
          'Você pode adicionar linhas manualmente abaixo.'
        )
      }

      setRows(parsed.map(({ nome, valor }) => ({ nome, valor })))
      setStep('review')
      setNeedsPassword(false)
    } catch (err) {
      if (err instanceof PdfPasswordRequiredError) {
        setNeedsPassword(true)
        setPendingFile(file)
      } else {
        setError(err instanceof Error ? err.message : 'Não foi possível ler este arquivo. Verifique o formato e tente novamente.')
      }
    } finally {
      setParsing(false)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
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
      if (!result.rows.length) throw new Error('Nenhuma despesa válida. Confira as colunas selecionadas.')
      setRows(result.rows)
      setWarnings(result.warnings)
      setError('')
      setStep('review')
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível ler as colunas.') }
  }

  async function handleSubmitPassword() {
    if (!pendingFile) return
    await processFile(pendingFile, pdfPassword)
  }

  function reset() {
    setStep('upload')
    setRows([])
    setDestination(MAIN_PANEL_VALUE)
    setNewBoardName('')
    setError('')
    setPaymentMonth(null)
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
    if (saving) return
    const validRows = rows.filter((row) => row.nome.trim() && row.nome.length <= 200 && Number.isFinite(row.valor) && row.valor > 0 && row.valor <= 10000000)
    if (validRows.length === 0 || validRows.length !== rows.length || rows.length > MAX_IMPORT_ROWS) {
      setError('Corrija ou remova as linhas inválidas. Informe nome e valor maior que zero em todas as despesas.')
      return
    }
    if (destination === NEW_BOARD_VALUE && !newBoardName.trim()) {
      setError('Informe um nome para o novo quadro.')
      return
    }

    setSaving(true)
    setError('')

    try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Entre novamente para salvar as despesas.')
      setSaving(false)
      return
    }

    let targetBoardId: string | null = null

    if (destination === NEW_BOARD_VALUE) {
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
        setError('Não foi possível criar o novo quadro.')
        setSaving(false)
        return
      }
      targetBoardId = newBoard.id
    } else if (destination !== MAIN_PANEL_VALUE) {
      targetBoardId = destination
    }

    const payload = validRows
      .map((r) => ({
        nome: r.nome.trim(),
        data_pagamento: paymentDate,
        valor: r.valor,
        status: 'Pendente' as const,
        comentario: null,
        user_id: user?.id,
        board_id: targetBoardId,
      }))

    const { error: insertError } = await supabase.from('expenses').insert(payload)

    setSaving(false)

    if (insertError) {
      console.error('Erro ao importar despesas:', insertError)
      setError('Não foi possível salvar as despesas. Tente novamente.')
      return
    }

    setOpen(false)
    reset()
    onImported(paymentPeriod)
    } catch {
      setError('Não foi possível salvar as despesas. Verifique sua conexão e tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (parsing || saving) return
        setOpen(isOpen)
        if (!isOpen) reset()
      }}
    >
      {!hideTrigger && (
  <DialogTrigger
    render={
      <Button variant="outline" size="sm">
        <Upload className="h-4 w-4 mr-1" />
        Importar fatura
      </Button>
    }
  />
)}
      <DialogContent className={step === 'review' ? 'invoice-review-dialog' : 'max-h-[90dvh] overflow-y-auto max-w-2xl sm:max-w-2xl'}>
        <DialogHeader>
          <DialogTitle>Importar fatura ou planilha</DialogTitle>
          <DialogDescription>Confira os nomes, valores e o mês de pagamento antes de importar.</DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <Label htmlFor="invoice-pdf">Selecione um PDF, Excel (.xlsx) ou CSV</Label>
            <Input
              id="invoice-pdf"
              type="file"
              accept=".pdf,.xlsx,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={handleFileChange}
              disabled={parsing}
            />
            <p className="text-sm text-muted-foreground">Até 3 MB e 500 despesas por importação. No Google Planilhas, use Arquivo → Fazer download → Microsoft Excel ou CSV.</p>
            <label className="flex items-start gap-3 rounded-2xl border p-4 text-sm">
              <input type="checkbox" checked={useAI} disabled={parsing || needsPassword} onChange={(event) => setUseAI(event.target.checked)} className="mt-1" />
              <span><span className="font-medium">Ler PDF com inteligência artificial</span><span className="mt-1 block text-muted-foreground">Ao selecionar esta opção e enviar um PDF, o arquivo será enviado à OpenAI para análise. A disponibilidade depende da configuração do sistema. Planilhas são lidas sem IA. Para PDFs com senha, use a leitura padrão ou envie uma cópia desbloqueada.</span></span>
            </label>
            {parsing && <p role="status" className="text-sm text-muted-foreground">{useAI ? 'Analisando o arquivo...' : 'Lendo o arquivo...'}</p>}

            {needsPassword && (
              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="pdf-password">Este PDF está protegido. Digite a senha:</Label>
                <div className="flex gap-2">
                  <Input
                    id="pdf-password"
                    type="password"
                    value={pdfPassword}
                    onChange={(e) => setPdfPassword(e.target.value)}
                  />
                  <Button onClick={handleSubmitPassword} disabled={parsing}>
                    Confirmar
                  </Button>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        {step === 'mapping' && <div className="space-y-4 py-4">
          <div className="space-y-2"><Label htmlFor="import-sheet">Aba da planilha</Label>
            <select id="import-sheet" className="w-full rounded-xl border bg-background p-3" value={sheetIndex} onChange={(event) => selectSheet(Number(event.target.value))}>
              {sheets.map((sheet, index) => <option key={index} value={index}>{sheet.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hasHeader} onChange={(event) => setHasHeader(event.target.checked)} />A primeira linha contém os títulos das colunas</label>
          <div className="grid gap-4 sm:grid-cols-2">
            {([{ label: 'Coluna do nome', id: 'import-name-column', value: nameColumn, update: setNameColumn }, { label: 'Coluna do valor', id: 'import-amount-column', value: amountColumn, update: setAmountColumn }]).map((field) => <div key={field.id} className="space-y-2">
              <Label htmlFor={field.id}>{field.label}</Label>
              <select id={field.id} className="w-full rounded-xl border bg-background p-3" value={field.value} onChange={(event) => field.update(Number(event.target.value))}>
                {Array.from({ length: Math.max(...sheets[sheetIndex].cells.map((cell) => cell.length)) }, (_, index) => <option key={index} value={index}>Coluna {index + 1}{hasHeader ? ` — ${sheets[sheetIndex].cells[0]?.[index] || 'Sem título'}` : ''}</option>)}
              </select>
            </div>)}
          </div>
          <div className="max-h-48 overflow-auto rounded-xl border"><Table><TableHeader><TableRow>{sheets[sheetIndex].cells[0]?.map((_, index) => <TableHead key={index}>Coluna {index + 1}</TableHead>)}</TableRow></TableHeader><TableBody>{sheets[sheetIndex].cells.slice(0, 5).map((cell, index) => <TableRow key={index}>{cell.map((value, column) => <TableCell key={column}>{value}</TableCell>)}</TableRow>)}</TableBody></Table></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button onClick={reviewSpreadsheet}>Conferir despesas</Button>
        </div>}

        {step === 'review' && (
          <div className="invoice-review-body flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            {error && <p className="text-sm text-red-600">{error}</p>}
            {warnings.length > 0 && <details className="rounded-xl border p-3 text-sm"><summary className="cursor-pointer font-medium">{warnings.length} aviso(s) na leitura — confira antes de importar</summary><ul className="mt-2 list-disc space-y-1 pl-5">{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
            <p className="text-sm font-medium">Total das despesas: {rows.reduce((sum, row) => sum + row.valor, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Confira com a fatura; créditos e estornos não são importados como despesas.</p>

            <div className="flex flex-wrap items-end gap-4 rounded-2xl bg-muted p-4">
              <div className="space-y-2">
                <Label htmlFor="invoice-payment-month">Mês de pagamento</Label>
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
                <p className="font-medium">Pagamento em <time dateTime={paymentDate}>{paymentDateLabel}</time></p>
                <p className="text-muted-foreground">Todas as despesas serão pagas no quinto dia útil do mês escolhido.</p>
                <p className="text-muted-foreground">Consideramos segunda a sexta, sem feriados.</p>
              </div>
            </div>

            <div className="invoice-review-table min-h-48 flex-1 overflow-auto rounded-2xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[240px]">Nome</TableHead>
                    <TableHead className="w-[160px]">Pagamento</TableHead>
                    <TableHead className="w-[160px]">Valor (R$)</TableHead>
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
                          aria-label={`Nome da despesa ${index + 1}`}
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
                          aria-label={`Valor da despesa ${index + 1}`}
                          disabled={saving}
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => removeRow(index)} disabled={saving} aria-label={`Remover despesa ${index + 1}`}>
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button variant="outline" size="sm" onClick={addEmptyRow} disabled={saving || rows.length >= MAX_IMPORT_ROWS} className="self-start">
              Adicionar linha manualmente
            </Button>

            <div className="space-y-2 pt-2 border-t">
              <Label>Adicionar despesas em:</Label>
              <Select value={destination} onValueChange={(value) => setDestination(value ?? MAIN_PANEL_VALUE)} disabled={saving}>
                <SelectTrigger>
                  <SelectValue>{destination === MAIN_PANEL_VALUE ? 'Painel principal' : destination === NEW_BOARD_VALUE ? '+ Criar novo quadro' : boards.find((board) => board.id === destination)?.name}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MAIN_PANEL_VALUE}>Painel principal</SelectItem>
                  {sameBoardMonth && boards.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_BOARD_VALUE}>+ Criar novo quadro</SelectItem>
                </SelectContent>
              </Select>

              {destination === NEW_BOARD_VALUE && (
                <Input
                  placeholder="Nome do novo quadro"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  disabled={saving}
                />
              )}
            </div>
          </div>
        )}

        <DialogFooter className="shrink-0">
          {step !== 'upload' && <Button variant="outline" disabled={saving || parsing} onClick={reset}>Escolher outro arquivo</Button>}
          {step === 'review' && (
            <Button onClick={handleConfirm} disabled={saving}>
              {saving ? 'Importando...' : `Importar ${rows.length} despesa(s)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
