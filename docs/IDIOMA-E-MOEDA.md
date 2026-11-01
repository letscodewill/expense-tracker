# Idioma e moeda por região

Padrões iniciais, sem preferência manual:

| País | Idioma | Moeda de exibição |
| --- | --- | --- |
| Brasil | Português | BRL |
| Portugal | Português | EUR |
| Outros países da zona do euro | English | EUR |
| Demais países | English | USD |

O país vem do cabeçalho `x-vercel-ip-country` da hospedagem. Quando ausente, como no localhost, a região do primeiro idioma preferido do navegador serve de indicação; sem indicação utilizável, o padrão é English/USD. É uma localização aproximada, sujeita a VPNs, e não uma solicitação de GPS. Não há consulta a serviço externo de geolocalização.

Referências: [cabeçalhos da Vercel](https://vercel.com/docs/headers/request-headers), [países da zona do euro](https://european-union.europa.eu/institutions-law-budget/euro/countries-using-euro_en), lista de 21 países verificada em novembro de 2026, incluindo Bulgária. Reino Unido, Suíça e países europeus fora da zona do euro usam USD conforme a regra aprovada.

Os seletores manuais estão em **Configurações → Idioma e moeda**, após login. Português, English e Español continuam disponíveis manualmente. Alterar o idioma sugere EUR na zona do euro; nos demais países, português sugere BRL e os outros idiomas sugerem USD. A moeda pode ser alterada separadamente depois.

Escolhas manuais persistem neste navegador em cookies e armazenamento local, com prioridade sobre a detecção. Padrões automáticos não são gravados como escolhas manuais. Valores antigos sem o novo marcador manual não impedem a nova detecção regional. Não há sincronização dessa preferência entre contas ou aparelhos nesta implementação.

BRL, USD e EUR mudam somente a apresentação de valores já cadastrados, inclusive as máscaras de privacidade e exportações. Não há câmbio nem alteração das despesas no banco. O checkout continua cobrando apenas BRL ou USD, com escolha explícita na página de planos; EUR não foi adicionado à Stripe.

Testes cobrem países da zona do euro e de fora dela, precedência do país sobre o idioma do navegador, fallback no localhost, prioridade manual, seletor privado, mudanças de idioma/moeda e exibição/máscara em EUR. Não são necessárias novas variáveis de ambiente.
