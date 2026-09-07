'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Download } from 'lucide-react'

type CheckboxProps = {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
}

function Checkbox({ checked = false, onCheckedChange }: CheckboxProps) {
    return (
        <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onCheckedChange?.(event.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
        />
    )
}

type Expense = {
    id: number
    nome: string
    data_pagamento: string
    valor: number
    status: 'Pendente' | 'Pago' | 'VR/VA'
    comentario: string | null
}

type ExpenseStatus = Expense['status']
const ALL_STATUSES: ExpenseStatus[] = ['Pendente', 'Pago', 'VR/VA']

const statusColor: Record<ExpenseStatus, string> = {
    Pendente: 'bg-yellow-500',
    Pago: 'bg-green-500',
    'VR/VA': 'bg-blue-500',
}

function parseISODate(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d)
}

function todayISO(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function firstDayOfMonthISO(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

export function ReportsView() {
    const supabase = createClient()

    const [from, setFrom] = useState(firstDayOfMonthISO())
    const [to, setTo] = useState(todayISO())
    const [search, setSearch] = useState('')
    const [statuses, setStatuses] = useState<ExpenseStatus[]>([])
    const [minValue, setMinValue] = useState('')
    const [maxValue, setMaxValue] = useState('')

    const [expenses, setExpenses] = useState<Expense[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [hasSearched, setHasSearched] = useState(false)

    function toggleStatus(status: ExpenseStatus) {
        setStatuses((prev) =>
            prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
        )
    }

    const handleSearch = useCallback(async () => {
        if (!from || !to) {
            setError('Selecione as duas datas do período.')
            return
        }
        if (from > to) {
            setError('A data inicial precisa ser anterior à data final.')
            return
        }

        setLoading(true)
        setError('')
        setHasSearched(true)

        const { data, error: fetchError } = await supabase
            .from('expenses')
            .select('*')
            .is('board_id', null)
            .gte('data_pagamento', from)
            .lte('data_pagamento', to)
            .order('data_pagamento', { ascending: true })

        setLoading(false)

        if (fetchError) {
            console.error('Erro ao buscar relatório:', fetchError)
            setError('Não foi possível carregar os dados. Tente novamente.')
            return
        }

        setExpenses(data ?? [])
    }, [supabase, from, to])

    const filtered = expenses.filter((e) => {
        if (search.trim() && !e.nome.toLowerCase().includes(search.trim().toLowerCase())) {
            return false
        }
        if (statuses.length > 0 && !statuses.includes(e.status)) {
            return false
        }
        const min = parseFloat(minValue)
        const max = parseFloat(maxValue)
        if (!isNaN(min) && e.valor < min) return false
        if (!isNaN(max) && e.valor > max) return false
        return true
    })

    const total = filtered.reduce((sum, e) => sum + e.valor, 0)
    const totalPago = filtered.reduce((sum, e) => sum + (e.status === 'Pago' ? e.valor : 0), 0)
    const totalPendente = filtered.reduce((sum, e) => sum + (e.status !== 'Pago' ? e.valor : 0), 0)

    function handleExportPdf() {
        const doc = new jsPDF()

        doc.setFontSize(16)
        doc.text('Relatório de Despesas', 14, 18)

        doc.setFontSize(10)
        doc.setTextColor(100)
        const fromLabel = parseISODate(from).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
        const toLabel = parseISODate(to).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
        doc.text(`Período: ${fromLabel} até ${toLabel}`, 14, 25)

        autoTable(doc, {
            startY: 32,
            head: [['Nome', 'Data', 'Valor', 'Status', 'Comentário']],
            body: filtered.map((e) => [
                e.nome,
                parseISODate(e.data_pagamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
                e.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                e.status,
                e.comentario ?? '',
            ]),
            styles: { fontSize: 9 },
            headStyles: { fillColor: [40, 40, 40] },
        })

        const finalY = (doc as any).lastAutoTable.finalY + 10

        doc.setFontSize(11)
        doc.setTextColor(0)
        doc.text(
            `Total do período: ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
            14,
            finalY
        )
        doc.text(
            `Total pago: ${totalPago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
            14,
            finalY + 6
        )
        doc.text(
            `Total pendente: ${totalPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
            14,
            finalY + 12
        )

        doc.save(`relatorio-${from}-a-${to}.pdf`)
    }

    return (
        <div className="space-y-6">
            <div className="rounded-xl border p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="report-from">De</Label>
                        <Input
                            id="report-from"
                            type="date"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="report-to">Até</Label>
                        <Input
                            id="report-to"
                            type="date"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="report-search">Buscar por nome</Label>
                    <Input
                        id="report-search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Ex: Netflix"
                    />
                </div>

                <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="flex flex-wrap gap-4">
                        {ALL_STATUSES.map((status) => (
                            <label key={status} className="flex items-center gap-2 text-sm">
                                <Checkbox
                                    checked={statuses.includes(status)}
                                    onCheckedChange={() => toggleStatus(status)}
                                />
                                {status}
                            </label>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Faixa de valor</Label>
                    <div className="flex items-center gap-2 max-w-sm">
                        <Input
                            type="number"
                            step="0.01"
                            placeholder="Mínimo"
                            value={minValue}
                            onChange={(e) => setMinValue(e.target.value)}
                        />
                        <span className="text-muted-foreground">até</span>
                        <Input
                            type="number"
                            step="0.01"
                            placeholder="Máximo"
                            value={maxValue}
                            onChange={(e) => setMaxValue(e.target.value)}
                        />
                    </div>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <Button onClick={handleSearch} disabled={loading}>
                    {loading ? 'Buscando...' : 'Buscar'}
                </Button>
            </div>

            {hasSearched && !loading && filtered.length > 0 && (
                <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={handleExportPdf}>
                        <Download className="h-4 w-4 mr-1" />
                        Exportar PDF
                    </Button>
                </div>
            )}

            {hasSearched && !loading && (
                <div className="rounded-xl border">
                    {filtered.length === 0 ? (
                        <p className="text-sm text-muted-foreground p-4">
                            Nenhuma despesa encontrada nesse período.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Valor</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Comentário</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map((expense) => (
                                        <TableRow key={expense.id}>
                                            <TableCell>{expense.nome}</TableCell>
                                            <TableCell>
                                                {parseISODate(expense.data_pagamento).toLocaleDateString('pt-BR', {
                                                    timeZone: 'UTC',
                                                })}
                                            </TableCell>
                                            <TableCell>
                                                {expense.valor.toLocaleString('pt-BR', {
                                                    style: 'currency',
                                                    currency: 'BRL',
                                                })}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={statusColor[expense.status]}>{expense.status}</Badge>
                                            </TableCell>
                                            <TableCell>{expense.comentario}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                <TableFooter>
                                    <TableRow>
                                        <TableCell colSpan={2}>Total do período</TableCell>
                                        <TableCell>
                                            {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </TableCell>
                                        <TableCell colSpan={2}></TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell colSpan={2}>Total pago</TableCell>
                                        <TableCell>
                                            {totalPago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </TableCell>
                                        <TableCell colSpan={2}></TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell colSpan={2}>Total pendente</TableCell>
                                        <TableCell>
                                            {totalPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </TableCell>
                                        <TableCell colSpan={2}></TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}