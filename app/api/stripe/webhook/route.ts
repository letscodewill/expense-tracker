import { stripeClient, billingHeaders } from '@/lib/stripe'
import { syncCustomer } from '@/lib/billing-sync'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return Response.json({ error: 'Unavailable' }, { status: 503, headers: billingHeaders })
  if (Number(request.headers.get('content-length')) > 1000000) return new Response(null, { status: 413 })
  let stripe
  try { stripe = stripeClient() } catch { return new Response(null, { status: 503 }) }
  let event
  try {
    const body = await request.text()
    if (Buffer.byteLength(body) > 1000000) return new Response(null, { status: 413 })
    event = stripe.webhooks.constructEvent(body, request.headers.get('stripe-signature') ?? '', secret)
  } catch { return Response.json({ error: 'Invalid signature' }, { status: 400, headers: billingHeaders }) }
  const live = /_live_/.test(process.env.STRIPE_SECRET_KEY ?? '')
  if (event.livemode !== live) return new Response(null, { status: 400 })
  const supported = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed', 'invoice.marked_uncollectible', 'invoice.voided']
  if (!supported.includes(event.type)) return Response.json({ received: true }, { headers: billingHeaders })
  const object = event.data.object as unknown as { customer?: string | { id: string } | null }
  const customer = typeof object.customer === 'string' ? object.customer : object.customer?.id
  if (!customer) return Response.json({ received: true }, { headers: billingHeaders })
  try {
    await syncCustomer(stripe, customer, event.id)
    return Response.json({ received: true }, { headers: billingHeaders })
  } catch {
    return Response.json({ error: 'Retry synchronization' }, { status: 503, headers: billingHeaders })
  }
}
