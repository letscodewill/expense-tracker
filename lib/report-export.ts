export type ExportTable = { title: string; headers: string[]; rows: (string | number)[][] }
export type ReportExport = { title: string; period: string; expenses: ExportTable; totals: ExportTable; budgets: ExportTable; budgetNote: string }

// Spreadsheet programs may execute formulas even inside quoted CSV fields.
export function csvCell(value: string | number): string {
  const text = String(value)
  const safe = typeof value === 'string' && /^[\s\uFEFF]*[=+@-]/u.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}

export function reportCsv(report: ReportExport, locale: string): string {
  const rows = [report.expenses.headers, ...report.expenses.rows]
  return '\uFEFF' + rows.map(row => row.map(value => csvCell(typeof value === 'number'
    ? locale === 'pt-BR' ? value.toFixed(2).replace('.', ',') : value.toFixed(2)
    : value)).join(';')).join('\r\n') + '\r\n'
}

export function reportTxt(report: ReportExport): string {
  const cell = (value: string | number) => String(value).replace(/\r\n|\r|\n/g, ' / ').replace(/\t/g, ' ')
  return '\uFEFF' + [report.title, report.period, ...[report.expenses, report.totals, report.budgets].flatMap(table => [
    '', table.title, ...(table === report.budgets ? [report.budgetNote] : []),
    table.headers.map(cell).join('\t'), ...table.rows.map(row => row.map(cell).join('\t')),
  ])].join('\r\n') + '\r\n'
}

export function downloadReport(data: BlobPart, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }))
  const link = document.createElement('a')
  try {
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
  } finally {
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
