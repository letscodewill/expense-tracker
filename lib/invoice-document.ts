export type InvoiceDocumentType = 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/webp'

// Validate MIME and content signatures. Active formats such as SVG are rejected.
export function invoiceDocumentType(bytes: Uint8Array, mime: string): InvoiceDocumentType | null {
  const starts = (signature: number[], offset = 0) => signature.every((byte, index) => bytes[offset + index] === byte)
  if (mime === 'application/pdf' && starts([37, 80, 68, 70, 45])) return mime
  if (mime === 'image/png' && starts([137, 80, 78, 71, 13, 10, 26, 10])) return mime
  if (mime === 'image/jpeg' && starts([255, 216, 255])) return mime
  if (mime === 'image/webp' && starts([82, 73, 70, 70]) && starts([87, 69, 66, 80], 8)) return mime
  return null
}

export const IMAGE_PURCHASE_INSTRUCTIONS = 'A imagem pode ser uma notificação de cartão, comprovante de maquininha ou cupom fiscal. Extraia compras aprovadas legíveis. Para cada comprovante ou cupom, gere um único lançamento pelo total final efetivamente pago e pelo nome do estabelecimento; não some os produtos, subtotais, troco ou parcelas ao total. Se aparecerem duas notificações da mesma compra (mesmo estabelecimento, valor e horário), gere apenas um lançamento. Em compra parcelada, use somente o valor da parcela atual quando explícito; se só houver o total, não divida nem gere parcelas futuras e avise para revisão. Não transforme saldo, limite, compra recusada, cancelamento, estorno, pagamento de fatura, Pix recebido ou crédito em despesa. Se não houver valor final legível e inequívoco, retorne rows vazio e um aviso; nunca adivinhe. Não abra QR codes, links ou URLs. Não retorne CPF, CNPJ, endereço, chave Pix, códigos de autorização ou números de cartão. Se a moeda não for BRL ou não puder ser identificada com segurança, retorne rows vazio e avise; não converta moedas. Ignore a data da compra para o cadastro: o usuário escolherá o mês de pagamento na revisão.'
