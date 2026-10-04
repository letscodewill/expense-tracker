# Ativar o painel de tickets

## Gerenciar administradores pelo Dashboard

Execute também `migrations/202610040002_ticket_administrators.sql`, depois da primeira migração. Publique o código atualizado. Somente a conta proprietária confirmada verá **Administradores** no Dashboard. Adicione o e-mail de uma conta cadastrada e confirmada; o acesso é vinculado ao UUID dessa conta. Para remover, escolha **Remover** e confirme. O proprietário não pode ser removido, inclusive por chamada direta ao banco. A remoção bloqueia as próximas consultas e ações de tickets, inclusive em sessões já abertas; dados já exibidos não podem ser recolhidos.

Administradores delegados recebem somente acesso ao painel de tickets, sem gerenciar acessos. Não é necessário publicar novamente para adicionar ou remover administradores. As funções verificam autorização no banco e as tabelas de permissões não são acessíveis diretamente pelo navegador.

Após aplicar ambas as migrações, valide com proprietário, administrador e usuário comum: adição repetida não duplica; conta inexistente ou não confirmada é recusada; administrador delegado não lista nem altera permissões; remoção revoga acesso aos tickets; proprietário não pode ser removido. Essas verificações de SQL/RLS exigem o banco real.

O código está preparado. Para ativar, execute o arquivo `migrations/202610040001_ticket_support.sql` no SQL Editor do projeto Supabase, como administrador do banco. A chave pública/anon usada pela aplicação não pode aplicar migrações, e nenhuma chave privilegiada deve ser enviada ao navegador.

A migração requer que `public.reports` exista com `protocol_number`, `subject`, `message`, `user_id`, `user_email` e `user_name`, como usados pelo formulário atual. A conta `williansantos38@gmail.com` precisa existir e ter o e-mail confirmado. O script é transacional: se qualquer pré-condição falhar, não aplica mudanças parciais.

Ela preserva os tickets existentes, acrescenta status, cria o histórico de respostas e associa a permissão administrativa ao UUID da conta master. Substitui as políticas RLS somente das tabelas de suporte, preservando despesas, quadros e salários. Confira eventuais integrações externas que usavam políticas antigas de suporte antes da execução. Usuários comuns podem criar e ler apenas seus tickets; respostas e mudanças de status são permitidas exclusivamente pelas funções que verificam a conta master no banco.

Depois da migração:

1. Entre como master: o Dashboard apresenta **Painel de tickets** (`/admin/tickets`).
2. Consulte, filtre, responda, responda e finalize, ou reabra um ticket. Respostas ficam no histórico do aplicativo; não são enviadas por e-mail.
3. Outros usuários usam **Meus tickets** (`/tickets`) para consultar seus protocolos, status e respostas. Não recebem a aba administrativa e não conseguem acessar tickets de terceiros.
4. Valide com duas contas: acesso administrativo deve retornar 404 para uma conta comum; consultas ao histórico de outro usuário devem retornar 404; ações administrativas diretas devem ser negadas.

O painel carrega 100 tickets por vez, com botão para carregar mais. Busca, filtros e contagens consideram os tickets carregados. Não há exclusão de tickets ou respostas na interface, para preservar o histórico.

Verificações locais: `npm test`, `npm run lint` e `npm run build`. Os testes usam serviços simulados; a aplicação da migração e a validação de RLS no banco real precisam ser realizadas no projeto Supabase.
