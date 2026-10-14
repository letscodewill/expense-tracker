# Avaliação de prontidão para monetização — 14/10/2026

**Decisão recomendada:** preparar a oferta agora, mas corrigir os pontos críticos antes de aceitar pagamentos ou ampliar a divulgação. O produto já tem funcionalidades suficientes para uma primeira versão paga. Esta análise não habilitou cobrança nem alterou código funcional, configurações ou dados de produção.

**Atualização após autorização do usuário — 14/10/2026:** a exclusão de quadros foi corrigida e testada no Supabase pela migração `20261014223610_secure_board_deletion.sql`. As descrições da falha abaixo são o registro da condição anterior. A função deixou de usar privilégios elevados, não permite chamada anônima e restringe exclusão/limpeza à conta autenticada. Os vínculos de despesas e resumos também passaram a exigir o mesmo proprietário. Testes de exclusão, isolamento e pagamentos passaram com rollback; detalhes em [BOARD_DELETION.md](../supabase/BOARD_DELETION.md). Os demais pontos continuam pendentes.

## Evidências e limites

- Revisão do código atual, rotas, dependências, documentação e workflow de backup.
- Consultas somente de leitura no Supabase conectado: advisors, políticas RLS, definições e permissões de funções. Nenhuma exclusão foi executada para demonstrar os problemas.
- `npm test`: 132 testes aprovados, incluindo autenticação, importação, categorias, duplicidades, relatórios, quotas e criptografia/recuperação de arquivos. Vários testes usam serviços simulados: isso não comprova todos os fluxos em produção nem uma restauração completa do Supabase.
- `npm run lint`: aprovado.
- `npm audit --omit=dev`: 20 pacotes sinalizados — 2 críticos, 13 altos, 4 moderados e 1 baixo. Estes números representam a árvore de dependências, não 20 falhas exploráveis comprovadas na aplicação.
- A verificação aprofundada abaixo confirmou o backup em Drive/HD, a falha agendada de 14/10 e os status HTTP do site publicado. Plano contratado da Vercel, coleta efetiva no painel Analytics, entregabilidade do SendGrid e custos reais dos provedores ainda dependem de acesso aos respectivos painéis. A abertura de `docs/BACKUP.md` está desatualizada sobre a ativação do agendamento.

## Verificação aprofundada — mesma data

### Segurança: confirmação e novo achado

- As consultas de permissões confirmaram `delete_board_cascade` com execução anônima e autenticada, proprietário `postgres` com `BYPASSRLS`, sem verificação de dono na função. Nenhuma exclusão foi executada.
- `node tests/security-supabase-probe.mjs`: chamadas HEAD anônimas para despesas, quadros e salários retornaram zero linhas visíveis; tickets recusaram acesso com HTTP 401. Isso confirma essas leituras anônimas, mas não elimina o risco da função privilegiada.
- `node tests/security-review.mjs`: confirmou **redirecionamento externo após autenticação** em `app/auth/callback/route.ts`, com código de sessão simulado e domínio fictício. A concatenação de origem com um `next` não validado permite interpretar parte da URL como credenciais e mudar o host. Corrigir aceitando apenas caminhos internos válidos e verificando a origem final. Não foram usados tokens reais nem visitado o destino fictício.
- O mesmo teste mostrou que a entrada com aparência de SQL é preservada como valor pelo SDK. Isso não é uma auditoria completa de SQL injection de todas as funções do banco.

### Backup: agendamento ativo, autorização quebrada e risco na reautorização

