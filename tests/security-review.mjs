import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createRequire } from 'node:module'

const nodeRequire = createRequire(import.meta.url)
const code = ts.transpileModule(fs.readFileSync('app/auth/callback/route.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const result = { exports: {} }
vm.runInNewContext(code, {
  module: result, exports: result.exports, URL,
  require(name) {
    if (name === '@/lib/supabase/server') return { createClient: async () => ({ auth: { exchangeCodeForSession: async () => ({ error: null }) } }) }
    return nodeRequire(name)
  },
})
// Local proof only: a successful mocked code exchange, no real tokens or users.
for (const next of ['@phishing.invalid/login', 'https://phishing.invalid', '//phishing.invalid', '/\\phishing.invalid', '\\phishing.invalid', 'javascript:alert(1)', '/\n/phishing.invalid', ' /reports']) {
  const response = await result.exports.GET(new Request(`https://expense.example/auth/callback?code=mock&next=${encodeURIComponent(next)}`))
  assert.equal(response.headers.get('location'), 'https://expense.example/')
}
for (const next of ['/auth/update-password', '/reports?month=10', '/planning#budget']) {
  const response = await result.exports.GET(new Request(`https://expense.example/auth/callback?code=mock&next=${encodeURIComponent(next)}`))
  assert.equal(response.headers.get('location'), `https://expense.example${next}`)
}
const missing = await result.exports.GET(new Request('https://expense.example/auth/callback'))
assert.equal(new URL(missing.headers.get('location')).pathname, '/login')
console.log('PASS: authentication callback rejects external redirects and preserves internal recovery, query and fragment destinations')

const { createClient } = nodeRequire('@supabase/supabase-js')
let queryUrl
const client = createClient('https://testproject.supabase.co', 'test-public-key', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: async (url) => { queryUrl = new URL(url); return new Response('[]', { headers: { 'Content-Type': 'application/json' } }) } },
})
const input = "' OR 1=1; DROP TABLE expenses; --"
await client.from('expenses').select('id').eq('nome', input)
assert.equal(queryUrl.searchParams.get('nome'), `eq.${input}`)
console.log('PASS: SDK preserves SQL-like input as a filter value; this does not audit database RPC implementations')
