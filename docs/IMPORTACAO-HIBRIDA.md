<!-- Nomes comerciais: NoControle Essencial e NoControle Total. Identificadores técnicos free/pro e IDs Stripe preservados. -->
# Importação híbrida de planilhas

Excel (.xlsx) e CSV começam pela identificação local, sem usar a cota de IA. Uma única aba preenchida vai direto à revisão. Com várias abas, o usuário escolhe uma antes da identificação.

Quando a estrutura não é reconhecida com segurança, a revisão oferece **Analisar com IA**, com aviso de envio à OpenAI e consumo da cota. A ação é opcional; o usuário pode cadastrar linhas manualmente ou escolher outro arquivo. Planilhas reconhecidas não são enviadas à IA automaticamente, mesmo com a opção de IA marcada para PDFs/imagens.

Somente o nome e as células da aba escolhida são enviados como dados de texto; o arquivo Excel completo, suas demais abas e fórmulas executáveis não são enviados. Fórmulas usam somente o resultado previamente armazenado no arquivo. Limites: arquivo original até 3 MB; aba até 5.000 linhas, 100 colunas, 2.000 caracteres por célula e 120.000 caracteres no JSON preparado. Até 500 despesas na resposta.

A rota existente `/api/invoices/analyze` aceita `kind=spreadsheet` e um arquivo JSON validado antes de reservar a cota. Reutiliza autenticação, categorias da própria conta, limitação de tentativas, `reserve_invoice_ai` e `finish_invoice_ai`. Não há migração, nova chave ou variável de ambiente.

PDFs, imagens e análises opcionais de planilhas compartilham a cota: Essencial 1/mês e Total 10/mês, com a exceção existente do master. Uma análise bem-sucedida com despesas usa uma análise; erros ou respostas vazias liberam a reserva. O uso da API do fornecedor pode ter custo mesmo quando a cota do usuário é liberada.

Os resultados passam pela validação existente, categorias permitidas e revisão editável. O usuário define destino e mês de pagamento e confirma o cadastro; a detecção de duplicidade continua no momento da confirmação. A IA pode errar: a revisão segue necessária.

Os testes usam serviços simulados e não enviam arquivos ou despesas reais ao fornecedor. Cobrem seleção de aba, ausência de envio automático, bloqueio por cota, dados inválidos, falhas/vazios e continuidade da revisão sem gravar.
