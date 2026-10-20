# Idioma, moeda de exibição e páginas públicas

## Idioma

Na primeira visita, sem preferência salva, o sistema usa o idioma informado pelo navegador (`Accept-Language`), respeitando a ordem e os pesos de preferência. Variantes como `es-MX`, `en-US` e `pt-PT` usam espanhol, inglês e português, respectivamente. Sem idioma compatível ou sem preferência informada pelo navegador, inglês é o padrão. Não há consulta de IP, localização ou serviço externo. O seletor oferece Português, English e Español (locale `es-419`); a escolha salva no cookie/armazenamento local prevalece sobre a detecção, inclusive ao sair e entrar novamente neste navegador. A preferência ainda não é sincronizada entre dispositivos pela conta. O dicionário espanhol cobre as mesmas chaves do inglês; placeholders são verificados nos testes.

Textos cadastrados pelo usuário, nomes de quadros/categorias, comentários e os valores originais não são traduzidos ou alterados no banco. Status são apresentados traduzidos e continuam gravados com os códigos originais. E-mails enviados pelo Supabase/SendGrid são templates externos e precisam de configuração própria; esta alteração não os traduz automaticamente. Avisos produzidos dinamicamente pelo modelo de IA ainda podem estar no idioma do prompt brasileiro.

## Moeda de exibição

O seletor BRL/USD é independente do idioma e fica junto ao seletor de idioma. BRL é o padrão. A preferência fica neste navegador e sincroniza abas; não é uma configuração da conta no banco. Com armazenamento bloqueado, a escolha funciona durante a sessão da página.

A escolha muda a apresentação dos mesmos números: não consulta cotação, não converte saldo e não migra registros. O símbolo `$` identifica USD conforme o seletor; não anuncia câmbio. Painel, busca, totais, previsões de parcelas, revisão de importações, orçamentos e relatórios/PDF usam a escolha. Importação e parsing de números continuam com os formatos suportados anteriormente; escolher USD não transforma um PDF brasileiro em uma fatura internacional.

Nenhuma escrita financeira recebeu campo ou fator de moeda. A moeda de cobrança de uma futura assinatura será uma decisão separada.

## Páginas públicas

- `/privacypolicy`: política de privacidade.
- `/termsofservice`: termos de uso.
- `/privacy` e `/terms`: aliases para os endereços acima.

As páginas abrem sem login em três idiomas, seguindo a preferência do navegador/cookie, com links no login e no cadastro. O contato público aprovado é `suportenocontroleofc@gmail.com`. Opcionalmente, `NOCONTROLE_SUPPORT_EMAIL` no servidor pode substituir o endereço; não é necessário configurar para utilizar o endereço aprovado.

Os textos descrevem a implementação atual. Quando o país e os planos forem definidos, revisar identidade completa do fornecedor/controlador, condições jurídicas/fiscais locais, fornecedor de pagamento e cláusulas de cobrança antes de ativar assinaturas. Esta implementação não comprova adequação jurídica em toda a América Latina nem aprovação OAuth pelo Google.

## Segurança e publicação

O callback autentica normalmente, mas só aceita `next` como caminho interno no mesmo domínio. Valores como `@host`, URLs absolutas, `//host`, barras invertidas e controles/espaços inválidos retornam à página inicial. Links internos de recuperação de senha continuam permitidos. O teste roda com troca de sessão simulada, sem credenciais reais.

É necessário publicar o código para que as URLs cadastradas no Google deixem de retornar 404 em produção e para que a correção do callback alcance o domínio público. Não há migração do banco nem mudança de secrets obrigatória para essas alterações. O servidor de teste da revisão usou a porta 3210.

Validação desta entrega: 141 testes aprovados, ESLint sem avisos e build com Webpack aprovado. No navegador, login e documentos públicos foram conferidos em espanhol, com USD selecionado e viewport móvel de 390 pixels sem rolagem horizontal. Nenhuma restauração, cobrança ou publicação foi executada.
