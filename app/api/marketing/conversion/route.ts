import { createHash } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { stripeClient, billingOrigin, billingHeaders } from '@/lib/stripe'
import { BILLING_OFFERS } from '@/lib/billing-offers'
import { verifiedPurchase } from '@/lib/meta-purchase'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  const reply = (data: unknown, status = 200) => Response.json(data, {status, headers: billingHeaders})
  if (request.headers.get('origin') !== billingOrigin()) return reply({},403)
  if (!/(?:^|;\s*)nocontrole-marketing=granted(?:;|$)/.test(request.headers.get('cookie') ?? '')) return reply({},403)
  if (Number(request.headers.get('content-length')) > 1000) return reply({},413)
  try {
    const text = await request.text()
    if (text.length > 1000) return reply({},413)
    const input = JSON.parse(text)
    const client = await createClient()
    const {data,error} = await client.auth.getUser()
    if (error || !data.user) return reply({},401)
    if (input.action === 'registration') {
      const age = Date.now() - Date.parse(data.user.created_at)
      if (!data.user.email_confirmed_at || age < 0 || age > 30 * 60000) return reply({event:null})
      return reply({event:{eventID:createHash('sha256').update(`nocontrole-registration:${data.user.id}`).digest('hex')}})
    }
    if (input.action !== 'purchase' || typeof input.session !== 'string' || !/^cs_(live|test)_[A-Za-z0-9]{1,200}$/.test(input.session)) return reply({},400)
    const session = await stripeClient().checkout.sessions.retrieve(input.session,{expand:['line_items']})
    const prices = Object.values(BILLING_OFFERS).map(offer=>process.env[offer.env] ?? '').filter(Boolean)
    const event = verifiedPurchase(session,data.user.id,/_live_/.test(process.env.STRIPE_SECRET_KEY ?? ''),prices)
    return reply({event})
  } catch { return reply({},503) }
}
