# Apresentação de funcionalidades

O painel apresenta cinco etapas: cadastro no mês certo, importação de faturas e planilhas, orçamento e lembretes, pesquisa rápida e personalização. As ilustrações usam exemplos fictícios, seguem o tema escolhido e têm textos em português e inglês.

Todos os usuários recebem a apresentação ao acessar o painel. Fechar sem marcar “Não mostrar novamente” dispensa apenas a visita atual. A identificação da visita usa o usuário e a data do último login em `sessionStorage`, para não repetir o modal a cada navegação. Um novo login ou uma nova sessão de navegador permite mostrar novamente. Se o armazenamento do navegador estiver bloqueado, essa deduplicação é feita apenas enquanto o componente permanece montado.

Marcar a opção e fechar salva `nocontrole_dismissed_tour` nos metadados da própria conta, com `auth.updateUser`. A escolha vale nos demais aparelhos e é verificada no servidor com `auth.getUser`. Essa preferência não participa de decisões de autorização. Antes de salvar, a identidade autenticada é conferida para impedir que uma troca de conta salve a preferência no usuário errado. Falhas mantêm o modal aberto e explicam como tentar novamente ou fechar sem salvar.

O item “Ver novidades” no menu permite reabrir a apresentação mesmo depois de dispensá-la. A caixa reflete a preferência salva; desmarcar e fechar permite que ela apareça nos próximos acessos novamente. A versão fica em `lib/feature-tour.ts`. Só deve ser alterada deliberadamente ao publicar uma nova apresentação; não deve mudar em todo deploy. A opção de não mostrar novamente aplica-se à apresentação atual.

Não há tabela ou migração nova, envio de e-mails, nem alterações de despesas pelo tutorial.
