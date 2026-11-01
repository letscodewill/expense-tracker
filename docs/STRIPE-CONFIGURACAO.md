# Stripe: configuração e ativação

## Estado desta entrega

O produto real **NoControle Pro** foi criado com os preços recorrentes aprovados:

| Oferta | Cobrança | ID real |
| --- | --- | --- |
| Brasil mensal | R$ 14,90/mês | price_1UX3n1Hx0CkuoArISDtSE90E |
| Brasil anual | R$ 149,90/ano | price_1UX3n2Hx0CkuoArIE40zlP1r |
| USD mensal | US$ 3,99/mês | price_1UX3n2Hx0CkuoArImckvGrWV |
| USD anual | US$ 39,90/ano | price_1UX3n2Hx0CkuoArIt1dnqKol |

Produto: `nocontrole_pro_v1`. Os produtos/preços fictícios anteriores não são aceitos pelo checkout implementado. Não foram canceladas assinaturas nem realizados pagamentos reais.

Portal `bpc_1UX3sZHx0CkuoArIP3Oi0RAL`: consultar faturas, atualizar pagamento e cancelar ao final do período. Não permite trocar preços pelo portal nesta versão; o suporte pode orientar alterações comerciais.

Webhook `we_1UX3sZHx0CkuoArIbo3xynd1`: `https://nocontrole.slimastore.com.br/api/stripe/webhook`. **Entrega pausada** até publicar e configurar as variáveis. O segredo foi salvo exclusivamente no arquivo local ignorado pelo Git. Não copie valores para documentos, commits ou conversas.

## Variáveis na Vercel

Copiar do `.env.local` para **Vercel → projeto → Settings → Environment Variables**, no ambiente **Production**. Configurar valores secretos como Sensitive, sem prefixo NEXT_PUBLIC:

- `STRIPE_SECRET_KEY`: chave real restrita, com acesso aos recursos necessários.
- `SUPABASE_SERVICE_ROLE_KEY`: somente servidor.
- `STRIPE_WEBHOOK_SECRET`: assinatura do endpoint real.
- `STRIPE_PRICE_BRL_MONTH`, `STRIPE_PRICE_BRL_YEAR`, `STRIPE_PRICE_USD_MONTH`, `STRIPE_PRICE_USD_YEAR`: IDs acima.
- `STRIPE_PORTAL_CONFIGURATION_ID`: ID do portal acima.
- `STRIPE_APP_URL`: `https://nocontrole.slimastore.com.br`.
- `STRIPE_BILLING_ENABLED`: inicialmente `false`.

Os segredos existentes de Supabase/OpenAI permanecem necessários. `STRIPE_TEST_SECRET_KEY` é exclusiva dos testes locais; não substitui a chave real e não deve ir para Production. Preços e clientes pertencem a ambientes diferentes na Stripe; não misture IDs de teste com a chave real.

A chave restrita de execução precisa de leitura/escrita de Clientes, Checkout Sessions e Billing Portal Sessions, e leitura de Produtos, Preços e Assinaturas. A criação administrativa de catálogo, portal e webhook usa permissões adicionais apenas para esses recursos. Não é necessário fornecer acesso a transferências ou saques.

## Teste completo sem pagamento real

1. No sandbox/modo de teste da Stripe, obter uma chave secreta `sk_test_` ou restrita `rk_test_` com as permissões do teste. Salvar em `STRIPE_TEST_SECRET_KEY` no `.env.local`.
2. Executar o build: `npm run build -- --webpack`.
3. Executar `node scripts/stripe/smoke-test.mjs`.

O teste recusa chaves reais, cria/reutiliza o catálogo no sandbox, inicia um servidor local separado na porta 3187 e cria uma conta temporária de autenticação com domínio inválido. Não envia e-mails. Usa a forma de pagamento fictícia da Stripe, valida checkout, moeda, valor, repetição, troca de oferta, confirmação assinada, Pro, portal e cancelamento. Remove a conta temporária, cliente e checkouts ao terminar. Catálogo e histórico financeiro de teste da Stripe podem permanecer no sandbox. Nenhum usuário ou dado financeiro real é editado.

Os testes automatizados de assinatura do webhook usam dados sintéticos. `tests/billing-integration.sql` testa regras do banco com usuários sintéticos e rollback, incluindo quotas, isolamento, cortesia, eventos repetidos/concomitantes e metas adicionais.

