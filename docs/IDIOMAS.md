# Idiomas do NoControle

Português é o padrão. English está disponível no cabeçalho do login, no menu do painel e no topo das demais páginas. A troca também altera os títulos, textos de acessibilidade, mensagens conhecidas de erro, datas e relatórios PDF.

A preferência usa `nocontrole:language` no armazenamento do navegador e um cookie `nocontrole-language` de um ano para renderizar as páginas no idioma escolhido. É uma preferência deste navegador, não uma configuração sincronizada pela conta. Com armazenamento bloqueado, a troca continua funcionando durante a visita. Não há serviço de tradução externo nem cobrança por tradução.

Os valores continuam em BRL. A formatação de números e datas segue o idioma. O campo de pesquisa por valor continua aceitando o formato brasileiro explicado na própria interface. Nomes de usuários, despesas, quadros, categorias personalizadas, comentários e mensagens de tickets são preservados. Os valores internos `Pago`, `Pendente`, `VR/VA` e os códigos de tickets permanecem os mesmos no banco.

O dicionário inglês está em `lib/i18n/en.json`. Componentes usam `useLanguage()` e páginas no servidor usam `getServerTranslation()`. Mensagens com números ou nomes usam parâmetros, por exemplo `t('Importar {count} despesa(s)', { count: rows.length })`. Novos textos precisam de uma entrada neste dicionário. Quando não existe tradução, o texto original é mantido.

A página offline tem um arquivo público pequeno de tradução, sem dados financeiros, incluído no cache público do PWA. A instalação mantém o nome NoControle. E-mails enviados pelo provedor de autenticação e avisos escritos pela IA têm configurações próprias; este seletor não traduz conteúdos externos.
