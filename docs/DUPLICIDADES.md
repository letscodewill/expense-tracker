# Revisão de possíveis duplicidades

Ao clicar em salvar/importar, os lançamentos são comparados com despesas da própria conta pelo nome normalizado (maiúsculas, espaços e acentos), valor em centavos e mês de pagamento. A comparação inclui outros quadros e exclui despesas que representam resumos automáticos. Na edição, o próprio lançamento é excluído da comparação. Parcelas e recorrências são verificadas em todos os meses da série antes de criar quadros.

Na importação, linhas iguais dentro do arquivo também geram avisos. O usuário pode editar/remover linhas ou marcar que revisou e deseja salvar mesmo assim. Alterações no conteúdo, período ou destino invalidam a confirmação. Uma segunda consulta antes de salvar exige nova confirmação se encontrar correspondências diferentes. Falha ao consultar impede o salvamento, sem tratar a ausência de resposta como ausência de duplicatas.

A verificação é uma heurística: duas compras legítimas iguais podem gerar aviso, e nomes diferentes podem não ser reconhecidos. Não há identificação definitiva de uma fatura por banco/cartão/número; uma reimportação é reconhecida pelos lançamentos coincidentes. Nenhum dado existente é removido automaticamente.

Uma trava imediata evita submissões simultâneas no mesmo formulário. Uma importação que já criou um quadro reaproveita esse quadro ao repetir o salvamento no mesmo diálogo. O aviso não é uma restrição de unicidade no banco: duas abas/dispositivos podem salvar ao mesmo tempo entre a consulta e a gravação. Para impedir esse caso de forma estrita, é necessário um fluxo transacional com chave de idempotência no servidor/banco; uma restrição única por nome/valor/mês impediria também despesas legítimas iguais.

Testes automatizados cobrem normalização, centavos, meses distintos, exclusão do próprio registro, paginação, filtro por usuário e exclusão de resumos, confirmação/alteração do rascunho, falha de consulta, clique duplo e repetição após falha ao salvar em um novo quadro.
