# Exclusão de quadros com autorização por conta

A migração `20261014223610_secure_board_deletion.sql` foi aplicada ao projeto conectado em 14/10/2026.

`public.delete_board_cascade(uuid)` agora usa **SECURITY INVOKER**, `search_path` vazio e objetos qualificados. Somente `authenticated` recebe execução; a função exige `auth.uid()` e busca o quadro com o mesmo `user_id`, mantendo um bloqueio durante a operação. Quadro inexistente e quadro de outra conta retornam o mesmo erro de acesso. As políticas RLS continuam valendo dentro da função.

Todos os efeitos são restritos à conta autenticada:

- Recorrências do quadro passam para o painel principal.
- Parcelas atuais e seguintes da série são removidas, preservando parcelas anteriores e séries de outras contas mesmo se tiverem o mesmo identificador.
- A exclusão do quadro remove suas despesas avulsas e seu resumo pelo vínculo existente.
- A limpeza de quadros futuros vazios compara também o proprietário; quadros de outras contas com o mesmo nome permanecem.
- Candidatos à limpeza são bloqueados e têm sua ausência de despesas conferida novamente para preservar inserções concorrentes.

As duas chaves estrangeiras de `expenses` para `boards` incluem agora `user_id`, com a chave única correspondente em `boards`. Isso impede que um lançamento ou resumo de uma conta aponte para o quadro de outra, inclusive em requisições diretas, e protege a exclusão em cascata. Antes da migração, as consultas não encontraram vínculos incompatíveis.

## Verificação

`tests/board-deletion-security-integration.sql` passou antes da aplicação (migração e testes na mesma transação revertida) e após a aplicação. Cobriu chamadas anônimas, identidade ausente, quadro inexistente, conta A/B, vínculos forjados, nomes iguais, parcelas anteriores/atuais/futuras, recorrências, despesas avulsas, resumos e rollback integral em falha simulada. Os dados fictícios foram revertidos com `ROLLBACK`.

Os testes existentes de pagamento de quadros e sincronização nos dois sentidos também passaram no banco real com rollback. O teste de pagamento foi ajustado: um vínculo entre contas, anteriormente inserido de propósito como fixture, agora precisa ser recusado pela chave estrangeira.

Após aplicar, o catálogo confirmou `prosecdef=false`, `anon_execute=false`, `authenticated_execute=true` e `search_path` fixado. Os advisors deixaram de sinalizar `delete_board_cascade` por execução anônima, privilégios elevados e caminho de busca mutável. Os outros avisos do projeto não foram alterados por esta correção.

A chamada anônima à RPC pela API retornou HTTP **401**, usando argumento nulo que não aponta para nenhum quadro. A suíte JavaScript passou com **132 testes**. A consulta final encontrou zero quadros fictícios remanescentes dos testes SQL.

A assinatura RPC e a confirmação da interface foram preservadas. A proteção já funciona no banco publicado, sem depender de um novo deploy da interface. Versionar esta migração junto ao projeto para que outros ambientes recebam a mesma proteção.
