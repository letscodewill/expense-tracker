import 'server-only'
import type Stripe from 'stripe'
import { billingAdmin } from './stripe'
import { BILLING_OFFERS, subscriptionSnapshot } from './billing-offers'

export async function syncCustomer(stripe: Stripe, customer: string, eventId: string) {
  const admin = billingAdmin()
  const claimed = await admin.rpc('billing_claim', { customer_input: customer, event_input: eventId })
  if (claimed.error) throw new Error('Billing synchronization unavailable')
  if (claimed.data?.ignored || claimed.data?.duplicate) return
  const token = claimed.data?.token
  if (!token) throw new Error('Billing synchronization busy')
  try {
    const allowed = Object.values(BILLING_OFFERS).map(offer => process.env[offer.env] ?? '').filter(Boolean)
    if (allowed.length !== 4) throw new Error('Missing billing prices')
    const subscriptions = []
    for await (const subscription of stripe.subscriptions.list({ customer, status: 'all', limit: 100 })) {
      subscriptions.push(subscriptionSnapshot(subscription, allowed))
      if (subscriptions.length > 1000) throw new Error('Too many subscriptions')
    }
    const result = await admin.rpc('billing_commit', { customer_input: customer, event_input: eventId, token_input: token, subscriptions_input: subscriptions })
    if (result.error || result.data !== true) throw new Error('Billing synchronization failed')
  } finally {
    await admin.rpc('billing_release', { token_input: token })
  }
}
