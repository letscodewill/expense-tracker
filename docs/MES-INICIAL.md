# Mês inicial após quitação

Quando o mês exibido tem pelo menos uma despesa real e todas as despesas de todos os quadros estão em Pago ou VR/VA, o painel pergunta se o usuário quer abrir o próximo mês nos acessos seguintes. A pergunta é um cartão discreto no painel, sem modal obrigatório. Meses vazios, com pendências, status desconhecidos ou falha na consulta não geram a pergunta.

Os lançamentos que representam totais de quadros secundários são excluídos dessa verificação: as despesas reais desses quadros são consultadas diretamente, evitando contagem duplicada. As consultas usam o usuário autenticado, as datas do mês e paginação de mil registros. A consulta é renovada ao mudar o mês, após alterações nas despesas e quando a janela ganha foco.

- **Sim:** salva o próximo mês como inicial e muda a visualização imediatamente após a confirmação do salvamento. Dezembro avança para janeiro do ano seguinte.
- **Não:** salva o mês exibido como inicial e não volta a perguntar para aquele mês.
- **Voltar ao mês atual como padrão:** remove o mês fixo e volta ao comportamento de abrir o mês do calendário. Essa opção aparece quando o mês inicial salvo é diferente do mês atual.

O usuário continua livre para navegar no seletor. A preferência é salva na própria conta em `user_metadata.nocontrole_month_start`, não em armazenamento local e não em uma permissão de acesso. O mês fixo é respeitado mesmo depois da mudança de calendário, até nova escolha ou restauração do padrão. São retidas as últimas 24 respostas por mês; meses anteriores ao mês inicial não são sugeridos para evitar retroceder o padrão involuntariamente.

Antes de salvar, a sessão e as pendências são verificadas novamente. Se o usuário mudou, apareceram pendências ou o salvamento falhou, o painel não avança. Cliques duplicados são bloqueados. Nenhuma despesa, data, salário, recorrência, parcela ou status financeiro é alterado. Não há migração do banco ou nova variável de ambiente.

Os testes automatizados usam contas e consultas simuladas: datas inválidas, virada do ano, preferência persistida, pagamentos em todos os quadros, VR/VA, mês vazio, paginação, isolamento por usuário, recusa, restauração, falha ao salvar, cliques duplicados e pendência criada depois da pergunta. A interface autenticada não foi conferida com uma conta real nesta entrega.