## Ordem de ativação

1. Concluir o teste completo no sandbox.
2. Publicar o código com todas as variáveis de Production e `STRIPE_BILLING_ENABLED=false`. Conferir `/plans`, login, recuperação, termos, privacidade e links do painel.
3. Conferir que um POST sem assinatura para `/api/stripe/webhook` retorna 400, comprovando que a rota está publicada e o segredo configurado. Não enviar dados pessoais nesse teste.
4. Ativar o endpoint já criado na Stripe. Nenhuma cobrança é feita apenas por ativá-lo.
5. Ativar os limites no banco: `update app_private.billing_settings set enabled=true where id=true;` pelo SQL Editor administrativo. Confirmar a operação antes de liberar comercialmente.
6. Alterar `STRIPE_BILLING_ENABLED=true` na Vercel e fazer novo deploy. O checkout só aparece como disponível com todas as variáveis necessárias presentes.
7. Acompanhar entregas do webhook e erros no início do lançamento. Não é necessário comprar uma assinatura real para testar o fluxo básico.

Até concluir essa ordem, a entrega da Stripe e as novas cotas de quadros/IA ficam desativadas, preservando a operação atual. Reverter para `STRIPE_BILLING_ENABLED=false` impede novos checkouts no aplicativo, mas não cancela renovações existentes; os webhooks precisam continuar processando assinaturas já vendidas. Desativar os limites no banco não apaga dados e não cancela contratos.

## Comportamento implementado

- Contratação após login e e-mail confirmado. A associação usa o UUID autenticado; e-mail ou UUID enviados pelo navegador não concedem plano.
- A moeda BRL/USD de cobrança é escolhida explicitamente na tela de planos, independente do idioma e da moeda visual das despesas. Não há conversão de valores existentes.
- Mesmo Pro nas duas moedas e periodicidades. Anual cobrado integralmente a cada ano, com renovação automática.
- Master OU cortesia válida OU assinatura ativa com período vigente concedem Pro. Revogar cortesia não cancela assinatura. Atraso, cancelamento imediato ou expiração retiram somente a origem paga; cancelamento ao final do período preserva o acesso vigente.
- O webhook verifica corpo original, assinatura, validade temporal e modo teste/real. Eventos duplicados não são reaplicados. Para eventos fora de ordem, busca o estado atual da Stripe sob uma trava por cliente, com prazo e token, antes de atualizar o banco atomicamente.
- Uma conta tem um cliente Stripe. Checkouts abertos são reutilizados; trocar de oferta expira o anterior. Assinaturas já existentes impedem nova contratação pelo aplicativo.
- O plano Free mantém lançamentos ilimitados, categorias/orçamento, até dois quadros secundários por mês, duas análises IA de demonstração por conta, CSV básico e a meta original do cofrinho. O Pro libera quadros, exportações avançadas, metas adicionais e quatro análises IA mensais. PDF e imagens compartilham a mesma quota. O master mantém a exceção operacional para testar IA.
- Os limites de quadros e IA são aplicados no banco, inclusive em gravações diretas e criação de quadros por importação. Dados que excedem os limites após downgrade continuam existentes; não há exclusão automática. Metas já criadas continuam acessíveis e o CSV preserva a saída básica dos dados.
- Reembolsos e disputas exigem atendimento administrativo na Stripe. Um reembolso isolado não cancela automaticamente uma assinatura; regularizar também o contrato quando necessário. Esta versão não tem automação específica de suspensão por disputa.

## Manutenção e recuperação

As novas tabelas ficam em `app_private`, já incluído no backup existente. Na restauração em ambiente separado, manter `billing_settings.enabled=false`, cobrança desativada e nenhuma entrega de webhook real. Não conectar uma cópia restaurada ao checkout real sem reconciliar clientes/assinaturas com a Stripe. Operações exclusivamente no banco não cancelam contratos externos.

`node scripts/stripe/configure-catalog.mjs` faz conferência sem escrever. Com `--apply`, cria somente preços aprovados ausentes, por lookup key e chave de idempotência. Não altera contratos antigos. `node scripts/stripe/configure-billing.mjs` prepara portal e endpoint, preservando segredos locais e mantendo um endpoint recém-criado pausado.
