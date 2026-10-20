# Cofrinho

Página `/savings`, acessível pelo botão **Cofrinho** ao lado de Planejamento na navegação do painel. Um cofrinho por conta, contínuo entre meses, com saldo independente de despesas e salário. Registra a reserva informada pelo usuário; não transfere dinheiro.

## Uso

- Definir uma meta positiva e salvar.
- Adicionar valores: somam ao saldo atual, inclusive antes de definir uma meta.
- Retirar valores: subtraem do saldo; retiradas acima do saldo são bloqueadas tanto na interface quanto no banco.
- A barra vai de zero a 100%; o saldo pode ultrapassar a meta sem ser cortado.
- Ao alcançar/cruzar a meta por uma movimentação ou alteração de objetivo, aparece um troféu e a pergunta sobre definir outra meta. O troféu também permanece no cartão enquanto o saldo for suficiente, sem reabrir o modal a cada carregamento.
- Alterar meta preserva todo o saldo. Uma retirada pode deixar a meta novamente pendente; alcançá-la de novo abre a comemoração.
- Idiomas Português/English/Español e moeda de exibição BRL/USD seguem os seletores existentes, sem câmbio.

## Persistência e proteção

Migração aplicada no Supabase conectado: `20261020000013_savings_piggy_bank.sql`. Tabelas em `app_private`, com RLS e sem acesso direto de `anon`/`authenticated`:

- `savings_accounts`: saldo e meta em centavos inteiros, por UUID da conta.
- `savings_operations`: identificador idempotente, tipo e valor de cada gravação. Histórico interno de operações; ainda não há lista de movimentações na interface.

RPC pública `savings_account_action` é `SECURITY INVOKER`; encaminha para a implementação privada com `search_path` vazio e identidade obrigatória obtida de `auth.uid()`. Não aceita UUID do proprietário como parâmetro. Somente autenticados têm execução. A rotina privada usa privilégios para atualizar as tabelas restritas, sem tornar outras contas acessíveis.

Cada alteração trava a linha da própria conta (`FOR UPDATE`). Pedidos repetidos com o mesmo UUID e conteúdo não somam/subtraem novamente; conteúdo divergente para o mesmo UUID é recusado. Valores usam centavos, de 1 até 99.999.999.999 por operação/meta, com saldo entre 0 e esse limite.

A interface bloqueia clique duplo com trava síncrona. Se a resposta for incerta, mantém o UUID da tentativa e bloqueia novas entradas até a confirmação por repetição idempotente. O identificador fica em memória durante essa tentativa; não é um mecanismo de retomada automática após fechar a página. Após recarregar, o saldo confirmado é consultado novamente. Não há sincronização em tempo real entre abas nesta versão; operações simultâneas continuam serializadas pelo banco.

## Verificações

- `tests/savings-integration.sql`: testado com a migração numa transação revertida, antes de aplicar; repetido após aplicar. Verifica depósitos, retiradas, centavos, repetição, conflito de ID, bloqueio de saldo negativo e valores inválidos, manutenção do saldo ao trocar a meta, acesso anônimo/sem identidade, acesso direto às tabelas e leitura de outra conta. Usa dados fictícios e rollback; não modifica finanças reais.
- Testes JavaScript exercitam parsing exato, progresso, conquista, alteração de meta, prevenção de retirada indevida, clique duplo, repetição com resposta perdida e proteção da página por login.
- Advisors: as novas tabelas privadas aparecem como RLS sem políticas (bloqueio intencional de acesso direto). A função pública não adicionou alertas de `SECURITY DEFINER` exposto. Avisos anteriores do projeto permanecem fora desta alteração.

As tabelas estão em `app_private`, já incluído na rotina de backup existente; futuras cópias do banco as incluirão. É preciso publicar a interface para o botão aparecer no domínio público. Não há chaves ou variáveis novas para configurar.

Validação da entrega: suíte completa com 145 testes aprovados; testes focados repetidos após o ajuste final de carregamento; TypeScript, ESLint e compilação com Webpack aprovados. A interface autenticada não foi conferida visualmente com uma conta real nesta etapa. O catálogo confirmou execução anônima e acesso direto bloqueados, e zero registros de teste remanescentes.
