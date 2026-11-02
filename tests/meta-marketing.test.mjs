import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
function load(file,mocks={},globals={}) {
  const source=ts.transpileModule(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const module={exports:{}}
  vm.runInNewContext(source,{module,exports:module.exports,require:name=>mocks[name]??require(name),URL,Date,console,...globals})
  return module.exports
}
test('Pixel blocks all financial routes, auth secrets and unrecognized parameters',()=>{
  const {isMarketingLocation,validMarketingChoice}=load('lib/meta-marketing.ts')
  for(const path of ['/','/reports','/tickets/secret','/planning','/admin','/auth/callback?code=secret','/login?email=private','/plans?session_id=secret','/welcome#token=secret','/welcome?utm_campaign=private'])assert.equal(isMarketingLocation('https://app.test'+path),false,path)
  for(const path of ['/welcome','/login','/plans','/welcome?utm_source=meta&utm_medium=paid_social&utm_campaign=nocontrole_mx_50brl_2dias&utm_content=video_planilha_es&fbclid=IwTest'])assert.equal(isMarketingLocation('https://app.test'+path),true,path)
  assert.equal(validMarketingChoice(JSON.stringify({choice:'granted',at:Date.now()-181*86400000})),null)
  assert.equal(validMarketingChoice(JSON.stringify({choice:'granted',at:Date.now()+86400000})),null)
  assert.equal(validMarketingChoice(JSON.stringify({choice:'granted',at:Date.now()})),'granted')
})
test('Pixel requires opt-in and never forwards arbitrary data or personal information',()=>{
  const calls=[],storage=new Map(),window={location:{href:'https://app.test/plans'},fbq:(...args)=>calls.push(args)}
  const {trackMarketingEvent,MARKETING_CONSENT_KEY}=load('lib/meta-marketing.ts',{}, {window,localStorage:{getItem:k=>storage.get(k)??null}})
  assert.equal(trackMarketingEvent('Purchase',{value:3.99,currency:'USD'}),false)
  storage.set(MARKETING_CONSENT_KEY,JSON.stringify({choice:'granted',at:Date.now()}))
  assert.equal(trackMarketingEvent('Purchase',{value:3.99,currency:'USD',salary:1000,email:'private'},'safe-id'),true)
  assert.equal(JSON.stringify(calls).includes('private'),false)
  assert.equal(JSON.stringify(calls).includes('salary'),false)
  window.location.href='https://app.test/reports'
  assert.equal(trackMarketingEvent('Purchase',{value:3.99,currency:'USD'}),false)
})
test('Purchase requires the owner, paid Stripe status, live mode and an approved price',()=>{
  const {verifiedPurchase}=load('lib/meta-purchase.ts')
  const session={id:'cs_live_secret',client_reference_id:'user',mode:'subscription',status:'complete',payment_status:'paid',livemode:true,amount_total:399,currency:'usd',line_items:{has_more:false,data:[{quantity:1,price:{id:'price_allowed'}}]}}
  const event=verifiedPurchase(session,'user',true,['price_allowed'])
  assert.equal(event.value,3.99);assert.equal(event.currency,'USD');assert.match(event.eventID,/^[a-f0-9]{64}$/)
  assert.equal(event.eventID,verifiedPurchase(session,'user',true,['price_allowed']).eventID)
  for(const patch of [{client_reference_id:'other'},{payment_status:'unpaid'},{status:'open'},{livemode:false},{mode:'payment'},{amount_total:0},{amount_total:NaN},{currency:'eur'},{line_items:{has_more:false,data:[{quantity:1,price:{id:'price_wrong'}}]}}])assert.equal(verifiedPurchase({...session,...patch},'user',true,['price_allowed']),null)
})
test('Conversion endpoint refuses anonymous, cross-origin, no consent and unpaid purchases',async()=>{
  let user={id:'user',created_at:new Date().toISOString(),email_confirmed_at:new Date().toISOString()},paid=false,reads=0
  const {POST}=load('app/api/marketing/conversion/route.ts',{
    '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user},error:null})}})},
    '@/lib/stripe':{billingOrigin:()=> 'https://app.test',billingHeaders:{'Cache-Control':'private, no-store'},stripeClient:()=>({checkout:{sessions:{retrieve:async()=>{reads++;return {}}}}})},
    '@/lib/billing-offers':{BILLING_OFFERS:{test:{env:'TEST_PRICE'}}},
    '@/lib/meta-purchase':{verifiedPurchase:()=>paid?{value:3.99,currency:'USD',eventID:'a'.repeat(64)}:null},
  },{Response,process:{env:{STRIPE_SECRET_KEY:'sk_live_dummy',TEST_PRICE:'price_allowed'}}})
  const request=(origin='https://app.test',cookie='nocontrole-marketing=granted')=>new Request('https://app.test/api/marketing/conversion',{method:'POST',headers:{origin,cookie},body:JSON.stringify({action:'purchase',session:'cs_live_example'})})
  assert.equal((await POST(request('https://evil.test'))).status,403)
  assert.equal((await POST(request('https://app.test',''))).status,403)
  user=null;assert.equal((await POST(request())).status,401);assert.equal(reads,0)
  user={id:'user'};assert.equal((await (await POST(request())).json()).event,null)
  paid=true;assert.equal((await (await POST(request())).json()).event.value,3.99)
})
