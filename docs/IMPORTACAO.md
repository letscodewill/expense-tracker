# Importação de faturas e planilhas

O botão Importar fatura aceita PDF, .xlsx e .csv. Para Google Planilhas, use Arquivo → Fazer download → Microsoft Excel (.xlsx) ou CSV. A conexão direta ao Google não faz parte desta etapa.

Planilhas são lidas no navegador. Selecione a aba, indique se há cabeçalho e escolha as colunas de nome e valor. Fórmulas não são executadas; somente resultados salvos pelo Excel são lidos. Arquivos .xls devem ser convertidos para .xlsx.

Limites: arquivo até 3 MB, até 30 abas, 5.000 linhas e 100 colunas por aba e 500 despesas por importação. Linhas inválidas ou com valores não positivos são listadas em avisos. Estornos não devem virar despesas positivas. As despesas precisam ser revisadas antes de confirmar. O mês escolhido continua determinando o quinto dia útil (segunda a sexta, sem feriados).

## Ativar PDF com IA

Configure **no servidor**, em .env.local para desenvolvimento ou Environment Variables do projeto na Vercel:

```dotenv
OPENAI_API_KEY=chave-secreta-da-api
OPENAI_INVOICE_MODEL=gpt-6-luna
INVOICE_AI_ALLOWED_EMAILS=williansantos38@gmail.com
```

A chave não deve ter prefixo NEXT_PUBLIC_, ser enviada ao navegador ou publicada no Git. Crie uma chave de projeto com acesso à Responses API e habilite cobrança na plataforma OpenAI. Configure um limite de gastos e alertas para esse projeto na plataforma antes de ativar a função. Reinicie o servidor ou faça um novo deploy após mudar as variáveis.

INVOICE_AI_ALLOWED_EMAILS é uma lista de e-mails separados por vírgula. Sem chave ou lista autorizada, a IA permanece indisponível; a leitura padrão e as planilhas continuam funcionando. A lista é uma liberação inicial controlada para testes, independente da administração de tickets.

Há proteção local de dez tentativas por hora por usuário e uma análise simultânea por usuário. **Esse contador não é compartilhado entre instâncias serverless e reinicia junto com o processo. Não é um limite financeiro.** Para liberação ampla, implementar cotas persistentes por usuário e monitoramento de consumo, além do limite do projeto OpenAI.

A opção de IA informa o envio à OpenAI antes do usuário escolher o arquivo. O PDF é enviado em uma requisição autenticada com store:false, sem ser salvo em Storage ou Files API. Isso não equivale a garantia de retenção zero pelo provedor; aplica-se a política de dados da API. Não envie PDFs com senha: use a leitura padrão com senha local ou exporte uma cópia desbloqueada.

A IA retorna dados estruturados, que são validados no servidor. Não salva nada no banco; gravação acontece apenas ao confirmar na tela de revisão, com a sessão do próprio usuário e as políticas existentes.

## Validação antes de liberar

Testes automatizados usam arquivos sintéticos e respostas simuladas, sem enviar dados financeiros nem gastar créditos. Após configurar a chave, validar PDFs de bancos diferentes, inclusive digitalizados, parcelas, estornos e arquivos ilegíveis. Conferir itens e total manualmente. Testar limites de saldo, timeout, senha e repetição da importação. A implementação ainda não impede automaticamente reimportar uma fatura: conferir duplicidades antes de confirmar.
