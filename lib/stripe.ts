import 'server-only'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { BILLING_OFFERS, type BillingOffer } from './billing-offers'

export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || !/^(rk|sk)_(live|test)_/.test(key)) throw new Error('Billing unavailable')
  return new Stripe(key, { apiVersion: '2026-10-28.endive', timeout: 15000, maxNetworkRetries: 1 })
}
export function billingAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Billing unavailable')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
export function billingOrigin() {
  const origin = new URL(process.env.STRIPE_APP_URL ?? 'https://nocontrole.slimastore.com.br')
  if (origin.protocol !== 'https:' && origin.hostname !== 'localhost' && origin.hostname !== '127.0.0.1') throw new Error('Invalid billing origin')
  return origin.origin
}
export function billingReady() {
  return process.env.STRIPE_BILLING_ENABLED === 'true' && !!process.env.STRIPE_SECRET_KEY && !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.STRIPE_WEBHOOK_SECRET
    && Object.values(BILLING_OFFERS).every(offer => /^price_/.test(process.env[offer.env] ?? ''))
}
export async function verifiedPrice(stripe: Stripe, offer: BillingOffer) {
  const expected = BILLING_OFFERS[offer], id = process.env[expected.env]
  if (!id) throw new Error('Missing price')
  const price = await stripe.prices.retrieve(id)
  if (!price.active || price.currency !== expected.currency || price.unit_amount !== expected.amount || price.type !== 'recurring'
    || price.recurring?.interval !== expected.interval || price.recurring.interval_count !== 1 || price.lookup_key !== expected.lookup)
    throw new Error('Unexpected price')
  return price.id
}
export const billingHeaders = { 'Cache-Control': 'private, no-store' }
