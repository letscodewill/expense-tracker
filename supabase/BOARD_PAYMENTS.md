# Pagamento dos quadros pelo painel principal

## Sincronização nos dois sentidos

A migração `20261013214630_bidirectional_board_payment_status.sql` acrescenta a atualização automática do resumo do principal quando uma despesa do quadro muda:

- Todas as despesas do mês em `Pago` ou `VR/VA`: resumo `Pago`.
- Pelo menos uma despesa pendente: resumo `Pendente`.
- Nova despesa pendente ou pagamento desfeito: resumo volta a `Pendente`.
- Quadro sem despesas no mês: resumo `Pendente`, valor zero.
- Mudança de quadro: os dois resumos são recalculados.

O total considera apenas despesas reais do mesmo usuário e mês de pagamento do resumo. O nome não é alterado. A sincronização automática preserva VR/VA; clicar manualmente em Pago no principal mantém a regra anterior de pagar as despesas relacionadas. Atualizações aninhadas não disparam pagamentos em sequência.

Não há recálculo retroativo em massa. Os resumos existentes passam a refletir a nova regra quando suas despesas forem inseridas, alteradas ou excluídas.

O teste `tests/board-summary-status-integration.sql` utiliza quadros temporários de teste e encerra a transação com `ROLLBACK`, preservando as despesas existentes.

A migração `pay_board_expenses_from_summary` foi aplicada ao projeto da aplicação. O vínculo é `expenses.represents_board_id`, sem comparação por nome.

Ao mudar um resumo do principal para `Pago`, o banco marca as despesas do quadro relacionado e do mês de `data_pagamento` como `Pago`, na mesma transação. Respeita RLS e exige que resumo e quadro pertençam ao usuário autenticado. Outros quadros, outros usuários e meses futuros não são alterados. Despesas em `VR/VA` daquele mês também ficam `Pago`.

Desfazer o pagamento do resumo continua alterando somente o resumo, sem reabrir despesas individuais. Pagamentos anteriores à instalação não são propagados retroativamente. A aplicação atualiza os quadros secundários quando os pagamentos mudam; publique o código para receber essa atualização visual e as mensagens de falha.

Os testes SQL usam dados temporários dentro de uma transação encerrada com `ROLLBACK`, sem modificar os registros financeiros existentes.

Validação realizada: `tests/board-payment-integration.sql` passou no banco real com papel `authenticated`, cobrindo pagamentos, limites de mês, outros quadros/usuários, desfazer, repetição e rollback em falha. As duas migrações locais correspondem às versões geradas pelo Supabase.

A consulta aos advisors não apontou problema na função nova. A migração `20261014223610_secure_board_deletion.sql` corrigiu o acesso anônimo e a autorização de `delete_board_cascade`; consulte [BOARD_DELETION.md](BOARD_DELETION.md). Persistem avisos anteriores sobre outras funções de sincronização com [search_path não fixado](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), fora do escopo dessa correção.
