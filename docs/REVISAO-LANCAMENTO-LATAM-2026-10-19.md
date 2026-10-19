# Revisão de lançamento do NoControle — 19/10/2026

**Implementação posterior à revisão, ainda dependente de publicação:** callback corrigido para aceitar somente caminhos internos; espanhol adicionado ao seletor e dicionário; moeda de exibição BRL/USD sem câmbio e sem alteração de dados; páginas `/privacypolicy` e `/termsofservice` criadas com links públicos e contato `suportenocontroleofc@gmail.com`. As observações abaixo registram o estado anterior dessas partes em produção. Dependências, restauração integral e cobrança continuam pendentes. Orientações em [restauração](TESTE-RESTAURACAO-PASSO-A-PASSO.md) e [planos/checkout](PLANOS-E-CHECKOUT.md).

## Parecer

O produto tem funcionalidades suficientes para validar uma oferta. Ainda não recomendo divulgação ampla ou lançamento pago na América Latina: há pendências de segurança, recuperação, operação comercial e adaptação regional. Um piloto pequeno no Brasil é o próximo passo, depois das correções prioritárias. Não é necessário adicionar Open Finance ou WhatsApp para começar.

Esta revisão leu código e configurações públicas, executou testes locais e consultou o catálogo/advisors do Supabase somente em leitura. Não alterou dados ou configurações de produção. Não foi um pentest completo, teste de carga ou validação visual ponta a ponta com contas reais.

## Evidências atuais

