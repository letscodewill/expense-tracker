'use client'
import { extractPdfText, PdfPasswordRequiredError } from '@/lib/pdf-text-extract'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseInvoiceText, type ParsedExpense } from '@/lib/invoice-parser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

export type ImportInvoiceDialogProps = {
  selected: MonthYear
  boards: Board[]
  onImported: () => void
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
  const [step, setStep] = useState<'upload' | 'review'>('upload')
  const [parsing, setParsing] = useState(false)
  const [rows, setRows] = useState<ParsedExpense[]>([])
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
      const text = await extractPdfText(file, password)
      const parsed = parseInvoiceText(text, selected.year)

      if (parsed.length === 0) {
        setError(
          'Não conseguimos identificar despesas automaticamente neste PDF. ' +
          'Você pode adicionar linhas manualmente abaixo.'
        )
      }

      setRows(parsed)
      setStep('review')
      setNeedsPassword(false)
    } catch (err) {
      if (err instanceof PdfPasswordRequiredError) {
        setNeedsPassword(true)
        setPendingFile(file)
      } else {
        console.error('Erro ao processar PDF:', err)
        setError('Não foi possível ler este PDF. Verifique se o arquivo não está corrompido.')
      }
    } finally {
      setParsing(false)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await processFile(file)
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
  }

  function updateRow(index: number, field: keyof ParsedExpense, value: string) {
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
    const { month, year } = selected
    const fallbackDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
    setRows((prev) => [...prev, { nome: '', valor: 0, data: fallbackDate }])
  }

  async function handleConfirm() {
    if (rows.length === 0) {
      setError('Nenhuma despesa para importar.')
      return
    }
    if (destination === NEW_BOARD_VALUE && !newBoardName.trim()) {
      setError('Informe um nome para o novo quadro.')
      return
    }

    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()

    let targetBoardId: string | null = null

    if (destination === NEW_BOARD_VALUE) {
      const { data: newBoard, error: boardError } = await supabase
        .from('boards')
        .insert({
          name: newBoardName.trim(),
          user_id: user?.id,
          month: selected.month,
          year: selected.year,
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

    const payload = rows
      .filter((r) => r.nome.trim() && r.valor > 0)
      .map((r) => ({
        nome: r.nome.trim(),
        data_pagamento: r.data,
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
    onImported()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar fatura (PDF)</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <Label htmlFor="invoice-pdf">Selecione o PDF da fatura</Label>
            <Input
              id="invoice-pdf"
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              disabled={parsing}
            />
            {parsing && <p className="text-sm text-muted-foreground">Lendo o PDF...</p>}

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

        {step === 'review' && (
          <div className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="max-h-80 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-[110px]">Data</TableHead>
                    <TableHead className="w-[110px]">Valor</TableHead>
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
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={row.data}
                          onChange={(e) => updateRow(index, 'data', e.target.value)}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={row.valor}
                          onChange={(e) => updateRow(index, 'valor', e.target.value)}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => removeRow(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button variant="outline" size="sm" onClick={addEmptyRow}>
              Adicionar linha manualmente
            </Button>

            <div className="space-y-2 pt-2 border-t">
              <Label>Adicionar despesas em:</Label>
              <Select value={destination} onValueChange={(value) => setDestination(value ?? MAIN_PANEL_VALUE)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MAIN_PANEL_VALUE}>Painel principal</SelectItem>
                  {boards.map((b) => (
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
                />
              )}
            </div>
          </div>
        )}

        <DialogFooter>
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