# Pro cortesia e acesso master

## Onde acessar

Depois de publicar a interface, abrir **Menu → Planos e benefícios** ou **Painel administrativo → Planos e benefícios** (`/admin/benefits`). A página e suas operações exigem a conta confirmada `williansantos38@gmail.com` e a propriedade registrada em `support_owner`.

Essa conta já foi confirmada como proprietária no Supabase conectado. A gestão de cortesias não promove outros usuários a master nem altera a administração de tickets.

## Conceder, prorrogar e revogar

1. Buscar a conta cadastrada por e-mail. A listagem usa 20 usuários por página; apenas contas com e-mail confirmado podem receber o benefício.
2. Clicar em **Gerenciar benefício**.
3. Informar o motivo, por exemplo “Tester” ou “Usuário fundador”.
4. Marcar **Sem vencimento** ou informar data e hora de validade no fuso do dispositivo.
5. Clicar em **Conceder ou prorrogar Pro**, revisar o e-mail e a validade no modal e confirmar.
6. Para revogar, selecionar a conta, informar o motivo, clicar em **Revogar cortesia** e confirmar.

O histórico mostra as últimas 20 alterações correspondentes à busca, com conta, responsável, data/hora, motivo e validade anterior/nova. Alterar ou prorrogar gera novo evento; não sobrescreve o histórico. Em conflito entre duas abas, a revisão antiga é recusada e a página precisa ser atualizada.

Não foi concedida cortesia a nenhum usuário real nesta entrega. A seleção dos beneficiários fica a cargo do master.

## Regra de acesso

`get_my_plan()` retorna o plano e sua origem da própria conta:

- Proprietário confirmado: `pro / master`, permanente, com `can_manage_benefits=true`.
- Cortesia não revogada e ainda válida (ou sem vencimento): `pro / courtesy`, sem poderes administrativos.
- Demais contas: `free / default`. Isso é a base de permissões para a próxima etapa, **não um bloqueio novo das funcionalidades existentes**.

O cabeçalho do painel identifica Master/Pro permanente ou Pro cortesia. A expiração é calculada no banco em cada consulta; não depende de tarefa agendada nem de renovar um JWT. A informação visual no cabeçalho é atualizada ao carregar a página. As futuras rotas pagas deverão consultar essa fonte no servidor, sem usar o badge como autorização.

O master deixa de ter a cota mensal de quatro análises IA para poder testar. Permanecem limites técnicos de arquivo/páginas, proteção por hora, saldo do fornecedor e demais controles operacionais. Cortesias mantêm a cota atual de IA até os limites Free/Pro serem definidos na etapa de cobrança. Os outros usuários não perderam recursos nesta entrega.

## Segurança e persistência

Migração `20261020001853_pro_courtesy_management.sql` aplicada ao projeto conectado. Tabelas `app_private.pro_courtesies` e `app_private.pro_courtesy_audit` têm RLS, sem acesso direto para `anon`/`authenticated`. Funções públicas são `SECURITY INVOKER`; implementações privadas fixam `search_path` e verificam a identidade/propriedade antes de listar usuários ou gravar benefícios.

Não se usa `user_metadata` como fonte de plano ou poderes administrativos. A edição de dados do próprio perfil não concede Pro. Usuário comum e administrador delegado de suporte são recusados mesmo ao chamar a RPC diretamente.

As alterações usam UUID idempotente, bloqueios transacionais e revisão otimista por conta. Um clique duplo ou repetição após resposta perdida não cria novos eventos/grants. As tentativas incertas mantêm o mesmo UUID enquanto o formulário estiver aberto. Uma nova página consulta o estado persistido, sem prometer retomada automática da tentativa anterior.

O log inclui antes/depois e o UUID do autor. A exclusão de uma conta remove sua cortesia e desvincula identificadores no histórico por FK; os metadados históricos restantes exigem a política de retenção administrativa correspondente. As tabelas pertencem ao schema já incluído nos backups.

## Relação com a Stripe

Cortesia é um benefício interno e não cria checkout, cobrança, cliente ou assinatura na Stripe. Revogar o benefício não envia cancelamentos ao provedor.

Ainda não existe assinatura paga integrada. Quando ela for implementada, compor o plano efetivo como **master OU cortesia válida OU assinatura paga válida**. A perda de cortesia nunca deve cancelar ou invalidar uma assinatura paga existente. A interface não deve prometer compra disponível antes de concluir essa integração. Ver [PLANOS-E-CHECKOUT.md](PLANOS-E-CHECKOUT.md).

## Verificações

`tests/pro-benefits-integration.sql` foi executado com a migração em uma transação revertida e novamente após aplicar. Verificou master permanente, grant com prazo, grant permanente, expiração, revogação, autorização, tentativa de autopromoção, acesso direto às tabelas, histórico, idempotência, conflito de revisão e manutenção da cota mensal de IA para usuários comuns. As concessões e reservas de teste foram revertidas. O catálogo final confirmou zero cortesias e eventos reais criados, execução anônima bloqueada e ausência de acesso direto de atualização às tabelas.

Os testes JavaScript cobrem validação, bloqueio de ações/página para não proprietários, revisão obrigatória, clique duplo e repetição de request ID após perda de resposta. A primeira análise estática não iniciou porque a revisão automática de permissão expirou; a repetição concluiu normalmente.

Não foram configurados produtos/preços, checkout, webhooks, regras fiscais ou novas cotas Free/Pro. Essa será uma próxima implementação após definir os dados comerciais e de conta Stripe.

Validação final desta entrega: 150 testes aprovados, TypeScript, ESLint e build com Webpack aprovados. A interface autenticada não foi inspecionada visualmente com uma conta real. A aplicação no domínio depende do deploy do código; não há novas variáveis obrigatórias.
