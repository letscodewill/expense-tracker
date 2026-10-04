import assert from 'node:assert/strict'

// Run against a local production server: node tests/smoke.mjs [base URL].
const base = process.argv[2] ?? 'http://localhost:3100'
for (const [route, expected] of [
  ['/login', 'name="email"'],
  ['/login?mode=recover', 'Recuperar senha'],
]) {
  const response = await fetch(`${base}${route}`)
  assert.equal(response.status, 200)
  const html = await response.text()
  assert.ok(html.includes(expected))
  assert.ok(!html.includes('bg-canto.png'))
  assert.ok(html.includes('Aparência'))
  assert.ok(html.includes('Claro'))
  assert.ok(html.includes('Escuro'))
  console.log(`PASS ${route}: form and theme selector render without background image`)
}
for (const route of ['/', '/reports']) {
  const response = await fetch(`${base}${route}`, { redirect: 'manual' })
  assert.ok([303, 307, 308].includes(response.status))
  assert.equal(new URL(response.headers.get('location'), base).pathname, '/login')
  console.log(`PASS ${route}: unauthenticated access redirects to login`)
}
