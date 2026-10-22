# Exportação de despesas

Em **Relatórios**, escolha o período, clique em **Buscar** e ajuste os filtros de nome, status ou valor. Junto de Exportar PDF estão TXT, CSV e Excel (.xlsx).

- CSV: uma tabela de lançamentos, com nome, data ISO, categoria, valor, código da moeda de exibição, status e comentário. Separador ponto e vírgula, UTF-8 com BOM, campos entre aspas e aspas internas escapadas. Decimal com vírgula em português e ponto nos demais idiomas.
- TXT: lançamentos, totais e resumo de orçamento, em texto UTF-8 com BOM e colunas separadas por tabulações. Quebras de linha nos comentários viram ` / ` para preservar uma linha por registro.
- Excel: três abas para lançamentos, totais e orçamento, com cabeçalhos, filtros e painéis congelados. Valores dos lançamentos e totais são numéricos; o resumo de orçamento mantém a apresentação do relatório, com símbolos de moeda e indicação de excesso/disponibilidade.

A lista e os totais respeitam os filtros atuais sobre o período carregado. Alterar as datas sem Buscar novamente não muda o período do arquivo. O orçamento considera meses completos e independe dos filtros da lista, conforme a explicação incluída no TXT/Excel e no PDF. Os lançamentos de resumo dos quadros secundários não entram novamente nos dados, evitando dupla contagem.

Idiomas seguem a preferência do sistema; nomes, categorias pessoais e comentários são preservados. BRL/USD muda apenas a apresentação, sem conversão. A exportação de lançamentos não é um backup completo da conta ou do banco.

Os arquivos são gerados no navegador a partir dos dados já carregados e restritos ao usuário autenticado. Não há novo serviço externo ou alteração no banco. Excel é carregado apenas ao solicitar .xlsx, reutilizando ExcelJS já utilizado na importação. CSV neutraliza textos que poderiam virar fórmulas; no Excel todos os textos são células literais, sem fórmulas executáveis. Falhas mostram aviso e permitem tentar novamente.

Validação automatizada inclui o arquivo XLSX real reaberto, números, fórmulas tratadas como texto, CSV com aspas/acentos/quebras, TXT, lista vazia, filtros e período carregado. Não equivale a uma validação visual em todas as versões do Microsoft Excel ou Google Planilhas.
