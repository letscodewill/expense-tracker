import { readFileSync, writeFileSync } from 'node:fs'
import Stripe from 'stripe'
process.loadEnvFile('.env.local')
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-10-28.endive', timeout: 20000, maxNetworkRetries: 1 })
const origin = process.env.STRIPE_APP_URL || 'https://nocontrole.slimastore.com.br'
function save(name,value) {
  if (!value || /[\r\n]/.test(value)) throw new Error('Invalid configuration')
  let text = readFileSync('.env.local','utf8')
  const re = new RegExp(`^${name}=.*$`,'m')
  text = re.test(text) ? text.replace(re,`${name}=${value}`) : text.trimEnd()+`\n${name}=${value}\n`
  writeFileSync('.env.local',text)
  process.env[name]=value
}
try {
  const configs = await stripe.billingPortal.configurations.list({limit:100})
  let portal = configs.data.find(c=>c.active && c.metadata?.app==='nocontrole')
  if (!portal) portal = await stripe.billingPortal.configurations.create({
    business_profile: { headline: 'NoControle Pro', privacy_policy_url:`${origin}/privacypolicy`, terms_of_service_url:`${origin}/termsofservice` },
    default_return_url:`${origin}/plans`, metadata:{app:'nocontrole'},
    features:{ invoice_history:{enabled:true}, payment_method_update:{enabled:true},
      subscription_cancel:{enabled:true,mode:'at_period_end'}, subscription_update:{enabled:false} },
  },{idempotencyKey:'nocontrole-portal-v1'})
  save('STRIPE_PORTAL_CONFIGURATION_ID',portal.id)
  console.log(JSON.stringify({portal:portal.id,cancelAtPeriodEnd:portal.features.subscription_cancel.mode==='at_period_end'}))
  const endpoints = await stripe.webhookEndpoints.list({limit:100})
  let endpoint = endpoints.data.find(e=>e.url===`${origin}/api/stripe/webhook`)
  if (!endpoint) {
    endpoint = await stripe.webhookEndpoints.create({url:`${origin}/api/stripe/webhook`,api_version:'2026-10-28.endive',description:'NoControle subscriptions',
      enabled_events:['checkout.session.completed','checkout.session.async_payment_succeeded','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.paid','invoice.payment_failed','invoice.marked_uncollectible','invoice.voided'],metadata:{app:'nocontrole'}
    },{idempotencyKey:'nocontrole-webhook-v1'})
    save('STRIPE_WEBHOOK_SECRET',endpoint.secret)
    // Keep delivery paused until the implementation and secrets are deployed.
    endpoint = await stripe.webhookEndpoints.update(endpoint.id,{disabled:true})
  }
  save('STRIPE_WEBHOOK_ENDPOINT_ID',endpoint.id)
  console.log(JSON.stringify({webhook:endpoint.id,status:endpoint.status,secretSaved:!!process.env.STRIPE_WEBHOOK_SECRET}))
} catch(error) {
  console.error(JSON.stringify({configurationFailed:true,type:error.type,code:error.code,status:error.statusCode}))
  process.exitCode=1
}
