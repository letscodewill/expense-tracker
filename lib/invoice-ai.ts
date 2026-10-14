import type { ImportRow } from './spreadsheet-import'

export function invoiceSchema(categories: readonly string[]) {
  return {
    type: 'object', additionalProperties: false,
    properties: {
      rows: { type: 'array', items: { type: 'object', additionalProperties: false,
        properties: {
          nome: { type: 'string' }, valor: { type: 'number' },
          category: { type: 'string', enum: [...new Set(['Sem categoria', ...categories])] },
          category_confident: { type: 'boolean' },
        }, required: ['nome', 'valor', 'category', 'category_confident'] } },
      warnings: { type: 'array', items: { type: 'string' } },
    }, required: ['rows', 'warnings'],
  }
}

export function validateAIInvoice(value: unknown, categories: readonly string[] = []): { rows: (ImportRow & { category: string; category_confident: boolean })[]; warnings: string[] } {
  if (!value || typeof value !== 'object' || !('rows' in value) || !('warnings' in value)
    || !Array.isArray(value.rows) || !Array.isArray(value.warnings)
    || value.rows.length > 500 || value.warnings.length > 30) throw new Error('Resposta da IA inválida ou muito grande.')
  const rows = value.rows.map((row: unknown) => {
    if (!row || typeof row !== 'object' || !('nome' in row) || !('valor' in row)
      || typeof row.nome !== 'string' || !row.nome.trim() || row.nome.length > 200
      || typeof row.valor !== 'number' || !Number.isFinite(row.valor) || row.valor <= 0 || row.valor > 10000000)
      throw new Error('A IA retornou uma despesa inválida. Tente a leitura padrão ou revise manualmente.')
    const category = 'category' in row && typeof row.category === 'string'
      && categories.includes(row.category) && 'category_confident' in row && row.category_confident === true
      ? row.category : 'Sem categoria'
    return { nome: row.nome.trim(), valor: Math.round(row.valor * 100) / 100, category, category_confident: category !== 'Sem categoria' }
  })
  const warnings = value.warnings.map((warning: unknown) => {
    if (typeof warning !== 'string' || warning.length > 500) throw new Error('Aviso da IA inválido.')
    return warning
  })
  return { rows, warnings }
}
