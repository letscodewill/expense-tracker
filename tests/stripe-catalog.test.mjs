import test from 'node:test'
import assert from 'node:assert/strict'
import { offers, configureCatalog } from '../scripts/stripe/configure-catalog.mjs'

test('Stripe catalog uses the approved recurring amounts and reuses every created price', async () => {
  const prices = new Map(), writes=[]
  const api=async(method,path,args,idempotency)=>{
    assert.equal(path,'/prices')
    if(method==='GET')return {data:prices.has(args['lookup_keys[]'])?[prices.get(args['lookup_keys[]'])]:[]}
    assert.equal(method,'POST');assert.ok(idempotency)
    writes.push(args)
    const price={id:`price_test_${writes.length}`,active:true,product:args.product,currency:args.currency,unit_amount:Number(args.unit_amount),type:'recurring',recurring:{interval:args['recurring[interval]'],interval_count:1}}
    prices.set(args.lookup_key,price);return price
  }
  assert.deepEqual((await configureCatalog(api)).map(o=>o.id),Array(4).fill(null))
  assert.equal(writes.length,0,'Dry run cannot create prices')
  const first=await configureCatalog(api,true)
  assert.deepEqual(first.map(o=>o.amount),[1490,14990,399,3990])
  assert.deepEqual(first.map(o=>o.interval),['month','year','month','year'])
  assert.equal(writes.length,4)
  assert.deepEqual(await configureCatalog(api,true),first)
  assert.equal(writes.length,4,'Retry cannot duplicate prices')
})

test('Stripe catalog refuses existing prices with the wrong currency, amount or recurrence',async()=>{
  const offer=offers[0]
  const correct={id:'price_test',active:true,product:'nocontrole_pro_v1',currency:offer.currency,unit_amount:offer.amount,type:'recurring',recurring:{interval:offer.interval,interval_count:1}}
  for(const invalid of [{...correct,active:false},{...correct,currency:'usd'},{...correct,unit_amount:990},{...correct,type:'one_time',recurring:null},{...correct,recurring:{interval:'year',interval_count:1}},{...correct,product:'other'}]){
    await assert.rejects(configureCatalog(async(method)=>{assert.equal(method,'GET');return{data:[invalid]}},true),/incompatível/)
  }
})
