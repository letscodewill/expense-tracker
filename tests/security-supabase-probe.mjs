import fs from 'node:fs'

// Read-only anonymous HEAD requests. No sign-ins, writes or personal data output.
const env = { ...process.env }
for (const file of ['.env', '.env.local']) {
  if (!fs.existsSync(file)) continue
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY)=(.*)$/.exec(line)
    if (match) env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '')
  }
}
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key || key.startsWith('sb_secret_')) throw new Error('A public Supabase configuration is required')
if (key.split('.').length === 3) {
  const role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role
  if (role !== 'anon') throw new Error('This probe only accepts the anonymous role')
}
const results = await Promise.all(['expenses', 'boards', 'salaries', 'reports'].map(async (table) => {
  try {
    const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
      method: 'HEAD',
      headers: { apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}), Prefer: 'count=exact' },
      signal: AbortSignal.timeout(15000),
    })
    const total = response.headers.get('content-range')?.split('/')[1]
    return { table, status: response.status, anonymousRowsVisible: total && total !== '*' ? Number(total) > 0 : 'unknown' }
  } catch {
    return { table, error: 'Network access unavailable; no conclusions about RLS' }
  }
}))
console.log(JSON.stringify(results, null, 2))
if (results.some((result) => result.error)) process.exitCode = 2
