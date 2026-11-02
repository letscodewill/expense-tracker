# Idioma e moeda por região

A moeda de exibição é sugerida pela localização aproximada fornecida pela Vercel, com fallback para a região do idioma preferido do navegador. Sem um país reconhecido, usa USD. Idioma: Brasil/Portugal em português, América Latina hispânica em espanhol e demais países em inglês.

O catálogo local contém 153 moedas atuais para 255 países/territórios, extraído do Unicode CLDR 49 e verificado em 01/11/2026. Fonte e licença estão em `lib/currency-regions.json`. Não há consulta externa de câmbio ou geolocalização durante o uso. Em países com várias moedas, a primeira moeda corrente listada pelo CLDR é sugerida; o usuário pode alterar nas configurações.

Exemplos: Brasil BRL; México MXN; Argentina ARS; Chile CLP; Colômbia COP; Peru PEN; Paraguai PYG; Uruguai UYU; Portugal EUR; Reino Unido GBP; Japão JPY. Na ausência de um símbolo no navegador, o código ISO identifica a moeda.

**Configurações → Idioma e moeda** oferece código, nome localizado e símbolo. Escolhas manuais neste navegador têm prioridade sobre a detecção e são preservadas ao trocar o idioma. Não há sincronização entre contas ou aparelhos nesta implementação.

A mudança é somente de apresentação: 1234,56 permanece 1234,56. Não há conversão, alteração do banco ou separação dos saldos por moeda. As duas casas decimais do sistema são mantidas inclusive em CLP e JPY. A máscara de privacidade acompanha a moeda. Exportações CSV/Excel mantêm os números e a identificação da moeda; o PDF usa códigos ISO fora de BRL/USD/EUR para evitar símbolos incompatíveis com sua fonte padrão.

A moeda da assinatura é independente: o checkout continua somente em BRL e USD. O catálogo não amplia automaticamente a compatibilidade dos leitores de faturas/comprovantes com documentos de todos os países; essa validação permanece separada.