- A API do GitHub confirmou execuções **agendadas**, bem-sucedidas de 10 a 13/10. A execução de **14/10 falhou**: [execução 38558958045](https://github.com/letscodewill/expense-tracker/actions/runs/38558958045).
- A falha está na geração/envio, depois dos testes de criptografia: o log aponta `Autorização Google expirada ou inválida`. O teste local de renovação OAuth confirmou `invalid_grant`, sem imprimir tokens. Logo, reexecutar o workflow com as mesmas credenciais não resolve a causa.
- O modo de publicação do OAuth no Google Cloud não foi verificado. **Se estiver em Testing**, o escopo Drive está sujeito à expiração do refresh token em sete dias; revogação também pode causar o erro. [Documentação do Google](https://developers.google.com/identity/protocols/oauth2#expiration).
- O Google Drive conectado confirmou a pasta **Backups NoControle** sem compartilhamento e backups até 13/10. A última subpasta contém `database.dump.enc`, `roles.sql.enc` e `manifest.json.enc`, todos privados. A presença foi confirmada por metadados, sem leitura de conteúdo financeiro pelo conector.
- A cópia local de 13/10 em `C:\backupNoControle\nocontrole-2026-10-13T14-07-11-c8bbbad3` passou novamente em `node --env-file=.env.backup.local scripts/backup.mjs verify ...`. A chave atual consegue autenticar essa cópia; nenhum arquivo descriptografado foi gravado.
- A tarefa Windows está **Ready**, `StartWhenAvailable=True`, com última execução **13/10/2026 19:03:46**, resultado **0**, próxima **15/10/2026 07:30**. Essa execução anterior não prova que a autorização ainda funciona hoje; o teste atual de renovação falhou.
- **Novo achado crítico no configurador:** `scripts/backup/configure-google.mjs` declara `existing` para as configurações e novamente para a lista de pastas. O segundo valor encobre o primeiro. Ao reautorizar, o script gera outra chave de criptografia e apaga os campos de conexão do banco, contrariando a documentação. `node tests/backup-reauthorization-review.mjs` reproduziu isso com arquivos, OAuth e Drive simulados; nenhum arquivo real foi modificado.
- Corrigir e testar o configurador **antes de reexecutá-lo**, preservar a chave existente e suas credenciais, verificar o estado de publicação OAuth, reautorizar e atualizar o refresh token nos Secrets do GitHub. Depois testar uma geração nova e a sincronização no HD. Não trocar `BACKUP_ENCRYPTION_KEY` para recuperar os arquivos antigos.
- A listagem do Supabase mostrou somente o projeto de produção. Não há destino Supabase isolado identificado para comprovar a restauração completa. A verificação de integridade não equivale a recuperar Auth, banco, Storage e login em outro projeto. Nenhuma restauração foi tentada contra produção.

### Site publicado, cobrança e custos

- HEAD no domínio publicado: `/login` **200**, `/privacy` **404**, `/terms` **404**, `/_vercel/insights/script.js` **200**. O script disponível é evidência de provisionamento, não de coleta bem-sucedida ou de quantidade de visitantes.
- Não foram encontrados fluxo de checkout/webhook, planos pagos ou tabelas correspondentes no banco conectado. A assinatura ainda não está implementada.
- A cota persistente da IA existe; o banco registra **duas análises concluídas no mês** no momento da verificação. Isso é contagem de uso, não custo, margem ou consumo de tokens. A API não registra o `usage` retornado pelo provedor para controle de custo por análise.
- A verificação local mostrou chave/modelo da IA configurados sem expor valores. Configuração local não comprova todas as variáveis do deploy.
- O painel da Vercel pediu login. Foi solicitado acesso ao usuário para verificar plano, deploy e dados de Analytics. Nenhum upgrade, cobrança ou configuração paga foi ativado.
- Não foram encontrados alertas de aplicação/uptime no código ou workflows de testes de aplicação por PR. O workflow de backup registra resultado e a plataforma pode enviar avisos segundo as preferências da conta; essas preferências externas não foram confirmadas.

### Resultado e ordem de ação

**Ainda não liberar cobrança:** corrigir a exclusão privilegiada, o redirecionamento externo e o configurador de reautorização; recuperar o backup agendado; atualizar dependências; comprovar recuperação isolada; completar privacidade e operação; então implementar/testar cobrança. As verificações foram somente de leitura nos serviços e simulações locais, sem modificar produção.

## O que já sustenta uma oferta inicial

- Login Google/e-mail, recuperação de senha e política de sessão persistente.
- Quadros mensais, despesas avulsas, parceladas e recorrentes; pagamentos sincronizados entre quadros.
- Categorias da conta, orçamento mensal, comparação entre meses e avisos de vencimento.
- Pesquisa por nome, valor, datas e categorias.
- Importação de PDF padrão/com IA e Excel/CSV, revisão antes de gravar e alertas de possíveis duplicidades.
- Categorias sugeridas pela IA; cota persistente de quatro análises mensais por conta e limites de arquivo.
- Relatórios em PDF, temas, português/inglês, PWA e tutorial.
- Tickets, respostas, administradores e métricas de usuários no painel master.
- Integração do Vercel Analytics e rotina de backups criptografados em Drive/HD.

## Prioridade 0: corrigir antes de cobrar

### Exclusão de quadros sem autorização no banco — corrigida

Confirmado no banco: `public.delete_board_cascade(uuid)` é `SECURITY DEFINER`, pertence a `postgres`, cujo papel possui `BYPASSRLS`, e tem permissão de execução para `anon` e `authenticated`. Sua definição não verifica `auth.uid()` nem se o quadro pertence ao solicitante. Logo, a RLS das tabelas não protege esta chamada privilegiada.

Além disso, a limpeza de quadros futuros compara nome e período, sem filtrar `user_id`. Mesmo uma exclusão legítima pode atingir quadros vazios de outras contas com o mesmo nome. A chamada é usada por `components/expenses-dashboard.tsx`.

Correção necessária: bloquear execução anônima, exigir sessão e propriedade no banco, restringir todos os efeitos à mesma conta e fixar `search_path`/qualificar objetos. Preferir execução com os privilégios do usuário quando possível. Testar usuário A/B, chamada anônima, quadros homônimos, parcelas, recorrências e rollback em ambiente separado, antes de aplicar a migração. Não remover simplesmente a função sem substituir o fluxo utilizado pela interface.

Referências: [execução anônima de funções privilegiadas](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable). O aviso já constava em `supabase/BOARD_PAYMENTS.md`; esta análise confirmou o risco lendo a implementação completa.

### Dependências com correções de segurança pendentes

O projeto usa Next.js `16.3.1`, presente nas faixas afetadas de advisories críticos e outros avisos. Atualizar para uma versão corrigida compatível e revisar as demais dependências; repetir testes, lint, compilação e uma verificação em preview antes de publicar.

A exposição depende do recurso e ambiente: o aviso de servidores Windows não comprova exposição do deploy na Vercel; os avisos de otimização de imagens e `next/og` também exigem avaliar uso/configuração. `proxy-addr`, outro pacote crítico, vem da cadeia `shadcn → SDK MCP → express`, e não foi encontrado um servidor Express da aplicação. A importação de `shadcn/tailwind.css` não implica que seu servidor MCP esteja exposto.

Não executar `npm audit fix --force` indiscriminadamente: a sugestão automática para `shadcn` inclui uma troca de versão principal que precisa de avaliação.

Referências: [Next.js e otimização AVIF](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4), [Next.js em servidores Windows](https://github.com/advisories/GHSA-p293-qw3h-jr36).

## Prioridade 1: completar o lançamento pago

| Frente | Estado observado | Entrega necessária |
|---|---|---|
| Recuperação | Criptografia e integridade testadas; restauração completa ainda não comprovada | Restaurar banco, Auth e Storage em destino separado; validar login, RLS, relações e operação; documentar tempo de recuperação e chave/configurações externas |
| Privacidade e atendimento de direitos | Não existem rotas implementadas `/privacy` e `/terms`; não foi encontrado fluxo de solicitação de exclusão/exportação completa de conta | Publicar documentos específicos do serviço e estabelecer canal/processo seguro para solicitações, retenção e eliminação; pode começar com atendimento manual documentado |
| Cobrança | Não foram encontrados checkout, tabela de assinatura ou validação de plano pago | Definir planos; vincular checkout ao UUID da conta; validar webhooks, impedir processamento repetido e controlar permissões no servidor; tratar cancelamento, falha, reembolso e conciliação |
| Hospedagem comercial | Plano da conta não confirmado | Se estiver no Vercel Hobby, migrar para Pro/Enterprise ou hospedagem compatível com uso comercial antes de monetizar |
| Custos de IA | Cota por usuário existe; não foi encontrado registro de tokens/custo por análise nem bloqueio global de consumo no app | Medir custo por fatura/usuário, definir alertas e orçamento operacional; controlar abuso de novas contas e permitir desligar a IA preservando o controle manual |
| Operação | Há tickets e logs, mas não foi encontrada integração no repositório para alertas de indisponibilidade/exceções | Confirmar ou configurar alertas de falha do backup, aplicação e envio de e-mails; organizar prazo e canal de suporte |
| Oferta | Login apresenta o produto; não há página de planos/compra | Publicar preço, limites, renovação, cancelamento, demonstração e condições para usuários atuais; validar margem incluindo hospedagem, IA e taxas |

Direitos dos titulares: [orientação da ANPD](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares). Os detalhes jurídicos/fiscais devem ser definidos para o modelo e público efetivamente atendidos. O PDF atual é relatório de despesas, não uma exportação integral e portável da conta.

Vercel: [Hobby é para uso pessoal e não comercial](https://vercel.com/docs/plans/hobby).

## Melhorias que podem seguir ao primeiro lançamento

- Índices e otimização de RLS: advisors apontaram sete chaves estrangeiras sem índice de cobertura e doze políticas que reavaliam funções Auth por linha. Corrigir com medições antes de escalar; não foi feito teste de carga nesta análise. [Índices](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).
- Proteção contra senhas vazadas está desativada, conforme advisor. Avaliar disponibilidade no plano e fortalecer contas administrativas. [Orientação do Supabase](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Histórico de alterações, desfazer exclusões e exportação estruturada da conta aumentam confiança.
- Confirmações de importação/lançamentos com identificadores de operação podem melhorar a proteção contra reenvio após resposta perdida; os alertas atuais não são uma garantia transacional contra duplicidades entre dispositivos.
- Notificações atuais de vencimento exigem a página de planejamento aberta; não anunciar push com o app fechado. Tickets têm avisos dentro do painel, não e-mail automático já confirmado.
- Espanhol e adaptação de moedas se a oferta inicial abranger a América Latina fora do Brasil.
- Open Finance, WhatsApp, áudio e captura de notificações bancárias podem esperar. Não são pré-requisitos para validar uma assinatura inicial.

## Critério para liberar um piloto pago

1. Corrigir a exclusão privilegiada e validar isolamento com duas contas.
2. Publicar dependências corrigidas após testes e preview.
3. Concluir e registrar uma restauração separada do ambiente de produção.
4. Publicar informações de privacidade/serviço e definir atendimento e recuperação.
5. Confirmar hospedagem comercial, custos e alertas.
6. Testar o ciclo de cobrança e permissões: compra, renovação, eventos repetidos, falha e cancelamento.
7. Começar com um grupo pequeno e um único plano Pro, acompanhando ativação, suporte, custos e cancelamentos.

Se optar por anúncios, a parte de segurança, recuperação, privacidade e hospedagem comercial continua necessária; a integração de assinatura é substituída pelas exigências e aprovação da rede de publicidade.
