# Vercel Web Analytics

O componente no layout principal usa `@vercel/analytics/next` para medir visualizações e visitantes nas páginas do NoControle, incluindo navegação sem recarregar a página. Não há eventos personalizados de despesas, salários, faturas ou dados de usuários.

Antes de coletar, `lib/web-analytics.ts` remove parâmetros, fragmentos e credenciais das URLs, agrupa as páginas de detalhes de chamados como `/tickets/[id]` ou `/admin/tickets/[id]` e ignora callbacks de autenticação e rotas desconhecidas. Ao adicionar páginas novas, atualizar a lista permitida. Nenhum ID de chamado é enviado por este filtro. Os dados usuais coletados pelo SDK e a política da Vercel continuam aplicáveis: https://vercel.com/docs/analytics/privacy-policy.

## Ativação

1. Na Vercel, abrir **Analytics**, selecionar o projeto do NoControle e clicar em **Enable** para Web Analytics.
2. Publicar o código com um novo deploy. Não é necessária chave de API ou variável de ambiente para um projeto hospedado na Vercel.
3. Acessar o site publicado e navegar pelas páginas. Consultar Analytics para verificar as primeiras visualizações; bloqueadores podem impedir a coleta.

A coleta começa após ativação e publicação, sem recuperar visitas anteriores. Desenvolvimento local não envia eventos de produção e os logs de depuração do SDK foram desativados. O plano da conta determina franquia e custos; conferir https://vercel.com/docs/analytics/limits-and-pricing antes de habilitar recursos pagos. Speed Insights não foi adicionado.
