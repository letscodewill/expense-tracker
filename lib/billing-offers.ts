export const BILLING_OFFERS = {
  brl_month: { currency: 'brl', interval: 'month', amount: 1490, lookup: 'nocontrole_pro_brl_month_v1', env: 'STRIPE_PRICE_BRL_MONTH' },
  brl_year: { currency: 'brl', interval: 'year', amount: 14990, lookup: 'nocontrole_pro_brl_year_v1', env: 'STRIPE_PRICE_BRL_YEAR' },
  usd_month: { currency: 'usd', interval: 'month', amount: 399, lookup: 'nocontrole_pro_usd_month_v1', env: 'STRIPE_PRICE_USD_MONTH' },
  usd_year: { currency: 'usd', interval: 'year', amount: 3990, lookup: 'nocontrole_pro_usd_year_v1', env: 'STRIPE_PRICE_USD_YEAR' },
} as const
export type BillingOffer = keyof typeof BILLING_OFFERS
export function billingOffer(input: unknown): BillingOffer | null {
  return typeof input === 'string' && Object.hasOwn(BILLING_OFFERS, input) ? input as BillingOffer : null
}
export function subscriptionSnapshot(subscription: {
  id: string; status: string; cancel_at_period_end: boolean;
  items: { has_more: boolean; data: { quantity?: number; current_period_end: number; price: { id: string } }[] };
}, allowedPrices: string[]) {
  const items = subscription.items.data
  const item = items[0]
  const valid = !subscription.items.has_more && items.length === 1 && item?.quantity === 1 && allowedPrices.includes(item.price.id)
  return { id: subscription.id, status: valid ? subscription.status : 'unsupported', price: item?.price.id ?? '',
    period_end: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end }
}