- `npm test`: **134 testes aprovados**, zero falhas. Cobertura inclui pagamentos entre quadros, importação, categorias, cotas da IA, sessões, tickets e modal de quadro.
- TypeScript (`tsc --noEmit`): aprovado.
- ESLint em `app`, `components`, `lib`, `context`, `scripts` e `tests`: aprovado. A primeira execução geral no ambiente restrito ficou sem resposta e foi interrompida; a execução nessas pastas fora da restrição concluiu sem erros.
- Compilação: `npm run build -- --webpack` **aprovado**, incluindo geração das rotas e checagem TypeScript. O build padrão com Turbopack não concluiu: primeiro houve bloqueio de acesso a fontes do Google no ambiente restrito e, com acesso externo, falha interna ao iniciar processo de transformação de CSS no Windows. Isso não comprova falha do deploy Linux; falta validar o compilador padrão em preview ou resolver a falha local. Nenhuma configuração do compilador foi alterada no projeto.
- `node tests/security-review.mjs`: reproduziu, com troca de sessão simulada, redirecionamento para outro domínio quando `next=@phishing.invalid/login`. A concatenação em `app/auth/callback/route.ts` continua presente. Não houve envio de credenciais para terceiros. O teste de filtro SQL do SDK não representa auditoria completa das funções do banco.
- `npm audit --omit=dev`: **20 pacotes sinalizados**, sendo 2 críticos, 13 altos, 4 moderados e 1 baixo. São pacotes afetados na árvore, não 20 caminhos de exploração comprovados em produção. Next instalado: 16.3.1; a consulta sugere 16.4.2. A cadeia do shadcn inclui dependências de CLI/Express: verificar exposição e necessidade antes de atualizar ou remover; não aplicar `audit fix --force` indiscriminadamente.
- Produção: `/login` respondeu 200; `/privacy` e `/terms` responderam 404.
- Supabase: as dez tabelas públicas consultadas têm RLS habilitada. As políticas principais restringem linhas por `auth.uid() = user_id`. Isso não substitui testar todas as operações com duas contas.
- `delete_board_cascade`: execução anônima bloqueada, `SECURITY INVOKER`, `search_path` fixado. A correção anterior permanece instalada.
- Advisors: duas funções de trigger ainda têm `search_path` mutável; proteção contra senhas vazadas desativada; sete funções privilegiadas acessíveis a autenticados. As funções administrativas de escrita/listagem lidas verificam papel de suporte/proprietário internamente: o aviso, sozinho, não comprova acesso indevido. Quatro tabelas sem políticas são bloqueadas por padrão e atendidas por rotinas controladas; não abrir acesso apenas para remover o aviso.
- Desempenho: sete FKs sem índice de cobertura e doze políticas com reavaliação de Auth por linha. Não foi medido impacto sob carga; não remover índices apenas por pouco uso em base pequena.
- Backup manual de 18/10: sucesso. Backup automático de 19/10: sucesso, [execução 39257162068](https://github.com/letscodewill/expense-tracker/actions/runs/39257162068). O agendamento pode sofrer atraso no GitHub; esta execução começou às 10h05 de São Paulo, apesar do cron às 03h17.
- HD: `C:\backupNoControle\nocontrole-2026-10-19T13-06-05-da242c51` existe e passou em `scripts/backup.mjs verify`, autenticando os arquivos com a chave atual. Nenhum conteúdo foi restaurado em banco.
- Não há comprovação de restauração integral de banco, Auth e Storage em ambiente separado.

## Prioridades antes de ampliar o acesso

| Prioridade | Pendência | Critério para concluir |
| --- | --- | --- |
| P0 | Redirecionamento externo no callback de autenticação | Aceitar somente destinos internos válidos; testar URLs absolutas, `@`, barras invertidas, caminhos normais e recuperação de senha |
| P0 | Dependências com avisos críticos/altos | Atualizar versões compatíveis, repetir auditoria, testes, compilação e validar preview; avaliar aplicabilidade dos avisos restantes |
| P0 | Compilação padrão ainda não validada nesta máquina | Resolver/explicar a falha interna do Turbopack e confirmar build do mesmo commit em preview antes do lançamento |
| P1 | Recuperação completa | Restaurar em outro projeto, conferir usuários, login, despesas, relações, RLS e arquivos; documentar tempo e configurações externas |
| P1 | Privacidade e termos ausentes | Publicar documentos correspondentes ao serviço real, países atendidos, IA/terceiros, retenção e canais de solicitação de direitos; revisar adequação jurídica ao mercado escolhido |
| P1 | Exportação/exclusão integral de conta | Disponibilizar processo seguro e documentado, mesmo que inicialmente atendido manualmente; PDF de despesas não equivale à exportação completa |
| P1 | Cobrança e acesso pago ausentes | Checkout vinculado ao UUID, webhook autenticado e idempotente, permissões no servidor; testar renovação, atraso, cancelamento e reembolso |
| P1 | Plano comercial de hospedagem não confirmado | Confirmar plano da Vercel; Hobby é restrito a uso pessoal não comercial, conforme documentação oficial |
| P1 | Operação e custos | Alertas de erro/indisponibilidade/backup, suporte com prazo definido, custos por usuário e análise de IA, teto operacional e proteção contra abuso de novas contas |
| P2 | Desempenho e prevenção de reenvios | Medir consultas, revisar índices/RLS, testar carga representativa e considerar identificadores idempotentes para importações/lançamentos |

## O que falta especificamente para outros países da América Latina

1. **Espanhol completo:** atualmente `Language` permite somente `pt-BR` e `en`. Incluir interface, validações, relatórios, e-mails, onboarding e suporte; testar com alguém do país inicial.
2. **Moeda independente do idioma:** valores são apresentados como BRL em vários componentes e relatórios. Começar com uma moeda por conta, armazenada e aplicada consistentemente. Não basta substituir o símbolo. Evitar somar moedas diferentes; conversão automática não é pré-requisito se o produto declarar claramente essa limitação.
3. **Importação regional:** o prompt da IA pede explicitamente fatura brasileira e valores em reais. Revisar datas, separadores decimais, formato de planilhas, faturas e regras de vencimento do mercado escolhido. Testar amostras autorizadas e anonimizadas, com revisão antes de gravar.
4. **Operação comercial por país:** validar disponibilidade do meio de pagamento para a empresa e para compradores do país, meios locais, moeda de cobrança, taxas, cancelamento, tributos e documentos. A escolha depende de onde a empresa está estabelecida e do primeiro país atendido; não assumir que uma integração cobre toda a região.
5. **Oferta e confiança:** preço e limites claros, demonstração do produto, canal de suporte em espanhol e promessas compatíveis com a implementação. Lembretes atuais não equivalem a push garantido com o app fechado; não prometer integração bancária existente.

## Sequência recomendada

1. Corrigir segurança e estabilizar build; validar preview do commit a publicar.
2. Provar restauração e completar privacidade, direitos dos usuários e alertas.
3. Escolher um país e um plano inicial; medir custo e testar cobrança ponta a ponta.
4. Fazer piloto acompanhado com grupo pequeno no Brasil.
5. Adaptar espanhol/moeda/importação e abrir um segundo piloto em um único país hispanofalante antes de expandir a região.

## Fontes e limites externos

- [Vercel Hobby — uso pessoal não comercial](https://vercel.com/docs/plans/hobby). O plano efetivo da conta não foi acessado nesta revisão.
- [Aviso Next.js/AVIF](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) e [servidores Windows](https://github.com/advisories/GHSA-p293-qw3h-jr36). A presença de uma versão afetada não comprova exploração na Vercel.
- [Supabase: search_path mutável](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).
- Não foram confirmados dados do Analytics, entrega real de e-mails em diferentes provedores, custos completos por cliente ou disponibilidade jurídica/comercial em todos os países. Nenhum pagamento, migração de dados ou mudança de plano foi executado.
