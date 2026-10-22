import { Workbook } from 'exceljs'
import type { ReportExport } from './report-export'

export async function reportSpreadsheet(report: ReportExport): Promise<Uint8Array> {
  const workbook = new Workbook()
  workbook.creator = 'NoControle'
  for (const [index, table] of [report.expenses, report.totals, report.budgets].entries()) {
    const sheet = workbook.addWorksheet(table.title.replace(/[\\/*?:\[\]]/g, ' ').slice(0, 27) + ` ${index + 1}`)
    sheet.addRow([report.title])
    sheet.addRow([report.period])
    if (index === 2) sheet.addRow([report.budgetNote])
    for (let rowNumber = 1; rowNumber <= (index === 2 ? 3 : 2); rowNumber++) {
      sheet.mergeCells(rowNumber, 1, rowNumber, table.headers.length)
      const row = sheet.getRow(rowNumber)
      row.alignment = { wrapText: true, vertical: 'middle' }
      row.height = rowNumber === 3 ? 42 : 28
    }
    sheet.getRow(1).font = { bold: true, size: 14 }
    sheet.addRow([])
    const header = sheet.addRow(table.headers)
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6750A4' } }
    for (const values of table.rows) {
      // Strings remain literal strings, never ExcelJS formula objects.
      const row = sheet.addRow(values)
      row.eachCell(cell => {
        cell.alignment = { vertical: 'top', wrapText: true }
        if (typeof cell.value === 'number') cell.numFmt = '#,##0.00'
      })
    }
    sheet.columns.forEach((column, columnIndex) => { column.width = columnIndex === 0 || columnIndex === table.headers.length - 1 ? 36 : 23 })
    sheet.views = [{ state: 'frozen', ySplit: header.number }]
    sheet.autoFilter = { from: { row: header.number, column: 1 }, to: { row: header.number, column: table.headers.length } }
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer())
}
