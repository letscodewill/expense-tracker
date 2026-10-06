# Instalação do NoControle

O sistema é instalável pela tela inicial usando o domínio HTTPS publicado na Vercel. O manifesto `/manifest.webmanifest` define nome NoControle, ícones 192/512, ícone maskable, escopo raiz e abertura em modo standalone. O ícone Apple tem 180 px. O botão Instalar aplicativo fica no login e na navegação do Dashboard. Quando o navegador oferece instalação nativa, o botão abre esse pedido; caso contrário, mostra orientações. No modo instalado, o botão fica oculto.

Android: abrir no Chrome, usar Instalar aplicativo ou o menu → Adicionar à tela inicial. iPhone: abrir no Safari → Compartilhar → Adicionar à Tela de Início → Adicionar; ativar Abrir como App quando oferecido. O funcionamento e os nomes das opções variam por navegador. Não há publicação automática nas lojas de aplicativos.

O service worker é registrado somente em produção e em contexto seguro. A origem localhost é permitida para testes; um endereço HTTP por IP da rede local normalmente não permite instalação. O domínio de produção HTTPS atende a esse requisito. Não são necessárias novas variáveis de ambiente nem migrações no banco.

O cache do service worker contém somente a tela pública sem conexão e os ícones. Navegações usam a rede e recebem a tela sem conexão quando a requisição falha. POST, APIs, callbacks OAuth, respostas RSC e páginas financeiras não são armazenados por esse worker. Não há leitura offline de despesas nem fila offline de alterações. O login continua usando o mecanismo existente; um aplicativo instalado pode exigir login próprio conforme o compartilhamento de sessões do navegador/aparelho. Não há mudanças nos redirecionamentos Google.

O worker não é armazenado em cache HTTP e atualiza os recursos públicos ao mudar seu conteúdo. Na ativação remove somente versões antigas do cache NoControle. Alterar a estratégia de cache exige incrementar sua versão. Os ícones são gerados a partir de `public/icons/icon-source.png` com `node scripts/generate-pwa-icons.mjs` e seus PNGs já são versionados; o build não depende dessa geração. O favicon de navegador possui 32 px. O novo desenho usa o bloco de anotações e o símbolo de real do favicon fornecido pelo usuário, com cores roxas e lavanda. Na tela de login, o botão Instalar aplicativo fica abaixo de Criar conta.

Validações locais: manifesto e recursos públicos HTTP 200, MIME correto e cabeçalhos do worker, ícones com dimensões válidas, fluxo de instruções e modo standalone simulado, prompt nativo simulado, políticas do cache e fallback offline, layout em viewport 390×844, lint e build de produção. A instalação real e a retomada de login devem ser verificadas em Android/iPhone depois do deploy.

Esta entrega não adiciona envio de notificações em segundo plano. Os lembretes existentes continuam dependentes da página Orçamento e lembretes aberta; push com o app fechado requer outra implementação.
