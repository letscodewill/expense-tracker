import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { billingOffer } from '@/lib/billing-offers'
import { stripeClient, billingAdmin, billingOrigin, billingReady, verifiedPrice, billingHeaders } from '@/lib/stripe'
import { syncCustomer } from '@/lib/billing-sync'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const fail = (error: string, status = 400) => Response.json({ error }, { status, headers: billingHeaders })
  if (request.headers.get('origin') !== billingOrigin()) return fail('Origem inválida.', 403)
  if (Number(request.headers.get('content-length')) > 2000) return fail('Dados inválidos.')
  if (!billingReady()) return fail('As assinaturas ainda estão sendo configuradas. Tente novamente mais tarde.', 503)
  const client = await createClient()
  const auth = await client.auth.getUser()
  if (auth.error || !auth.data.user) return fail('Entre na sua conta para continuar.', 401)
  const user = auth.data.user
  if (!user.email_confirmed_at) return fail('Confirme seu e-mail para continuar.', 403)
  let input
  try { input = await request.json() } catch { return fail('Dados inválidos.') }
  if (!['checkout','portal','refresh'].includes(input?.action)) return fail('Dados inválidos.')
  const offer = billingOffer(input.offer)
  if (input.action === 'checkout' && !offer) return fail('Dados inválidos.')
  let token: string | null = null
  let phase = 'customer binding'
  const admin = billingAdmin(), stripe = stripeClient()
  try {
    const binding = await admin.rpc('billing_customer', { user_input: user.id })
    if (binding.error) throw new Error('binding')
    let customer = binding.data?.customer as string | undefined
    if (!customer && input.action !== 'checkout') return fail('Nenhuma assinatura encontrada.', 404)
    if (!customer) {
      // A stable key and database uniqueness bind exactly one Stripe customer to the account.
      const created = await stripe.customers.create({ email: user.email, metadata: { nocontrole_user_id: user.id } }, { idempotencyKey: `nocontrole-customer-v1-${user.id}` })
      const registered = await admin.rpc('billing_register_customer', { user_input: user.id, customer_input: created.id })
      if (registered.error || registered.data !== true) throw new Error('binding')
      customer = created.id
    }
    if (input.action === 'refresh') {
      phase = 'refresh'
      await syncCustomer(stripe, customer, `refresh:${randomUUID()}`)
      return Response.json({ updated: true }, { headers: billingHeaders })
    }
    if (input.action === 'portal') {
      phase = 'portal'
      const portal = await stripe.billingPortal.sessions.create({ customer, return_url: `${billingOrigin()}/plans`, configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID })
      return Response.json({ url: portal.url }, { headers: billingHeaders })
    }
    phase = 'plan lookup'
    const plan = await client.rpc('get_my_plan')
    if (plan.error) throw new Error('plan')
    if (plan.data?.plan === 'pro') return fail('Sua conta já possui acesso Total. Gerencie sua assinatura ou benefício.', 409)
    phase = 'checkout lock'
    const claimed = await admin.rpc('billing_claim', { customer_input: customer, event_input: null })
    token = claimed.data?.token ?? null
    if (claimed.error || !token) return fail('Outra operação está em andamento. Aguarde e tente novamente.', 409)
    // Check Stripe directly too: payment may have completed before the webhook arrived.
    for await (const sub of stripe.subscriptions.list({ customer, status: 'all', limit: 100 })) {
      if (!['canceled','incomplete_expired'].includes(sub.status)) return fail('Já existe uma assinatura. Use Gerenciar assinatura para consultar ou regularizar.', 409)
    }
    phase = 'price verification'
    const price = await verifiedPrice(stripe, offer!)
    const pending = claimed.data.session as string | null
    if (pending) {
      const previous = await stripe.checkout.sessions.retrieve(pending, { expand: ['line_items'] })
      if (previous.status === 'complete') return fail('Pagamento recebido. Atualize a situação do plano.', 409)
      if (previous.status === 'open') {
        if (previous.line_items?.data[0]?.price?.id === price && previous.url) return Response.json({ url: previous.url }, { headers: billingHeaders })
        await stripe.checkout.sessions.expire(previous.id)
      }
    }
    phase = 'checkout creation'
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription', customer, client_reference_id: user.id,
      line_items: [{ price, quantity: 1 }], allowed_payment_method_types: ['card'],
      subscription_data: { metadata: { nocontrole_user_id: user.id, app: 'nocontrole' } },
      success_url: `${billingOrigin()}/plans?checkout=success`, cancel_url: `${billingOrigin()}/plans?checkout=cancelled`,
      expires_at: Math.floor(Date.now()/1000) + 1800,
    }, { idempotencyKey: `nocontrole-checkout-${token}` })
    const saved = await admin.rpc('billing_save_session', { token_input: token, session_input: session.id })
    if (saved.error || saved.data !== true) {
      await stripe.checkout.sessions.expire(session.id)
      throw new Error('session')
    }
    return Response.json({ url: session.url }, { headers: billingHeaders })
  } catch (error) {
    console.warn('[billing]', phase, error instanceof Error ? error.name : 'Error')
    return fail('Não foi possível concluir a operação. Tente novamente.', 503)
  } finally {
    if (token) await admin.rpc('billing_release', { token_input: token })
  }
}
