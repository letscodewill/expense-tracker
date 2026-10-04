export type ImportRow = { nome: string; valor: number }
export type ImportSheet = { name: string; cells: string[][] }
export const MAX_IMPORT_ROWS = 500
export const MAX_IMPORT_BYTES = 3 * 1024 * 1024

export function parseCurrency(value: string): number | null {
  let clean = value.trim().replace(/R\$\s*/gi, '').replace(/\s/g, '')
  const negative = /^\(.*\)$/.test(clean)
  if (negative) clean = clean.slice(1, -1)
  if (!/^-?\d+(?:[.,]\d+)*$/.test(clean)) return null
  if (clean.includes(',') && clean.includes('.')) {
    clean = clean.lastIndexOf(',') > clean.lastIndexOf('.')
      ? clean.replace(/\./g, '').replace(',', '.') : clean.replace(/,/g, '')
  } else if (clean.includes(',')) clean = clean.replace(',', '.')
  const number = Number(clean) * (negative ? -1 : 1)
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null
}

// Preserve quoted delimiters, escaped quotes and multi-line cells.
export function parseCSV(text: string): string[][] {
  text = text.replace(/^\uFEFF/, '')
  const firstLine = text.split(/\r?\n/)[0]
  const delimiter = [';', ',', '\t'].sort((a, b) =>
    firstLine.split(b).length - firstLine.split(a).length)[0]
  const cells: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++ }
      else quoted = !quoted
    } else if (!quoted && char === delimiter) { row.push(cell); cell = '' }
    else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      if (row.some((value) => value.trim())) cells.push(row)
      row = []; cell = ''
    } else cell += char
    if (cells.length > 5000 || row.length > 100) throw new Error('Planilha muito grande. Use até 5.000 linhas e 100 colunas.')
  }
  if (quoted) throw new Error('CSV inválido: uma célula está com aspas abertas.')
  row.push(cell)
  if (row.some((value) => value.trim())) cells.push(row)
  return cells
}

export function suggestColumns(cells: string[][]) {
  const headers = (cells[0] ?? []).map((value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase())
  const name = headers.findIndex((value) => /^(nome|descricao|despesa|estabelecimento|historico|description)$/.test(value))
  const amount = headers.findIndex((value) => /^(valor(?:\s*\(r\$\))?|valor da compra|total|amount)$/.test(value))
  return { name: name < 0 ? 0 : name, amount: amount < 0 ? 1 : amount, header: name >= 0 || amount >= 0 }
}

export function mapSpreadsheet(cells: string[][], nameColumn: number, amountColumn: number, hasHeader: boolean) {
  if (nameColumn === amountColumn) throw new Error('Escolha colunas diferentes para nome e valor.')
  const rows: ImportRow[] = [], warnings: string[] = []
  cells.slice(hasHeader ? 1 : 0).forEach((cell, index) => {
    if (!cell.some((value) => value.trim())) return
    const nome = (cell[nameColumn] ?? '').trim()
    const valor = parseCurrency(cell[amountColumn] ?? '')
    if (!nome || nome.length > 200 || valor === null || valor <= 0 || valor > 10000000) {
      warnings.push(`Linha ${index + (hasHeader ? 2 : 1)} ignorada: nome ou valor inválido, vazio ou não positivo.`)
    } else rows.push({ nome, valor })
  })
  if (rows.length > MAX_IMPORT_ROWS) throw new Error(`Importe no máximo ${MAX_IMPORT_ROWS} despesas por vez.`)
  return { rows, warnings }
}

export async function readSpreadsheet(file: File): Promise<ImportSheet[]> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('O arquivo deve ter no máximo 3 MB.')
  if (/\.csv$/i.test(file.name)) {
    const cells = parseCSV(await file.text())
    return [{ name: file.name, cells }]
  }
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Use uma planilha .xlsx ou .csv. Para .xls, salve como .xlsx primeiro.')
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())
  if (workbook.worksheets.length > 30) throw new Error('Use um arquivo com no máximo 30 abas.')
  return workbook.worksheets.map((sheet) => {
    if (sheet.rowCount > 5000 || sheet.columnCount > 100) throw new Error('Planilha muito grande. Use até 5.000 linhas e 100 colunas.')
    const cells: string[][] = []
    sheet.eachRow((row) => {
      const values = Array.from({ length: sheet.columnCount }, (_, index) => {
        const cell = row.getCell(index + 1)
        // Never execute formulas or fetch hyperlinks; use cached values only.
        const value = cell.value
        if (value && typeof value === 'object' && 'formula' in value) return value.result == null ? '' : String(value.result)
        return cell.text
      })
      cells.push(values)
    })
    return { name: sheet.name, cells }
  }).filter((sheet) => sheet.cells.length > 0)
}
