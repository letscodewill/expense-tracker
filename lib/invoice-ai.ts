import type { ImportRow } from './spreadsheet-import'

export type DetectedInstallments = { count: number; current: number | null; amount_type: 'installment' | 'total' | 'unknown' }

export function invoiceSchema(categories: readonly string[], image = false) {
  return {
    type: 'object', additionalProperties: false,
    properties: {
      rows: { type: 'array', items: { type: 'object', additionalProperties: false,
        properties: {
          nome: { type: 'string' }, valor: { type: 'number' },
          category: { type: 'string', enum: [...new Set(['Sem categoria', ...categories])] },
          category_confident: { type: 'boolean' },
          ...(image ? { installments: { anyOf: [
            { type: 'null' },
            { type: 'object', additionalProperties: false, properties: {
              count: { type: 'integer', minimum: 2, maximum: 120 },
              current: { type: ['integer', 'null'], minimum: 1, maximum: 120 },
              amount_type: { type: 'string', enum: ['installment', 'total', 'unknown'] },
            }, required: ['count', 'current', 'amount_type'] },
          ] } } : {}),
        }, required: ['nome', 'valor', 'category', 'category_confident', ...(image ? ['installments'] : [])] } },
      warnings: { type: 'array', items: { type: 'string' } },
    }, required: ['rows', 'warnings'],
  }
}

export function validateAIInvoice(value: unknown, categories: readonly string[] = []): { rows: (ImportRow & { category: string; category_confident: boolean; installments?: DetectedInstallments })[]; warnings: string[] } {
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
    let installments: DetectedInstallments | undefined
    if ('installments' in row && row.installments !== null && row.installments !== undefined) {
      const detected = row.installments as Partial<DetectedInstallments>
      if (typeof detected !== 'object' || !Number.isInteger(detected.count) || detected.count! < 2 || detected.count! > 120
        || (detected.current !== null && (!Number.isInteger(detected.current) || detected.current! < 1 || detected.current! > detected.count!))
        || !['installment', 'total', 'unknown'].includes(detected.amount_type ?? ''))
        throw new Error('A IA retornou um parcelamento inválido. Confira o comprovante e tente novamente.')
      installments = { count: detected.count!, current: detected.current!, amount_type: detected.amount_type! }
    }
    let nome = row.nome.trim()
    if (installments) {
      const suffix = installments.current === null ? `(${installments.count}x)` : `(${installments.current}/${installments.count})`
      if (!nome.endsWith(suffix)) nome = `${nome.slice(0, 199 - suffix.length).trimEnd()} ${suffix}`
    }
    return { nome, valor: Math.round(row.valor * 100) / 100, category, category_confident: category !== 'Sem categoria', ...(installments ? { installments } : {}) }
  })
  const warnings = value.warnings.map((warning: unknown) => {
    if (typeof warning !== 'string' || warning.length > 500) throw new Error('Aviso da IA inválido.')
    return warning
  })
  return { rows, warnings }
}
