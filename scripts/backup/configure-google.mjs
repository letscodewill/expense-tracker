import { createServer } from 'node:http'
import { randomBytes, createHash } from 'node:crypto'
import { readFile, writeFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { parseEnv } from 'node:util'
import { Drive, APP } from './drive.mjs'
import { readKey } from './crypto.mjs'

// Use a separate Google OAuth Desktop client. Never reuse Supabase login credentials.
async function main() {
  const input = process.argv[2]
  if (!input) throw new Error('Informe o arquivo JSON do cliente OAuth Desktop baixado do Google Cloud.')
  const output = path.resolve('.env.backup.local')
  let existing = {}
  let hasExisting = false
  try {
    await stat(output)
    existing = parseEnv(await readFile(output, 'utf8'))
    readKey(existing.BACKUP_ENCRYPTION_KEY)
    hasExisting = true
  }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  const { installed: client } = JSON.parse(await readFile(input, 'utf8'))
  if (!client?.client_id || !client.client_secret) throw new Error('Use um cliente OAuth do tipo Aplicativo para computador (Desktop).')
  const state = randomBytes(32).toString('hex'), verifier = randomBytes(32).toString('base64url')
  const server = createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const redirect = `http://127.0.0.1:${server.address().port}/callback`
  const authorization = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authorization.search = new URLSearchParams({ client_id: client.client_id, redirect_uri: redirect,
    response_type: 'code', scope: 'https://www.googleapis.com/auth/drive.file', access_type: 'offline', prompt: 'consent',
    state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', login_hint: 'willslima123@gmail.com' }).toString()
  console.log('Abra o endereço abaixo no navegador e autorize a conta willslima123@gmail.com:')
  console.log(authorization.href)
  try {
    const code = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Autorização não concluída em 5 minutos.')), 300000)
      server.on('request', (request, response) => {
        const url = new URL(request.url, redirect)
        if (url.pathname !== '/callback' || url.searchParams.get('state') !== state) { response.writeHead(400).end('Solicitação inválida.'); return }
        clearTimeout(timer)
        response.setHeader('Content-Type', 'text/plain; charset=utf-8')
        if (!url.searchParams.get('code')) { response.end('Autorização cancelada.'); reject(new Error('O Google não autorizou o backup.')); return }
        response.end('Autorização recebida. Volte ao terminal para concluir a configuração.')
        resolve(url.searchParams.get('code'))
      })
    })
    const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
      body: new URLSearchParams({ client_id: client.client_id, client_secret: client.client_secret, code, code_verifier: verifier, redirect_uri: redirect, grant_type: 'authorization_code' }) })
    if (!response.ok) throw new Error('Não foi possível concluir a autorização Google.')
    const tokens = await response.json()
    if (!tokens.access_token || !tokens.refresh_token) throw new Error('O Google não forneceu o acesso offline necessário.')
    const drive = new Drive(tokens.access_token)
    const profile = await drive.json('about?fields=user(emailAddress)')
    if (profile.user?.emailAddress?.toLowerCase() !== 'willslima123@gmail.com') throw new Error('Conta diferente da escolhida; nenhuma pasta foi criada.')
    const existing = await drive.list(`name = 'Backups NoControle' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and appProperties has { key='app' and value='${APP}' }`)
    if (existing.length > 1) throw new Error('Há mais de uma pasta da rotina. Selecione a correta antes de prosseguir.')
    const folder = existing[0] ?? await drive.createFolder('Backups NoControle', null, { app: APP })
    await drive.assertPrivate(folder.id)
    const settings = {
      BACKUP_ENCRYPTION_KEY: existing.BACKUP_ENCRYPTION_KEY || randomBytes(32).toString('hex'),
      GOOGLE_BACKUP_CLIENT_ID: client.client_id,
      GOOGLE_BACKUP_CLIENT_SECRET: client.client_secret,
      GOOGLE_BACKUP_REFRESH_TOKEN: tokens.refresh_token,
      GOOGLE_BACKUP_FOLDER_ID: folder.id,
      BACKUP_LOCAL_DIR: existing.BACKUP_LOCAL_DIR || 'C:\\backupNoControle',
      BACKUP_SUPABASE_URL: existing.BACKUP_SUPABASE_URL || 'https://qxicijewzwrmpuiktthr.supabase.co',
      BACKUP_DATABASE_URL: existing.BACKUP_DATABASE_URL || '', BACKUP_SUPABASE_SECRET_KEY: existing.BACKUP_SUPABASE_SECRET_KEY || '',
    }
    // OAuth token and encryption key are saved locally, never printed.
    if (Object.values(settings).some(value => /['\r\n]/.test(value))) throw new Error('Configuração contém caracteres não suportados. Codifique caracteres especiais da senha na URL do banco.')
    await writeFile(output, Object.entries(settings).map(([name, value]) => `${name}='${value}'`).join('\n') + '\n', { flag: hasExisting ? 'w' : 'wx', mode: 0o600 })
    console.log('Pasta privada criada/verificada; credenciais e chave salvas em .env.backup.local (ignorado pelo Git).')
    console.log('Complete as credenciais do Supabase nesse arquivo e configure os Secrets do GitHub seguindo docs/BACKUP.md.')
    console.log('Guarde a chave de criptografia também em um gerenciador de senhas, separado dos backups.')
  } finally { server.close() }
}

main().catch(error => { console.error(error.message); process.exitCode = 1 })
