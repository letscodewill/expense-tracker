# Painel administrativo e avisos de tickets

O menu da conta master contém **Painel administrativo** (`/admin`). A tela mostra
usuários cadastrados e confirmados, novos cadastros, acessos nos últimos 7 e 30 dias
e usuários com atividade em despesas nos últimos 30 dias. A lista de usuários tem
busca por nome/e-mail e paginação de 50 contas.

As métricas e a lista são exclusivas do proprietário confirmado em `support_owner`.
Administradores delegados continuam com acesso apenas ao atendimento e aos avisos.
As verificações ocorrem nas páginas, nas APIs e na função privada do banco.
Nenhum valor de despesas, senha, token ou histórico detalhado é enviado a essa tela.

## Atividade

- Último acesso: a data mais recente entre login e visita registrada pelo aplicativo.
- Visitas: registradas quando o aplicativo está visível, com intervalo mínimo de
  5 minutos. Isso não mede presença em tempo real nem duração de uso.
- Atividade em despesas: criação, alteração ou exclusão feita pelo próprio usuário;
  despesas que representam resumos de quadros não são contabilizadas.
- Histórico: datas de criação dos lançamentos existentes foram utilizadas como
  referência inicial. Visitas e outras alterações só têm histórico após a ativação.
- A tabela está em `app_private`, com RLS, sem acesso direto pelas contas do app.
  Os backups existentes incluem esse schema e já cobrem a nova tabela.

## Avisos de chamados

O sino aparece para administradores no painel de despesas e nas páginas de
administração. Mostra o total de tickets abertos e em atendimento, consultado
a cada minuto enquanto a página está visível e quando a aba volta ao foco.
Um novo protocolo gera um aviso com link para o atendimento; protocolos existentes
na abertura da página aparecem no contador sem produzir um aviso repetido.

Não há envio de e-mail, notificações push ou aviso com a página fechada nesta etapa.
E-mail pode ser integrado depois com um provedor de envio e um remetente verificado;
deve ter fila e retentativas para não bloquear a criação do ticket.

## Banco e publicação

A migração `20261009221420_admin_overview_activity.sql` foi aplicada no Supabase.
As novas telas, APIs e coleta de visitas precisam ser publicadas na Vercel.
O arquivo `admin-overview.sql` contém a mesma estrutura para referência.
