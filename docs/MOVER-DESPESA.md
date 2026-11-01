# Trocar quadro na edição

Use **Quadro de destino** na edição de uma despesa. As opções são os quadros da própria conta no mês da data de pagamento, o painel principal e **Outro quadro…**. O novo nome é reutilizado se já existir naquele mês; caso contrário, o quadro é criado ao salvar. O formulário aguarda o carregamento das opções e descarta consultas antigas quando a data muda.

Ao trocar o destino de uma dívida parcelada, **todas as parcelas vinculadas pelo mesmo installment_group_id são movidas**, inclusive as pagas e as de meses anteriores. Cada parcela continua no mês de sua própria data de pagamento. O quadro com o nome escolhido é reutilizado ou criado em cada mês/ano necessário. Escolher o principal move todas as parcelas ao principal de seus respectivos meses.

Apenas o lançamento em edição recebe as alterações de nome, valor, categoria, comentário, data e situação feitas no formulário. As outras parcelas preservam todos esses dados, seus IDs, números e vínculos. Editar sem trocar o nome do quadro não move o grupo. Despesas comuns e recorrentes continuam com edição individual.

O grupo é atualizado em uma única transação pela função public.move_installment_group, com autenticação, RLS, filtro de proprietário e conferência do grupo. Uma falha desfaz as atualizações e a criação dos quadros. Chamadas repetidas reutilizam os quadros; não inserem novas despesas. O formulário mantém a revisão de possíveis duplicidades antes da operação.

Resumos dos quadros não permitem troca de destino. Os gatilhos existentes recalculam totais e situação dos quadros de origem e destino. A função antiga create_board_summary_expense recebeu referência explícita a public.expenses e caminho de busca fixo para funcionar dentro da nova operação.

## Banco e validação

Migrações aplicadas no Supabase:

- 20261101172528_move_installment_group.sql
- 20261101172653_qualify_board_summary_creation.sql

O teste tests/installment-move-integration.sql passou com dados sintéticos e rollback: passagem de dezembro para janeiro, criação/reutilização de quadros, preservação de parcelas pagas e VR/VA, movimentação ao principal, repetição sem duplicações, isolamento de contas e grupos, bloqueio anônimo e falha simulada após movimentação parcial com rollback integral. Nenhum dado financeiro real foi alterado.

O teste tests/board-summary-status-integration.sql também passou: totais, pagamento parcial/completo, VR/VA, inclusão de pendências, desfazer pagamento, principal pagando secundário, escopo mensal e movimentações entre quadros.

Testes do formulário cobrem a chamada única para mover parcelas, quadro existente, quadro novo, principal, falhas sem fechar a edição e edição individual quando o destino não muda. Sem variável ou dependência nova. Publicar o código para disponibilizar a interface no site.
