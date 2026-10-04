import type { ImportRow } from './spreadsheet-import'

export const INVOICE_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    rows: { type: 'array', items: { type: 'object', additionalProperties: false,
      properties: { nome: { type: 'string' }, valor: { type: 'number' } }, required: ['nome', 'valor'] } },
    warnings: { type: 'array', items: { type: 'string' } },
  }, required: ['rows', 'warnings'],
}

export function validateAIInvoice(value: unknown): { rows: ImportRow[]; warnings: string[] } {
  if (!value || typeof value !== 'object' || !('rows' in value) || !('warnings' in value)
    || !Array.isArray(value.rows) || !Array.isArray(value.warnings)
    || value.rows.length > 500 || value.warnings.length > 30) throw new Error('Resposta da IA inválida ou muito grande.')
  const rows = value.rows.map((row: unknown) => {
    if (!row || typeof row !== 'object' || !('nome' in row) || !('valor' in row)
      || typeof row.nome !== 'string' || !row.nome.trim() || row.nome.length > 200
      || typeof row.valor !== 'number' || !Number.isFinite(row.valor) || row.valor <= 0 || row.valor > 10000000)
      throw new Error('A IA retornou uma despesa inválida. Tente a leitura padrão ou revise manualmente.')
    return { nome: row.nome.trim(), valor: Math.round(row.valor * 100) / 100 }
  })
  const warnings = value.warnings.map((warning: unknown) => {
    if (typeof warning !== 'string' || warning.length > 500) throw new Error('Aviso da IA inválido.')
    return warning
  })
  return { rows, warnings }
}
