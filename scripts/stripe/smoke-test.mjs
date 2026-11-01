// Integration test: TEST Stripe only, one disposable Supabase account, no real charge.
import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { configureCatalog } from './configure-catalog.mjs'

process.loadEnvFile('.env.local')
const testKey=process.env.STRIPE_TEST_SECRET_KEY
if(!/^(sk|rk)_test_/.test(testKey||'')) throw new Error('STRIPE_TEST_SECRET_KEY precisa ser uma chave secreta de teste.')
if(!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente.')
const stripe=new Stripe(testKey,{apiVersion:'2026-10-28.endive',timeout:15000,maxNetworkRetries:1})
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const nonce=randomUUID(),email=`stripe-smoke-${nonce}@example.invalid`,password=randomBytes(36).toString('base64url')
const port=Number(process.env.STRIPE_SMOKE_PORT||3187),origin=`http://127.0.0.1:${port}`,webhookSecret=`whsec_${randomBytes(32).toString('hex')}`
let userId,customer,server,checkoutSession,sub,stage='setup',approvalAwaiting=false
const jar=new Map()
const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:items=>items.forEach(({name,value})=>jar.set(name,value))}})
const rpc=async(name,args)=>{const result=await admin.rpc(name,args);if(result.error)throw new Error(`RPC failed: ${name} (${result.error.code})`);return result.data}
async function api(method,path,params,idempotency){
  const query=new URLSearchParams(params)
  const r=await fetch(`https://api.stripe.com/v1${path}${method==='GET'?'?'+query:''}`,{method,headers:{Authorization:`Bearer ${testKey}`,'Stripe-Version':'2026-10-28.endive',...(method==='POST'?{'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':idempotency}:{})},...(method==='POST'?{body:query}:{}),signal:AbortSignal.timeout(15000)})
  const body=await r.json();if(!r.ok)throw new Error(`Stripe test ${method} ${path}: ${r.status}, ${body.error?.code||body.error?.type}`);return body
}
async function post(body){
  const r=await fetch(`${origin}/api/billing`,{method:'POST',headers:{origin,'Content-Type':'application/json',Cookie:[...jar].map(([n,v])=>`${n}=${v}`).join('; ')},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)})
  return {status:r.status,data:await r.json()}
}
async function webhook(type){
  const payload=JSON.stringify({id:`evt_smoke_${randomUUID().replaceAll('-','')}`,type,livemode:false,data:{object:{customer}}})
  const headers={'stripe-signature':stripe.webhooks.generateTestHeaderString({payload,secret:webhookSecret})}
  const r=await fetch(`${origin}/api/stripe/webhook`,{method:'POST',headers,body:payload,signal:AbortSignal.timeout(60000)})
  assert.equal(r.status,200,'Webhook must synchronize the actual test subscription')
  const repeated=await fetch(`${origin}/api/stripe/webhook`,{method:'POST',headers,body:payload,signal:AbortSignal.timeout(60000)})
  assert.equal(repeated.status,200,'Duplicate webhook must be idempotent')
}
async function subscriptionAction(action, completed) {
  try { await action() }
  catch(error) {
    if(error.code!=='approval_required')throw error
    approvalAwaiting=true
    console.log(JSON.stringify({approvalRequired:true,stage,subscription:sub.id,livemode:false,instructions:'Stripe TEST: Settings > Approvals > Requests. Review only this disposable subscription.',details:Object.keys(error.raw||{})}))
    // Stripe executes the captured operation after the human reviewer approves.
    // Poll reads only; never retry or change routes to bypass that approval.
    let finished=false
    for(let n=0;n<120;n++){
      const current=await stripe.subscriptions.retrieve(sub.id)
      if(completed(current)){finished=true;break}
      await delay(5000)
    }
    if(!finished)throw new Error('Test approval was not received in time')
    approvalAwaiting=false
    console.log(JSON.stringify({approvalCompleted:true,stage,livemode:false}))
  }
}
try{
  // Fixed product ID and lookup keys make repeated test runs reuse the catalog.
  try{await stripe.products.retrieve('nocontrole_pro_v1')}catch(error){if(error.code!=='resource_missing')throw error;await stripe.products.create({id:'nocontrole_pro_v1',name:'NoControle Pro TEST'},{idempotencyKey:'nocontrole-pro-test-product-v1'})}
  const offers=await configureCatalog(api,true)
  assert.equal(offers.length,4)
  const portal=await stripe.billingPortal.configurations.create({features:{invoice_history:{enabled:true},payment_method_update:{enabled:true},subscription_cancel:{enabled:true,mode:'at_period_end'}},metadata:{app:'nocontrole-smoke'}},{idempotencyKey:'nocontrole-smoke-portal-v1'})
  const added=await admin.auth.admin.createUser({email,password,email_confirm:true})
  if(added.error||!added.data.user)throw new Error('Could not create disposable test account')
  userId=added.data.user.id
  const login=await client.auth.signInWithPassword({email,password})
  if(login.error)throw new Error('Disposable account could not sign in')
  const env={...process.env,STRIPE_SECRET_KEY:testKey,STRIPE_WEBHOOK_SECRET:webhookSecret,STRIPE_APP_URL:origin,STRIPE_BILLING_ENABLED:'true',STRIPE_PORTAL_CONFIGURATION_ID:portal.id}
  for(const offer of offers)env[`STRIPE_PRICE_${offer.currency.toUpperCase()}_${offer.interval.toUpperCase()}`]=offer.id
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p',String(port),'-H','127.0.0.1'],{cwd:process.cwd(),env,stdio:'ignore',windowsHide:true})
  let ready=false
  for(let n=0;n<40;n++){if(server.exitCode!==null)throw new Error('Test server could not start');try{const r=await fetch(`${origin}/plans`,{signal:AbortSignal.timeout(5000)});if(r.ok){ready=true;break}}catch{}await delay(500)}
  assert.ok(ready,'Test server readiness')
  stage='checkout'
  let result=await post({action:'checkout',offer:'brl_month',user_id:'forged',price:'price_forged'})
  assert.equal(result.status,200,`Authenticated checkout creation: ${result.data.error ?? 'no server error'}`)
  customer=(await rpc('billing_customer',{user_input:userId})).customer
  assert.ok(customer.startsWith('cus_'))
  const sessions=await stripe.checkout.sessions.list({customer,limit:100})
  assert.equal(sessions.data.length,1,'Only one checkout created')
  checkoutSession=sessions.data[0].id
  assert.equal(sessions.data[0].client_reference_id,userId,'Verified account binding')
  assert.equal(sessions.data[0].currency,'brl');assert.equal(sessions.data[0].amount_total,1490)
  const repeated=await post({action:'checkout',offer:'brl_month'})
  assert.equal(repeated.status,200);assert.equal(repeated.data.url,result.data.url,'Retry reuses checkout')
  assert.equal((await post({action:'checkout',offer:'price_forged'})).status,400)
  const next=await post({action:'checkout',offer:'usd_year'})
  assert.equal(next.status,200)
  assert.equal((await stripe.checkout.sessions.retrieve(checkoutSession)).status,'expired','Switching offer expires previous checkout')
  const latest=(await stripe.checkout.sessions.list({customer,limit:100})).data.find(s=>s.status==='open')
  checkoutSession=latest.id
  assert.equal(latest.currency,'usd');assert.equal(latest.amount_total,3990)
  // Payment uses Stripe's documented sandbox-only fixture, never real card data.
  stage='sandbox payment method'
  const paymentMethod=await stripe.paymentMethods.attach('pm_card_visa',{customer})
  stage='sandbox subscription'
  sub=await stripe.subscriptions.create({customer,items:[{price:offers.find(o=>o.currency==='usd'&&o.interval==='year').id}],default_payment_method:paymentMethod.id,payment_behavior:'error_if_incomplete',metadata:{nocontrole_user_id:userId}},{idempotencyKey:`nocontrole-smoke-subscription-${nonce}`})
  assert.equal(sub.status,'active','Sandbox payment succeeds')
  stage='subscription webhook'
  await webhook('customer.subscription.created')
  const plan=await client.rpc('get_my_plan');assert.equal(plan.data?.source,'subscription');assert.equal(plan.data?.plan,'pro')
  assert.equal((await post({action:'checkout',offer:'brl_month'})).status,409,'Existing Pro cannot buy a duplicate subscription')
  stage='portal'
  const portalSession=await post({action:'portal'});assert.equal(portalSession.status,200);assert.ok(portalSession.data.url.startsWith('https://billing.stripe.com/'))
  stage='schedule cancellation at period end'
  await subscriptionAction(()=>stripe.subscriptions.update(sub.id,{cancel_at_period_end:true}),s=>s.cancel_at_period_end===true)
  await webhook('customer.subscription.updated')
  assert.equal((await client.rpc('get_my_plan')).data?.plan,'pro','Scheduled cancellation keeps paid access')
  stage='cancel disposable test subscription'
  await subscriptionAction(()=>stripe.subscriptions.cancel(sub.id),s=>s.status==='canceled');sub=null
  await webhook('customer.subscription.deleted')
  assert.equal((await client.rpc('get_my_plan')).data?.plan,'free','Cancellation removes subscription access')
  stage='declined sandbox payment'
  const declinedMethod=await stripe.paymentMethods.attach('pm_card_chargeDeclined',{customer})
  await assert.rejects(stripe.subscriptions.create({customer,items:[{price:offers.find(o=>o.currency==='brl'&&o.interval==='month').id}],default_payment_method:declinedMethod.id,payment_behavior:'error_if_incomplete'},{idempotencyKey:`nocontrole-smoke-declined-${nonce}`}),error=>error.code==='card_declined')
  await webhook('invoice.payment_failed')
  assert.equal((await client.rpc('get_my_plan')).data?.plan,'free','A declined payment never grants Pro')
  console.log('PASS: Stripe TEST catalog, login, hosted checkout, account binding, correct amounts/currencies, duplicate prevention, offer switching, sandbox payment, signed webhook, paid Pro, portal, scheduled cancellation, cancellation downgrade and declined payment.')
}catch(error){
  // Never print response bodies, authorization, session cookies or user details.
  console.error(JSON.stringify({smokeTestFailed:true,stage,name:error.name,code:error.code||null,param:error.param||null,step:error instanceof assert.AssertionError?error.message:undefined,type:error.type||null}))
  process.exitCode=1
}finally{
  server?.kill()
  if(customer){
    let canRemoveCustomer=!approvalAwaiting
    try{if(canRemoveCustomer)for await(const s of stripe.subscriptions.list({customer,status:'all',limit:100}))if(!['canceled','incomplete_expired'].includes(s.status))await stripe.subscriptions.cancel(s.id)}catch{
      canRemoveCustomer=false
    }
    if(!canRemoveCustomer){writeFileSync('.env.stripe-smoke-cleanup.json',JSON.stringify({testOnly:true,customer,subscription:sub?.id??null},null,2));console.error('Test subscription cleanup requires approval; identifiers saved locally in .env.stripe-smoke-cleanup.json');process.exitCode=1}
    try{for await(const s of stripe.checkout.sessions.list({customer,limit:100}))if(s.status==='open')await stripe.checkout.sessions.expire(s.id)}catch{console.error('Test checkout cleanup needs attention');process.exitCode=1}
    // Removing a customer also cancels subscriptions. Never use that as a
    // workaround when the provider requires approval for cancellation.
    if(canRemoveCustomer)try{await stripe.customers.del(customer)}catch{console.error('Test customer cleanup needs attention');process.exitCode=1}
  }
  if(userId){const removed=await admin.auth.admin.deleteUser(userId);if(removed.error){console.error('Disposable account cleanup needs attention');process.exitCode=1}else console.log('Disposable Supabase test account removed; no real account modified.')}
}
