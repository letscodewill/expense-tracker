import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

function worker({ offline = false } = {}) {
  const handlers = {}, writes = [], deleted = []
  let claimed = false
  const cache = { addAll: async assets => writes.push(...assets) }
  const caches = { open: async () => cache, match: async path => path === '/offline.html' ? new Response('Sem conexão') : undefined,
    keys: async () => ['nocontrole-public-v1', 'nocontrole-public-v2', 'other-app-cache'], delete: async key => deleted.push(key) }
  const self = { location: { origin: 'https://nocontrole.test' }, addEventListener: (name, callback) => handlers[name] = callback,
    skipWaiting: async () => {}, clients: { claim: async () => { claimed = true } } }
  vm.runInNewContext(fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), { self, caches, URL, Response,
    fetch: async () => { if (offline) throw new Error('offline'); return new Response('network') } })
  async function lifecycle(name) { let work; handlers[name]({ waitUntil(promise) { work = promise } }); await work }
  async function request(path, options = {}) {
    let response
    handlers.fetch({ request: { url: `https://nocontrole.test${path}`, method: 'GET', mode: 'cors', ...options }, respondWith(promise) { response = promise } })
    return response ? await response : null
  }
  return { lifecycle, request, writes, deleted, claimed: () => claimed }
}
test('PWA caches only public assets and does not intercept financial APIs, uploads or authentication', async () => {
  const sw = worker()
  await sw.lifecycle('install')
  assert.ok(sw.writes.includes('/offline.html'))
  assert.ok(sw.writes.every(path => path === '/offline.html' || path.startsWith('/icons/')))
  for (const path of ['/api/invoices/analyze', '/api/tickets', '/auth/callback?code=private', '/planning?_rsc=private', '/_next/static/chunk.js']) {
    assert.equal(await sw.request(path), null)
    assert.equal(await sw.request(path, { method: 'POST' }), null)
  }
  assert.equal(await sw.request('/icons/icon-192.png', { method: 'POST' }), null)
  assert.equal((await sw.request('/', { mode: 'navigate' })).status, 200)
  assert.equal(await (await sw.request('/', { mode: 'navigate' })).text(), 'network')
})
test('PWA offline navigation uses a public fallback and only its own obsolete cache is removed', async () => {
  const sw = worker({ offline: true })
  assert.equal(await (await sw.request('/planning', { mode: 'navigate' })).text(), 'Sem conexão')
  await sw.lifecycle('activate')
  assert.deepEqual(sw.deleted, ['nocontrole-public-v1'])
  assert.equal(sw.claimed(), true)
})
test('PWA PNG icons have installation dimensions and favicon uses the app icon', () => {
  for (const [name, size] of [['icon-192.png',192], ['icon-512.png',512], ['icon-maskable-512.png',512], ['apple-touch-icon.png',180]]) {
    const bytes = fs.readFileSync(new URL(`../public/icons/${name}`, import.meta.url))
    assert.equal(bytes.readUInt32BE(16), size); assert.equal(bytes.readUInt32BE(20), size)
  }
  assert.equal(fs.readFileSync(new URL('../app/favicon.ico', import.meta.url)).readUInt16LE(2), 1)
})
