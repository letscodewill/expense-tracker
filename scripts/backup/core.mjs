import { readdir, mkdir, mkdtemp, rm, rename, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { spawn } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { encrypt, decrypt, readKey, readEncryptedJSON, digest } from './crypto.mjs'
import { connect, required, APP } from './drive.mjs'

const SCHEMAS = ['public', 'app_private', 'auth', 'storage', 'supabase_migrations']
const FILE = /^(database\.dump|roles\.sql|manifest\.json|storage-\d{6})\.enc$/
const DIRECTORY = /^nocontrole-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-[a-f0-9]{8}$/

export function databaseEnv(connection, base = process.env) {
  const url = new URL(connection)
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || !url.password) throw new Error('BACKUP_DATABASE_URL inválida.')
  if (url.port === '6543') throw new Error('Use a conexão Session Pooler (5432), não Transaction Pooler (6543).')
  return { ...base, PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGSSLMODE: url.searchParams.get('sslmode') || 'require', PGCONNECT_TIMEOUT: '30' }
}

function processOutput(program, args, env) {
  const child = spawn(program, args, { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  // Never echo PostgreSQL stderr: it can contain connection details or user data.
  child.stderr.resume()
  const done = new Promise((resolve, reject) => {
    child.on('error', () => reject(new Error(`${program} não está disponível.`)))
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`${program} falhou; o backup não foi concluído.`)))
  })
  // Attach a handler immediately so a failed subprocess cannot become unhandled.
  done.catch(() => {})
  return { child, done }
}

async function sql(env, query) {
  const { child, done } = processOutput('psql', ['-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', query], env)
  const chunks = []
  for await (const chunk of child.stdout) chunks.push(chunk)
  await done
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new Error('Resposta inválida do PostgreSQL ao consultar o inventário.') }
}

const INVENTORY = `select json_build_object(
  'buckets', (select coalesce(json_agg(b order by b.id), '[]'::json) from storage.buckets b),
  'objects', (select coalesce(json_agg(o order by o.bucket_id, o.name), '[]'::json) from (select bucket_id,name,updated_at,metadata from storage.objects) o)
)`;

export function validateManifest(manifest) {
  if (manifest?.format !== 1 || !Array.isArray(manifest.files) || !manifest.files.length || !manifest.project) throw new Error('Manifesto de backup inválido.')
  const names = new Set()
  for (const file of manifest.files) {
    if (!FILE.test(file.name) || file.name === 'manifest.json.enc' || names.has(file.name) || !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.bytes) || file.bytes < 0) throw new Error('Entrada inválida no manifesto.')
    names.add(file.name)
  }
  if (!names.has('database.dump.enc') || !names.has('roles.sql.enc')) throw new Error('Backup do banco incompleto.')
  return manifest
}

export async function verify(directory, key) {
  const manifest = validateManifest(await readEncryptedJSON(path.join(directory, 'manifest.json.enc'), key))
  const expected = new Set(['manifest.json.enc', ...manifest.files.map(file => file.name)])
  const entries = await readdir(directory, { withFileTypes: true })
  if (entries.length !== expected.size || entries.some(entry => !entry.isFile() || !expected.has(entry.name))) throw new Error('A cópia contém arquivos inesperados ou incompletos.')
  for (const file of manifest.files) {
    const actual = await decrypt(path.join(directory, file.name), key)
    if (actual.bytes !== file.bytes || actual.sha256 !== file.sha256) throw new Error('O conteúdo do backup não corresponde ao manifesto.')
  }
  return manifest
}

