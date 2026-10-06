'use client'
import type { DuplicateWarning } from '@/lib/expense-duplicates'

export function DuplicateExpenseNotice({ warnings, confirmed, onConfirm }: {
  warnings: DuplicateWarning[]; confirmed: boolean; onConfirm: (value: boolean) => void
}) {
  if (!warnings.length) return null
  return <div role="alert" className="space-y-3 rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
    <p className="font-medium">{warnings.length} lançamento(s) com possível duplicidade</p>
    <p>Encontramos o mesmo nome, valor e mês de pagamento. Confira as linhas antes de salvar; compras iguais podem ser legítimas.</p>
    <ul className="max-h-48 space-y-2 overflow-auto">
      {warnings.map(warning => <li key={warning.index}>Linha {warning.index + 1}: {warning.nome} — {warning.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} — {warning.month.split('-').reverse().join('/')}. {warning.existingIds.length > 0 ? 'Já existe na sua conta. ' : ''}{warning.repeatedInBatch ? 'Repetido nesta importação.' : ''}</li>)}
    </ul>
    <label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} onChange={event => onConfirm(event.target.checked)} />Revisei e quero salvar mesmo com estas possíveis duplicidades.</label>
  </div>
}
