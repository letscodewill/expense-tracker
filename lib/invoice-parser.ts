// lib/invoice-parser.ts

export type ParsedExpense = {
  nome: string
  valor: number
  data: string // YYYY-MM-DD (ano assumido como o ano corrente/informado)
}

const MONTH_MAP: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
}

// Linhas que claramente não são despesas (cabeçalhos, totais, resumos).
const NOISE_KEYWORDS = [
  'VALOR TOTAL', 'Saldo Anterior', 'Saldo Desta Fatura', 'Total Despesas',
  'Total de pagamentos', 'Total de créditos', 'Juros de mora', 'Multa por atraso',
  'IOF de financiamento', 'Limite total', 'Limite máximo', 'PAGAMENTO DE FATURA',
  'Lançamentos no cartão', 'Total dos lançamentos', 'Próxima fatura',
  'Demais faturas', 'Total para próximas', 'Juros do rotativo', 'Juros Máximos',
  'Compra Data Descrição', 'DATA ESTABELECIMENTO', 'Descrição R$',
]

function isNoiseLine(line: string): boolean {
  return NOISE_KEYWORDS.some((kw) => line.includes(kw))
}

// Extrai o último valor monetário (formato brasileiro) de uma linha.
function extractValue(line: string): number | null {
  const matches = line.match(/-?\d{1,3}(?:\.\d{3})*,\d{2}/g)
  if (!matches || matches.length === 0) return null
  const last = matches[matches.length - 1]
  const normalized = last.replace(/\./g, '').replace(',', '.')
  const value = parseFloat(normalized)
  return isNaN(value) ? null : Math.abs(value) // ignoramos sinal negativo (pagamentos)
}

// Formato Santander/Itaú: DD/MM
function tryDateSlash(line: string, year: number): { date: string; rest: string } | null {
  const match = line.match(/^\s*(?:\d+\s+)?(\d{2})\/(\d{2})(?:\/(\d{4}))?\s+(.*)$/)
  if (!match) return null
  const [, day, month, matchedYear, rest] = match
  const y = matchedYear ? parseInt(matchedYear) : year
  return {
    date: `${y}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
    rest,
  }
}

// Formato Nubank: DD MÊS (ex: "08 FEV")
function tryDateMonthName(line: string, year: number): { date: string; rest: string } | null {
  const match = line.match(/^\s*(\d{2})\s+([A-ZÇ]{3})\s+(.*)$/i)
  if (!match) return null
  const [, day, monthAbbr, rest] = match
  const month = MONTH_MAP[monthAbbr.toLowerCase()]
  if (!month) return null
  return {
    date: `${year}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}`,
    rest,
  }
}

export function parseInvoiceText(text: string, year: number): ParsedExpense[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const results: ParsedExpense[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isNoiseLine(line)) continue

    const parsed = tryDateSlash(line, year) ?? tryDateMonthName(line, year)
    if (!parsed) continue

    let valueLine = parsed.rest
    let value = extractValue(valueLine)
    let nome = valueLine

    // Caso Nubank: descrição sem valor na mesma linha (ex: parcelamentos de
    // empréstimo). Procura o valor nas próximas linhas, até 3 linhas à frente.
    if (value === null) {
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const candidate = extractValue(lines[j])
        if (candidate !== null && !/\d{2}\/\d{2}|^\d{2}\s+[A-Z]{3}/i.test(lines[j])) {
          value = candidate
          i = j // pula essas linhas já consumidas
          break
        }
      }
    }

    if (value === null) continue

    // Remove o próprio valor do final do nome, se estiver na mesma linha.
    nome = nome.replace(/-?\d{1,3}(?:\.\d{3})*,\d{2}\s*$/, '').trim()
    nome = nome.replace(/\s{2,}/g, ' ')

    if (!nome) continue

    results.push({ nome, valor: value, data: parsed.date })
  }

  return results
}