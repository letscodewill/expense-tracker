// Regression check: runs the current configurator with synthetic files,
// mocked OAuth, mocked Drive and an in-memory writer. No real credentials used.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { parseEnv } from 'node:util'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const oldKey = 'a'.repeat(64)
let written = '', authorization = '', failure
const code = ts.transpileModule(fs.readFileSync('scripts/backup/configure-google.mjs', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText
const syntheticModule = { exports: {} }
vm.runInNewContext(code, {
  module: syntheticModule, exports: syntheticModule.exports, URL, URLSearchParams, AbortSignal,
  process: { argv: ['node', 'configurator', 'synthetic-client.json'] },
  setTimeout: () => 1, clearTimeout() {},
  console: { log(text) { if (String(text).startsWith('https://accounts.google.com/')) authorization = text }, error(error) { failure = error } },
  fetch: async () => Response.json({ access_token: 'synthetic-access', refresh_token: 'synthetic-refresh' }),
  require(name) {
    if (name === 'node:http') return { createServer: () => ({
      listen(_port, _host, callback) { callback() }, address: () => ({ port: 12345 }), close() {},
      on(_event, callback) {
        const state = new URL(authorization).searchParams.get('state')
        callback({ url: `/callback?state=${state}&code=synthetic-code` }, { setHeader() {}, end() {}, writeHead() { return this } })
      },
    }) }
    if (name === 'node:fs/promises') return {
      stat: async () => ({}),
      readFile: async file => String(file).endsWith('.env.backup.local')
        ? `BACKUP_ENCRYPTION_KEY=${oldKey}\nBACKUP_DATABASE_URL=postgresql://synthetic\nBACKUP_SUPABASE_SECRET_KEY=synthetic-secret\nBACKUP_LOCAL_DIR=C:\\synthetic-backup\n`
        : JSON.stringify({ installed: { client_id: 'synthetic-client', client_secret: 'synthetic-client-secret' } }),
      writeFile: async (_file, contents) => { written = contents },
    }
    if (name === './drive.mjs') return { APP: 'synthetic-app', Drive: class {
      async json() { return { user: { emailAddress: 'willslima123@gmail.com' } } }
      async list() { return [{ id: 'existing-folder' }] }
      async assertPrivate() {}
    } }
    if (name === './crypto.mjs') return { readKey: value => { assert.equal(value, oldKey) } }
    return require(name)
  },
})
for (let index = 0; index < 20 && !written && !failure; index++) await new Promise(setImmediate)
assert.equal(failure, undefined)
assert.ok(written)
const saved = parseEnv(written)
assert.equal(saved.BACKUP_ENCRYPTION_KEY, oldKey)
assert.equal(saved.BACKUP_DATABASE_URL, 'postgresql://synthetic')
assert.equal(saved.BACKUP_SUPABASE_SECRET_KEY, 'synthetic-secret')
assert.equal(saved.BACKUP_LOCAL_DIR, 'C:\\synthetic-backup')
assert.equal(saved.GOOGLE_BACKUP_REFRESH_TOKEN, 'synthetic-refresh')
assert.equal(saved.GOOGLE_BACKUP_FOLDER_ID, 'existing-folder')
console.log('PASS: reauthorization preserves the encryption key, database settings and local destination while updating the OAuth token. Synthetic configuration only; no real file was modified.')
