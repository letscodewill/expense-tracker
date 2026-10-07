import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createWriteStream } from 'node:fs'
import { digest } from './crypto.mjs'

export const APP = 'nocontrole-backup-v1'
export function required(env, name) {
  const value = env[name]?.trim()
  if (!value) throw new Error(`Configure ${name} antes de executar.`)
  return value
}

export class Drive {
  constructor(token, fetcher = fetch) { this.token = token; this.fetcher = fetcher }
  async request(path, options = {}) {
    const response = await this.fetcher(`https://www.googleapis.com/drive/v3/${path}`, {
      ...options, redirect: 'error', signal: AbortSignal.timeout(120000),
      headers: { ...options.headers, Authorization: `Bearer ${this.token}` },
    })
    if (!response.ok) throw new Error(`Google Drive: operação recusada (HTTP ${response.status}).`)
    return response
  }
  async json(path, options) { return (await this.request(path, options)).json() }
  async list(q) {
    const files = []
    let token
    do {
      const params = new URLSearchParams({ q, pageSize: '1000', fields: 'nextPageToken,files(id,name,mimeType,createdTime,size,md5Checksum,appProperties,shared)', ...(token ? { pageToken: token } : {}) })
      const page = await this.json(`files?${params}`)
      files.push(...(page.files ?? [])); token = page.nextPageToken
    } while (token)
    return files
  }
  async assertPrivate(id) {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('ID da pasta inválido.')
    const folder = await this.json(`files/${id}?fields=id,name,mimeType,shared,trashed,owners(emailAddress),permissions(type,role,emailAddress),capabilities(canAddChildren)`)
    if (folder.trashed || folder.mimeType !== 'application/vnd.google-apps.folder' || folder.shared || folder.permissions?.some(p => p.role !== 'owner')) {
      throw new Error('A pasta de backup deve ser privada, sem compartilhamentos.')
    }
    return folder
  }
  async createFolder(name, parent, properties = {}) {
    return this.json('files?fields=id,name,webViewLink', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', ...(parent ? { parents: [parent] } : {}), appProperties: properties }) })
  }
  async upload(file, name, parent) {
    const { size } = await stat(file)
    const response = await this.fetcher('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,md5Checksum', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(120000),
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json', 'X-Upload-Content-Type': 'application/octet-stream', 'X-Upload-Content-Length': String(size) },
      body: JSON.stringify({ name, parents: [parent], appProperties: { app: APP } }),
    })
    const location = response.headers.get('location')
    if (!response.ok || !location || new URL(location).origin !== 'https://www.googleapis.com') throw new Error('Falha ao iniciar upload privado.')
    const uploaded = await this.fetcher(location, { method: 'PUT', redirect: 'error', duplex: 'half',
      signal: AbortSignal.timeout(1800000), headers: { Authorization: `Bearer ${this.token}`, 'Content-Length': String(size) }, body: createReadStream(file) })
    if (!uploaded.ok) throw new Error('Upload não foi concluído; a cópia não será marcada como válida.')
    const result = await uploaded.json()
    if (Number(result.size) !== size || result.md5Checksum !== await digest(file, 'md5')) throw new Error('Falha na verificação do arquivo enviado ao Drive.')
    return result
  }
  async download(id, destination) {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('ID de arquivo inválido.')
    const response = await this.request(`files/${id}?alt=media`)
    await pipeline(Readable.fromWeb(response.body), createWriteStream(destination, { flags: 'wx', mode: 0o600 }))
  }
  async complete(id) {
    await this.json(`files/${id}?fields=id`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appProperties: { app: APP, complete: 'true' } }) })
  }
  async trash(id) {
    await this.json(`files/${id}?fields=id`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) })
  }
}

export async function connect(env = process.env, fetcher = fetch) {
  const response = await fetcher('https://oauth2.googleapis.com/token', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: required(env, 'GOOGLE_BACKUP_CLIENT_ID'), client_secret: required(env, 'GOOGLE_BACKUP_CLIENT_SECRET'), refresh_token: required(env, 'GOOGLE_BACKUP_REFRESH_TOKEN') }),
  })
  if (!response.ok) throw new Error('Autorização Google expirada ou inválida. Execute novamente a configuração local.')
  const data = await response.json()
  if (!data.access_token) throw new Error('O Google não retornou uma autorização válida.')
  return new Drive(data.access_token, fetcher)
}
