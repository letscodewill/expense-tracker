import { pathToFileURL } from 'node:url'

export const offers = [
  { key: 'nocontrole_pro_brl_month_v1', currency: 'brl', interval: 'month', amount: 1490 },
  { key: 'nocontrole_pro_brl_year_v1', currency: 'brl', interval: 'year', amount: 14990 },
  { key: 'nocontrole_pro_usd_month_v1', currency: 'usd', interval: 'month', amount: 399 },
  { key: 'nocontrole_pro_usd_year_v1', currency: 'usd', interval: 'year', amount: 3990 },
]

export async function configureCatalog(api, apply = false) {
  const result = []
  for (const offer of offers) {
    const found = await api('GET', '/prices', { 'lookup_keys[]': offer.key, limit: '100' })
    let price = found.data[0]
    if (price && (!price.active || price.product !== 'nocontrole_pro_v1' || price.currency !== offer.currency || price.unit_amount !== offer.amount || price.type !== 'recurring' || price.recurring?.interval !== offer.interval || price.recurring?.interval_count !== 1)) throw new Error(`Preço incompatível: ${offer.key}`)
    if (!price && apply) price = await api('POST', '/prices', {
      product: 'nocontrole_pro_v1', currency: offer.currency, unit_amount: String(offer.amount),
      'recurring[interval]': offer.interval, lookup_key: offer.key, nickname: offer.key,
      'metadata[app]': 'nocontrole', 'metadata[plan]': 'pro',
    }, `nocontrole-price-${offer.key}`)
    result.push({ ...offer, id: price?.id ?? null })
  }
  return result
}

async function main() {
  process.loadEnvFile('.env.local')
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || !/^(rk|sk)_(test|live)_/.test(key)) throw new Error('Configure STRIPE_SECRET_KEY no arquivo local.')
  const api = async (method, path, params, idempotency) => {
    const query = new URLSearchParams(params)
    const response = await fetch(`https://api.stripe.com/v1${path}${method === 'GET' ? '?' + query : ''}`, {
      method, headers: { Authorization: `Bearer ${key}`, 'Stripe-Version': '2026-10-28.endive',
        ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': idempotency } : {}) },
      ...(method === 'POST' ? { body: query } : {}), signal: AbortSignal.timeout(20000),
    })
    const body = await response.json()
    if (!response.ok) throw new Error(`Stripe recusou ${method} ${path}: HTTP ${response.status}, ${body.error?.code ?? body.error?.type ?? 'erro'}.`)
    return body
  }
  console.log(JSON.stringify(await configureCatalog(api, process.argv.includes('--apply')), null, 2))
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error.message); process.exitCode = 1 })