export async function createBackup(env = process.env) {
  const key = readKey(required(env, 'BACKUP_ENCRYPTION_KEY'))
  const db = databaseEnv(required(env, 'BACKUP_DATABASE_URL'))
  const base = new URL(required(env, 'BACKUP_SUPABASE_URL'))
  if (base.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/.test(base.hostname) || base.pathname !== '/') throw new Error('BACKUP_SUPABASE_URL deve ser a URL HTTPS do projeto Supabase.')
  const project = base.hostname.split('.')[0]
  if (!db.PGHOST.includes(project) && !db.PGUSER.endsWith(`.${project}`)) throw new Error('A conexão do banco e o Storage devem pertencer ao mesmo projeto.')
  const supabase = createClient(base.origin, required(env, 'BACKUP_SUPABASE_SECRET_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
  const directory = await mkdtemp(path.join(tmpdir(), 'nocontrole-backup-'))
  try {
    const before = await sql(db, INVENTORY)
    const version = await sql(db, `select to_json(current_setting('server_version'))`)
    const manifest = { format: 1, project, createdAt: new Date().toISOString(), postgresVersion: version, schemas: SCHEMAS, storage: before, files: [] }
    for (const [name, program, args] of [
      ['database.dump.enc', 'pg_dump', ['--format=custom', '--lock-wait-timeout=30000', ...SCHEMAS.flatMap(schema => ['--schema', schema])]],
      ['roles.sql.enc', 'pg_dumpall', ['--roles-only', '--no-role-passwords']],
    ]) {
      const { child, done } = processOutput(program, args, db)
      try {
        const result = await encrypt(child.stdout, path.join(directory, name), key)
        await done
        if (result.bytes === 0) throw new Error('Exportação vazia.')
        manifest.files.push({ name, ...result })
      } catch (error) { child.kill(); await done.catch(() => {}); throw error }
    }
    for (const [index, object] of before.objects.entries()) {
      const { data, error } = await supabase.storage.from(object.bucket_id).download(object.name)
      if (error || !data) throw new Error('Falha ao baixar um objeto do Storage; backup incompleto.')
      const name = `storage-${String(index).padStart(6, '0')}.enc`
      const result = await encrypt(Readable.fromWeb(data.stream()), path.join(directory, name), key)
      manifest.files.push({ name, bucket: object.bucket_id, object: object.name, contentType: data.type, ...result })
    }
    const after = await sql(db, INVENTORY)
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('O Storage mudou durante o backup. Execute novamente para obter uma cópia consistente.')
    await encrypt(Readable.from([Buffer.from(JSON.stringify(manifest))]), path.join(directory, 'manifest.json.enc'), key)
    await verify(directory, key)
    return { directory, manifest }
  } catch (error) { await rm(directory, { recursive: true, force: true }); throw error }
}

export function backupName(now = new Date()) {
  return `nocontrole-${now.toISOString().slice(0, 19).replaceAll(':', '-')}-${crypto.randomUUID().slice(0, 8)}`
}

export async function publish(directory, drive, root, now = new Date()) {
  await drive.assertPrivate(root)
  const folder = await drive.createFolder(backupName(now), root, { app: APP, complete: 'false' })
  await drive.assertPrivate(folder.id)
  for (const name of (await readdir(directory)).sort()) {
    if (!FILE.test(name)) throw new Error('Somente arquivos criptografados podem ser enviados.')
    await drive.upload(path.join(directory, name), name, folder.id)
  }
  await drive.complete(folder.id)
  return folder
}

export async function retain(drive, root, days = 30, now = new Date()) {
  await drive.assertPrivate(root)
  const folders = await drive.list(`'${root}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='app' and value='${APP}' } and appProperties has { key='complete' and value='true' }`)
  const valid = folders.filter(folder => DIRECTORY.test(folder.name) && Number.isFinite(Date.parse(folder.createdTime)))
    .sort((a, b) => Date.parse(b.createdTime) - Date.parse(a.createdTime))
  // Preserve at least three complete backups, even after a long outage.
  for (const folder of valid.slice(3)) {
    if (Date.parse(folder.createdTime) < now.getTime() - days * 86400000) {
      await drive.assertPrivate(folder.id)
      await drive.trash(folder.id)
    }
  }
}

export async function syncLocal(drive, root, local, key) {
  if (!path.isAbsolute(local)) throw new Error('BACKUP_LOCAL_DIR deve ser um caminho absoluto.')
  await drive.assertPrivate(root)
  await mkdir(local, { recursive: true, mode: 0o700 })
  const folders = await drive.list(`'${root}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='app' and value='${APP}' } and appProperties has { key='complete' and value='true' }`)
  for (const folder of folders) {
    if (!DIRECTORY.test(folder.name)) throw new Error('Nome inesperado de backup no Drive.')
    const target = path.join(local, folder.name)
    try { await stat(target); await verify(target, key); continue } catch (error) { if (error.code !== 'ENOENT') throw error }
    await drive.assertPrivate(folder.id)
    const files = await drive.list(`'${folder.id}' in parents and trashed = false`)
    const names = new Set()
    for (const file of files) {
      if (!FILE.test(file.name) || names.has(file.name) || !file.md5Checksum || file.shared) throw new Error('Backup remoto inválido ou compartilhado.')
      names.add(file.name)
    }
    const pending = await mkdtemp(path.join(local, '.pending-'))
    try {
      for (const file of files) {
        const output = path.join(pending, file.name)
        await drive.download(file.id, output)
        if (await digest(output, 'md5') !== file.md5Checksum) throw new Error('Falha na integridade da cópia local.')
      }
      await verify(pending, key)
      await rename(pending, target)
    } finally { await rm(pending, { recursive: true, force: true }) }
  }
  return folders.length
}

export async function execute(command, args, env = process.env) {
  const key = readKey(required(env, 'BACKUP_ENCRYPTION_KEY'))
  if (command === 'verify') {
    await verify(path.resolve(args[0] || ''), key)
    console.log('Backup autenticado; todos os arquivos passaram na verificação de integridade.')
    return
  }
  if (command === 'extract') {
    if (!args[0] || !args[1]) throw new Error('Informe a pasta de backup e uma nova pasta de destino.')
    const source = path.resolve(args[0]), output = path.resolve(args[1])
    const manifest = await verify(source, key)
    await mkdir(output, { recursive: false, mode: 0o700 })
    try {
      for (const file of manifest.files) await decrypt(path.join(source, file.name), key, path.join(output, file.name.replace(/\.enc$/, '')))
      // Generic numbered names prevent object names from escaping the recovery directory.
      const { writeFile } = await import('node:fs/promises')
      await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 })
      console.log('Arquivos recuperados. Nenhum banco de dados foi alterado. Proteja a pasta com dados descriptografados.')
    } catch (error) { await rm(output, { recursive: true, force: true }); throw error }
    return
  }
  if (!['run', 'sync'].includes(command)) throw new Error('Comandos disponíveis: run, sync, verify <pasta>, extract <pasta> <novo-destino>.')
  const drive = await connect(env)
  const root = required(env, 'GOOGLE_BACKUP_FOLDER_ID')
  if (command === 'sync') {
    await syncLocal(drive, root, required(env, 'BACKUP_LOCAL_DIR'), key)
    console.log('Cópia local criptografada e verificada.')
    return
  }
  const backup = await createBackup(env)
  try {
    await publish(backup.directory, drive, root)
    if (env.BACKUP_LOCAL_DIR) await syncLocal(drive, root, env.BACKUP_LOCAL_DIR, key)
    await retain(drive, root)
    console.log('Backup privado enviado e verificado. Nenhum dado de produção foi alterado.')
  } finally { await rm(backup.directory, { recursive: true, force: true }) }
}
