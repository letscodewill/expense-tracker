'use client'

import { useCurrency } from '@/lib/use-currency'
import { useLanguage } from '@/components/language-provider'
import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Download } from 'lucide-react'
import { downloadReport, reportCsv, reportTxt, type ReportExport } from '@/lib/report-export'

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
    category: string
    represents_board_id: string | null
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
    return new Date(Date.UTC(y, m - 1, d))
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
  const { t, locale } = useLanguage()
  const currency = useCurrency()

    const supabase = createClient()

    const [from, setFrom] = useState(firstDayOfMonthISO())
    const [to, setTo] = useState(todayISO())
    const [search, setSearch] = useState('')
    const [statuses, setStatuses] = useState<ExpenseStatus[]>([])
    const [minValue, setMinValue] = useState('')
    const [maxValue, setMaxValue] = useState('')

    const [expenses, setExpenses] = useState<Expense[]>([])
    const [monthlyExpenses, setMonthlyExpenses] = useState<Expense[]>([])
    const [budgets, setBudgets] = useState<{ month: string; category: string; amount: number }[]>([])
    const [period, setPeriod] = useState({ from: '', to: '' })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [hasSearched, setHasSearched] = useState(false)
    const searching = useRef(false)
    const [exporting, setExporting] = useState(false)
    const exportingRef = useRef(false)
    const [exportError, setExportError] = useState('')

    function toggleStatus(status: ExpenseStatus) {
        setStatuses((prev) =>
            prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
        )
    }

    const handleSearch = useCallback(async () => {
        if (searching.current) return
        if (!from || !to) {
            setError("Selecione as duas datas do período.")
            return
        }
        if (from > to) {
            setError("A data inicial precisa ser anterior à data final.")
            return
        }

        searching.current = true
        setLoading(true)
        setError('')
        setHasSearched(false)
        try {
            const start = parseISODate(`${from.slice(0, 7)}-01`)
            start.setUTCMonth(start.getUTCMonth() - 1)
            const end = parseISODate(`${to.slice(0, 7)}-01`)
            end.setUTCMonth(end.getUTCMonth() + 1)
            const { data: auth, error: authError } = await supabase.auth.getUser()
            if (authError || !auth.user) throw new Error("Sessão indisponível")
            const rows: Expense[] = []
            const limits: { month: string; category: string; amount: number }[] = []
            for (let offset = 0; ; offset += 1000) {
                const { data, error } = await supabase.from('expenses').select('*')
                    .eq('user_id', auth.user.id).is('represents_board_id', null)
                    .gte('data_pagamento', start.toISOString().slice(0, 10))
                    .lt('data_pagamento', end.toISOString().slice(0, 10))
                    .order('data_pagamento', { ascending: true }).order('id', { ascending: true })
                    .range(offset, offset + 999)
                if (error) throw error
                rows.push(...(data ?? []))
                if (!data || data.length < 1000) break
            }
            for (let offset = 0; ; offset += 1000) {
                const { data, error } = await supabase.from('category_budgets').select('month,category,amount')
                    .eq('user_id', auth.user.id).gte('month', `${from.slice(0, 7)}-01`)
                    .lte('month', `${to.slice(0, 7)}-01`).order('month').order('category')
                    .range(offset, offset + 999)
                if (error) throw error
                limits.push(...(data ?? []))
                if (!data || data.length < 1000) break
            }
            setExpenses(rows.filter(row => row.data_pagamento >= from && row.data_pagamento <= to))
            setMonthlyExpenses(rows)
            setBudgets(limits)
            setPeriod({ from, to })
            setHasSearched(true)
        } catch {
            setError("Não foi possível carregar o relatório completo. Tente novamente.")
        } finally {
            searching.current = false
            setLoading(false)
        }
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

    const sumFiltered = (status?: ExpenseStatus) => filtered.reduce((sum, e) => sum + (!status || e.status === status ? Math.round(e.valor * 100) : 0), 0) / 100
    const total = sumFiltered()
    const totalPago = sumFiltered('Pago')
    const totalPendente = sumFiltered('Pendente')
    const totalBenefits = sumFiltered('VR/VA')
    const money = (value: number) => value.toLocaleString(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
    const summary: string[][] = []
    if (period.from) {
        const cursor = parseISODate(`${period.from.slice(0, 7)}-01`)
        while (cursor.toISOString().slice(0, 7) <= period.to.slice(0, 7)) {
            const month = cursor.toISOString().slice(0, 7)
            const previous = new Date(cursor)
            previous.setUTCMonth(previous.getUTCMonth() - 1)
            const previousMonth = previous.toISOString().slice(0, 7)
            const categories = new Set([
                ...monthlyExpenses.filter(row => row.data_pagamento.startsWith(month) || row.data_pagamento.startsWith(previousMonth)).map(row => row.category || 'Sem categoria'),
                ...budgets.filter(budget => budget.month.startsWith(month)).map(budget => budget.category),
            ])
            for (const category of [...categories].sort()) {
                const sum = (key: string) => monthlyExpenses.filter(row => !row.represents_board_id && row.data_pagamento.startsWith(key) && (row.category || 'Sem categoria') === category)
                    .reduce((total, row) => total + Math.round(row.valor * 100), 0) / 100
                const spent = sum(month), before = sum(previousMonth)
                const budget = budgets.find(item => item.month.startsWith(month) && item.category === category)
                const remaining = budget ? Number(budget.amount) - spent : null
                summary.push([`${month.slice(5)}/${month.slice(0, 4)}`, category === 'Sem categoria' ? t(category) : category, money(spent), budget ? money(Number(budget.amount)) : t('Não definido'),
                    remaining === null ? '—' : `${remaining < 0 ? t('Excedido: ') : t('Disponível: ')}${money(Math.abs(remaining))}`, money(before), money(spent - before)])
            }
            cursor.setUTCMonth(cursor.getUTCMonth() + 1)
        }
    }

    async function handleExportFile(format: 'txt' | 'csv' | 'xlsx') {
        if (exportingRef.current || !hasSearched || loading) return
        exportingRef.current = true
        setExporting(true)
        setExportError('')
        try {
            const report: ReportExport = {
                title: t('Relatório de Despesas'),
                period: `${period.from} — ${period.to}`,
                expenses: { title: t('Despesas'), headers: [t('Nome'), t('Data'), t('Categoria'), t('Valor'), t('Moeda'), t('Status'), t('Comentário')],
                    rows: filtered.map(e => [e.nome, e.data_pagamento, !e.category || e.category === 'Sem categoria' ? t('Sem categoria') : e.category, Math.round(Number(e.valor) * 100) / 100, currency, t(e.status), e.comentario ?? '']) },
                totals: { title: t('Resumo'), headers: [t('Descrição'), t('Valor'), t('Moeda')], rows: [[t('Total do período'), total, currency], [t('Total pago'), totalPago, currency], [t('VR/VA'), totalBenefits, currency], [t('Total pendente'), totalPendente, currency]] },
                budgets: { title: t('Orçamento e comparação mensal'), headers: [t('Mês'), t('Categoria'), t('Despesas'), t('Limite'), t('Saldo do orçamento'), t('Mês anterior'), t('Variação')], rows: summary },
                budgetNote: t('Meses completos; inclui Pago, Pendente e VR/VA. Independente dos filtros da lista. Variação em relação ao mês anterior.'),
            }
            const filename = `nocontrole-${period.from}-${period.to}.${format}`
            if (format === 'xlsx') {
                const { reportSpreadsheet } = await import('@/lib/report-spreadsheet')
                const bytes = await reportSpreadsheet(report)
                downloadReport(bytes as Uint8Array<ArrayBuffer>, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            } else downloadReport(format === 'csv' ? reportCsv(report, locale) : reportTxt(report), filename, `${format === 'csv' ? 'text/csv' : 'text/plain'};charset=utf-8`)
        } catch {
            setExportError('Não foi possível exportar o arquivo. Tente novamente.')
        } finally {
            exportingRef.current = false
            setExporting(false)
        }
    }

    function handleExportPdf() {
        const doc = new jsPDF({ orientation: 'landscape' })
        doc.setFontSize(16)
        doc.text(t("Relatório de Despesas"), 14, 18)
        doc.setFontSize(10)
        doc.text(t('Período: {from} até {to}', { from: parseISODate(period.from).toLocaleDateString(locale, { timeZone: 'UTC' }), to: parseISODate(period.to).toLocaleDateString(locale, { timeZone: 'UTC' }) }), 14, 25)
        autoTable(doc, {
            startY: 32,
            head: [[t("Nome"), t("Data"), t("Categoria"), t("Valor"), t("Status"), t("Comentário")]],
            body: filtered.map(e => [e.nome, parseISODate(e.data_pagamento).toLocaleDateString(locale, { timeZone: 'UTC' }), !e.category || e.category === 'Sem categoria' ? t('Sem categoria') : e.category, money(e.valor), t(e.status), e.comentario ?? '']),
            foot: [[t("Total do período"), '', '', money(total), '', ''], [t("Total pago"), '', '', money(totalPago), '', ''], [t("VR/VA"), '', '', money(totalBenefits), '', ''], [t("Total pendente"), '', '', money(totalPendente), '', '']],
            showFoot: 'lastPage',
            rowPageBreak: 'avoid',
            styles: { fontSize: 9, overflow: 'linebreak' },
            headStyles: { fillColor: [103, 80, 164] },
            footStyles: { fillColor: [240, 236, 248], textColor: [30, 30, 30] },
            margin: { top: 14, bottom: 18 },
        })
        doc.addPage()
        doc.setFontSize(16)
        doc.text(t("Orçamento e comparação mensal"), 14, 18)
        doc.setFontSize(9)
        doc.text(t("Meses completos; inclui Pago, Pendente e VR/VA. Independente dos filtros da lista. Variação em relação ao mês anterior."), 14, 25)
        autoTable(doc, {
            startY: 32,
            head: [[t("Mês"), t("Categoria"), t("Despesas"), t("Limite"), t("Saldo do orçamento"), t("Mês anterior"), t("Variação")]],
            body: summary.length ? summary : [['', t("Nenhum dado mensal encontrado"), '', '', '', '', '']],
            rowPageBreak: 'avoid',
            styles: { fontSize: 9, overflow: 'linebreak' },
            headStyles: { fillColor: [103, 80, 164] },
            margin: { top: 14, bottom: 18 },
        })
        const pages = doc.getNumberOfPages()
        for (let page = 1; page <= pages; page++) {
            doc.setPage(page)
            doc.setFontSize(8)
            doc.text(t('NoControle | Página {page} de {pages}', { page, pages }), 14, doc.internal.pageSize.getHeight() - 8)
        }
        doc.save(locale === 'en-US' ? `report-${period.from}-to-${period.to}.pdf` : locale === 'es-419' ? `informe-${period.from}-a-${period.to}.pdf` : `relatorio-${period.from}-a-${period.to}.pdf`)
    }

    return (
        <div className="space-y-6">
            <div className="rounded-xl border p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="report-from">{t("De")}</Label>
                        <Input
                            id="report-from"
                            type="date"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="report-to">{t("Até")}</Label>
                        <Input
                            id="report-to"
                            type="date"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="report-search">{t("Buscar por nome")}</Label>
                    <Input
                        id="report-search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t("Ex: Netflix")}
                    />
                </div>

                <div className="space-y-2">
                    <Label>{t("Status")}</Label>
                    <div className="flex flex-wrap gap-4">
                        {ALL_STATUSES.map((status) => (
                            <label key={t(status)} className="flex items-center gap-2 text-sm">
                                <Checkbox
                                    checked={statuses.includes(status)}
                                    onCheckedChange={() => toggleStatus(status)}
                                />
                                {t(status)}
                            </label>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>{t("Faixa de valor")}</Label>
                    <div className="flex items-center gap-2 max-w-sm">
                        <Input
                            type="number"
                            step="0.01"
                            placeholder={t("Mínimo")}
                            value={minValue}
                            onChange={(e) => setMinValue(e.target.value)}
                        />
                        <span className="text-muted-foreground">{t("até")}</span>
                        <Input
                            type="number"
                            step="0.01"
                            placeholder={t("Máximo")}
                            value={maxValue}
                            onChange={(e) => setMaxValue(e.target.value)}
                        />
                    </div>
                </div>

                {error && <p className="text-sm text-red-600">{t(error)}</p>}

                <Button onClick={handleSearch} disabled={loading}>
                    {loading ? t("Buscando...") : t("Buscar")}
                </Button>
            </div>

            {hasSearched && !loading && (
                <div className="flex flex-wrap items-center justify-end gap-3">
                    <p className="mr-auto text-sm text-muted-foreground">{t("Período carregado: ")}{parseISODate(period.from).toLocaleDateString(locale, { timeZone: 'UTC' })}{t(" até ")}{parseISODate(period.to).toLocaleDateString(locale, { timeZone: 'UTC' })}</p>
                    <Button variant="outline" size="sm" onClick={handleExportPdf}>
                        <Download className="h-4 w-4 mr-1" />{t("Exportar PDF ")}</Button>
                    {(['txt', 'csv', 'xlsx'] as const).map(format => <Button key={format} variant="outline" size="sm" disabled={exporting} onClick={() => handleExportFile(format)}>
                        <Download className="h-4 w-4 mr-1" />{format === 'xlsx' ? t('Exportar Excel') : format === 'csv' ? t('Exportar CSV') : t('Exportar TXT')}
                    </Button>)}
                    <p className="w-full text-sm text-muted-foreground">{t('A lista exportada respeita os filtros. TXT e Excel incluem totais e orçamento; CSV contém os lançamentos. A moeda é apenas de exibição, sem conversão.')}</p>
                    {exporting && <p role="status" className="w-full text-sm">{t('Exportando...')}</p>}
                    {exportError && <p role="alert" className="w-full text-sm text-destructive">{t(exportError)}</p>}
                </div>
            )}

            {hasSearched && !loading && (
                <section className="rounded-xl border p-4 space-y-3">
                    <h2 className="font-semibold">{t("Orçamento e comparação mensal")}</h2>
                    <p className="text-sm text-muted-foreground">{t("Meses completos, incluindo Pago, Pendente e VR/VA. Este resumo independe dos filtros da lista. A variação compara com o mês anterior.")}</p>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader><TableRow>{[t("Mês"), t("Categoria"), t("Despesas"), t("Limite"), t("Saldo do orçamento"), t("Mês anterior"), t("Variação")].map(label => <TableHead key={t(label)}>{t(label)}</TableHead>)}</TableRow></TableHeader>
                            <TableBody>{summary.map((row, index) => <TableRow key={index}>{row.map((value, column) => <TableCell key={column}>{value}</TableCell>)}</TableRow>)}</TableBody>
                        </Table>
                    </div>
                </section>
            )}
            {hasSearched && !loading && (
                <div className="rounded-xl border">
                    {filtered.length === 0 ? (
                        <p className="text-sm text-muted-foreground p-4">{t("Nenhuma despesa encontrada nesse período.")}</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t("Nome")}</TableHead>
                                        <TableHead>{t("Data")}</TableHead>
                                        <TableHead>{t("Categoria")}</TableHead>
                                        <TableHead>{t("Valor")}</TableHead>
                                        <TableHead>{t("Status")}</TableHead>
                                        <TableHead>{t("Comentário")}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map((expense) => (
                                        <TableRow key={expense.id}>
                                            <TableCell>{expense.nome}</TableCell>
                                            <TableCell>
                                                {parseISODate(expense.data_pagamento).toLocaleDateString(locale, {
                                                    timeZone: 'UTC',
                                                })}
                                            </TableCell>
                                            <TableCell>{!expense.category || expense.category === 'Sem categoria' ? t('Sem categoria') : expense.category}</TableCell>
                                            <TableCell>
                                                {expense.valor.toLocaleString(locale, {
                                                    style: 'currency',
                                                    currency,
                                                    currencyDisplay: 'narrowSymbol',
                                                })}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={statusColor[expense.status]}>{t(expense.status)}</Badge>
                                            </TableCell>
                                            <TableCell>{expense.comentario}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                <TableFooter>
                                    <TableRow><TableCell colSpan={3}>{t("VR/VA")}</TableCell><TableCell>{money(totalBenefits)}</TableCell><TableCell colSpan={2}></TableCell></TableRow>
                                    <TableRow>
                                        <TableCell colSpan={3}>{t("Total do período")}</TableCell>
                                        <TableCell>
                                            {total.toLocaleString(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })}
                                        </TableCell>
                                        <TableCell colSpan={2}></TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell colSpan={3}>{t("Total pago")}</TableCell>
                                        <TableCell>
                                            {totalPago.toLocaleString(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })}
                                        </TableCell>
                                        <TableCell colSpan={2}></TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell colSpan={3}>{t("Total pendente")}</TableCell>
                                        <TableCell>
                                            {totalPendente.toLocaleString(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })}
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
