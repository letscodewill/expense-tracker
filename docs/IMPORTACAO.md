# Importação de faturas e planilhas

O botão Importar fatura aceita PDF, .xlsx e .csv. Para Google Planilhas, use Arquivo → Fazer download → Microsoft Excel (.xlsx) ou CSV. A conexão direta ao Google não faz parte desta etapa.

Planilhas são lidas no navegador. Selecione a aba, indique se há cabeçalho e escolha as colunas de nome e valor. Fórmulas não são executadas; somente resultados salvos pelo Excel são lidos. Arquivos .xls devem ser convertidos para .xlsx.

Limites: arquivo até 3 MB, até 30 abas, 5.000 linhas e 100 colunas por aba e 500 despesas por importação. Linhas inválidas ou com valores não positivos são listadas em avisos. Estornos não devem virar despesas positivas. As despesas precisam ser revisadas antes de confirmar. O mês escolhido continua determinando o quinto dia útil (segunda a sexta, sem feriados).

## Ativar PDF com IA

Configure **no servidor**, em .env.local para desenvolvimento ou Environment Variables do projeto na Vercel:

```dotenv
OPENAI_API_KEY=chave-secreta-da-api
OPENAI_INVOICE_MODEL=gpt-6-luna
```

A chave não deve ter prefixo NEXT_PUBLIC_, ser enviada ao navegador ou publicada no Git. Crie uma chave de projeto com acesso à Responses API e habilite cobrança na plataforma OpenAI. Configure um limite de gastos e alertas para esse projeto na plataforma antes de ativar a função. Reinicie o servidor ou faça um novo deploy após mudar as variáveis.

A leitura por IA está disponível para todos os usuários autenticados. Não é necessário cadastrar e-mails autorizados; a variável antiga INVOICE_AI_ALLOWED_EMAILS não é mais utilizada e pode ser removida. Sem OPENAI_API_KEY, a IA permanece indisponível; a leitura padrão e as planilhas continuam funcionando. Os limites de arquivo e de análises por usuário permanecem ativos.

Cada conta pode analisar **4 faturas por mês** com IA. O mês é o mês de uso do serviço no horário de São Paulo, e não o mês de pagamento da fatura. Uma análise concluída com despesas conta mesmo se o usuário desistir antes de importar; repetir a análise do mesmo PDF conta novamente. Falhas, arquivos inválidos e resultados sem despesas não consomem a cota. A leitura padrão e as planilhas permanecem disponíveis. O banco reserva vagas de forma atômica para impedir ultrapassar o limite entre dispositivos; reservas interrompidas expiram em 5 minutos. Os identificadores de reserva ficam apenas no servidor e não podem ser retornados ou registrados em logs. A migração `20261012193214_invoice_ai_monthly_quota.sql` deve estar aplicada antes da publicação do novo código.

Há proteção local de dez tentativas por hora por usuário e uma análise simultânea por usuário. **Esse contador não é compartilhado entre instâncias serverless e reinicia junto com o processo. Não é um limite financeiro.** Para liberação ampla, implementar cotas persistentes por usuário e monitoramento de consumo, além do limite do projeto OpenAI.

A opção de IA informa o envio à OpenAI antes do usuário escolher o arquivo. O PDF é aberto primeiro no navegador. Se estiver protegido, o sistema pede a senha e não envia nada até conseguir abri-lo. Senhas incorretas podem ser corrigidas. A senha não é enviada ao servidor nem à OpenAI e é limpa após a leitura ou ao fechar. Para PDFs criptografados, o navegador cria uma cópia temporária sem senha a partir das páginas renderizadas. Essa conversão pode aumentar o tamanho e consumir mais tokens de imagem; confira os resultados antes de salvar. A leitura por IA aceita até 20 páginas e 3 MB depois da preparação.

O PDF é enviado em uma requisição autenticada com store:false, sem ser salvo em Storage ou Files API. Isso não equivale a garantia de retenção zero pelo provedor; aplica-se a política de dados da API. O worker PDF.js é servido pelo próprio site e copiado da versão instalada durante npm run dev/build, sem carregar código de um CDN externo.

A IA retorna dados estruturados, que são validados no servidor. Não salva nada no banco; gravação acontece apenas ao confirmar na tela de revisão, com a sessão do próprio usuário e as políticas existentes.

Na mesma análise do PDF, a IA sugere categorias pela descrição do estabelecimento. O servidor carrega somente as categorias da conta autenticada e limita a resposta a esses nomes. Sugestões desconhecidas, ausentes ou sem confiança ficam em **Sem categoria**. Nenhuma categoria é criada automaticamente. A revisão permite alterar cada categoria antes de confirmar; apenas a escolha final é gravada. A leitura padrão e as planilhas continuam com a seleção manual. Não há chamada adicional de IA por despesa nem mudança na cota de quatro análises mensais. Esta etapa não aprende associações permanentes entre estabelecimentos e categorias.

## Validação antes de liberar

Testes automatizados usam arquivos sintéticos e respostas simuladas, sem enviar dados financeiros nem gastar créditos. Após configurar a chave, validar PDFs de bancos diferentes, inclusive digitalizados, parcelas, estornos e arquivos ilegíveis. Conferir itens e total manualmente. Testar limites de saldo, timeout, senha e repetição da importação. Possíveis duplicidades por nome, valor e mês, incluindo linhas repetidas no arquivo, exigem revisão antes de salvar. A confirmação permite manter despesas legítimas iguais; consulte [DUPLICIDADES.md](DUPLICIDADES.md) para critérios e limites.
