# Pagamento dos quadros pelo painel principal

A migração `pay_board_expenses_from_summary` foi aplicada ao projeto da aplicação. O vínculo é `expenses.represents_board_id`, sem comparação por nome.

Ao mudar um resumo do principal para `Pago`, o banco marca as despesas do quadro relacionado e do mês de `data_pagamento` como `Pago`, na mesma transação. Respeita RLS e exige que resumo e quadro pertençam ao usuário autenticado. Outros quadros, outros usuários e meses futuros não são alterados. Despesas em `VR/VA` daquele mês também ficam `Pago`.

Desfazer o pagamento do resumo continua alterando somente o resumo, sem reabrir despesas individuais. Pagamentos anteriores à instalação não são propagados retroativamente. A aplicação atualiza os quadros secundários quando os pagamentos mudam; publique o código para receber essa atualização visual e as mensagens de falha.

Os testes SQL usam dados temporários dentro de uma transação encerrada com `ROLLBACK`, sem modificar os registros financeiros existentes.

Validação realizada: `tests/board-payment-integration.sql` passou no banco real com papel `authenticated`, cobrindo pagamentos, limites de mês, outros quadros/usuários, desfazer, repetição e rollback em falha. As duas migrações locais correspondem às versões geradas pelo Supabase.

A consulta aos advisors não apontou problema na função nova. Persistem avisos anteriores sobre funções de sincronização com `search_path` não fixado e `delete_board_cascade` acessível a `anon`; devem ser avaliados separadamente ([search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [execução anônima](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)).
