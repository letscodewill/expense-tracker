import { createHash } from 'node:crypto'
export function verifiedPurchase(session: {
  id: string; client_reference_id: string | null; mode: string | null; status: string | null;
  payment_status: string; livemode: boolean; amount_total: number | null; currency: string | null;
  line_items?: { has_more: boolean; data: { quantity: number | null; price: { id: string } | null }[] };
}, userId: string, live: boolean, prices: string[]) {
  const items = session.line_items
  if (session.client_reference_id !== userId || session.mode !== 'subscription' || session.status !== 'complete'
    || session.payment_status !== 'paid' || session.livemode !== live || !Number.isSafeInteger(session.amount_total)
    || session.amount_total! <= 0 || !['brl','usd'].includes(session.currency ?? '') || !items || items.has_more
    || items.data.length !== 1 || items.data[0].quantity !== 1 || !prices.includes(items.data[0].price?.id ?? '')) return null
  return { value: session.amount_total! / 100, currency: session.currency!.toUpperCase(), eventID: createHash('sha256').update(`nocontrole-purchase:${session.id}`).digest('hex') }
}
