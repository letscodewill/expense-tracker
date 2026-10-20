# Planos e checkout — decisões e implementação seguinte

**Base implementada:** gestão de [Pro cortesia](PRO-CORTESIA.md) e identificação de master permanente. O checkout deve utilizar essa fonte de permissões e compor a assinatura paga sem substituir ou cancelar benefícios ativos. Nenhum checkout ou cobrança foi ativado.

## Decisões de 19/10/2026

- O mercado inicial será outro país da América Latina. O responsável ainda informará o país e o provedor.
- A preferência BRL/USD é somente apresentação, sem câmbio ou mudança no banco. Ela **não define a moeda que um checkout deve cobrar**.
- Nenhuma cobrança, preço ou restrição de acesso foi ativada nesta etapa.

## Fluxo recomendado

Uma página pública `/plans` pode apresentar a oferta antes do login. A contratação deve ocorrer depois de autenticar a conta: planos → criar conta/entrar → checkout hospedado pelo provedor → confirmação por webhook → plano liberado.

Não liberar acesso pelo retorno `?success=true` do checkout. O servidor deve consultar o estado confiável da assinatura. Receber um pagamento na conta do provedor sem UUID associado não identifica com segurança qual usuário deve ter acesso.

## Decisões necessárias antes de ativar

1. País do vendedor e do público inicial, provedor e disponibilidade de assinatura recorrente para essa combinação.
2. Preço, moeda real de cobrança, periodicidade, renovação, tributos, cancelamento e reembolsos.
3. O que o Free permite, e se será permanente ou um período de teste. Definir limites de lançamentos, quadros, IA, relatórios e histórico sem destruir registros existentes ao mudar de plano.
4. Tratamento dos usuários atuais, do proprietário e de contas de suporte; eventual migração deve ser explícita.
5. Comportamento em atraso, cancelamento no fim do período, reembolso e indisponibilidade do provedor.

## Estrutura técnica a implementar após definir o provedor

- Tabela privada de clientes/assinaturas por UUID: IDs do cliente e assinatura externos, plano, status e período vigente. O usuário comum não pode atualizar esses campos, nem escolher seu plano por `user_metadata`.
- Rotas autenticadas de checkout e portal de gerenciamento; o servidor escolhe IDs de preços permitidos e vincula a conta. Não confiar em preço ou UUID enviados pelo navegador.
- Webhook com validação da assinatura do provedor, unicidade do evento para idempotência e reconciliação de eventos duplicados/fora de ordem.
- Consulta única de permissões e limites efetivos. As cotas precisam ser atômicas e funcionar com duas abas/dispositivos.
- **Proteger também o banco:** o app escreve diretamente pelo Supabase em vários fluxos. Esconder botões ou proteger apenas a rota do checkout não impede contornar cotas. RLS, funções/triggers de escrita e rotas devem aplicar a política de plano acordada.
- Cancelar não deve apagar despesas. Definir leitura/exportação e política de retenção para o usuário que retornar ao Free.
- Não bloquear termos, privacidade, suporte de conta, cancelamento ou recuperação de senha por falta de assinatura.
- Atualizar textos de termos/privacidade para os planos e fornecedor efetivamente ativados. Não anunciar compra disponível com checkout fictício.

## Testes antes do lançamento pago

Usar o ambiente de teste do provedor, sem cobranças reais. Validar compra, autenticação, assinatura ativa, renovação, período de teste se houver, falha, atraso, cancelamento, reembolso, webhook com assinatura inválida, eventos repetidos e fora de ordem, pagamento da conta errada, retorno forjado, tentativa de alterar o plano pelo cliente e tentativa de contornar limites pela API/Supabase.

A escolha do provedor não foi presumida. Este documento prepara a próxima implementação; não representa um checkout instalado ou uma assinatura habilitada.
