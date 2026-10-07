import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { open, writeFile, appendFile, stat, rm } from 'node:fs/promises'
import { Readable, Transform, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const MAGIC = Buffer.from('NCBACK01')
const HEADER_SIZE = 20

export function readKey(value) {
  if (!/^[a-f0-9]{64}$/i.test(value ?? '')) throw new Error('BACKUP_ENCRYPTION_KEY deve conter 64 caracteres hexadecimais (32 bytes).')
  return Buffer.from(value, 'hex')
}

export async function encrypt(source, destination, key) {
  const header = Buffer.concat([MAGIC, randomBytes(12)])
  const cipher = createCipheriv('aes-256-gcm', key, header.subarray(8))
  cipher.setAAD(header)
  const hash = createHash('sha256')
  let bytes = 0
  const counter = new Transform({ transform(chunk, _, done) { bytes += chunk.length; hash.update(chunk); done(null, chunk) } })
  await writeFile(destination, header, { flag: 'wx', mode: 0o600 })
  try {
    await pipeline(source, counter, cipher, createWriteStream(destination, { flags: 'a', mode: 0o600 }))
    await appendFile(destination, cipher.getAuthTag())
    return { bytes, sha256: hash.digest('hex') }
  } catch {
    await rm(destination, { force: true })
    throw new Error('Falha ao gerar arquivo criptografado; nenhum backup foi publicado.')
  }
}

// Authentication is checked even when no plaintext output is requested.
// Output is written to a temporary file and published only after the GCM tag validates.
export async function decrypt(source, key, destination) {
  const { size } = await stat(source)
  if (size < HEADER_SIZE + 16) throw new Error('Backup truncado.')
  const file = await open(source, 'r')
  const header = Buffer.alloc(HEADER_SIZE), tag = Buffer.alloc(16)
  try {
    await file.read(header, 0, HEADER_SIZE, 0)
    await file.read(tag, 0, 16, size - 16)
  } finally { await file.close() }
  if (!header.subarray(0, 8).equals(MAGIC)) throw new Error('Formato de backup desconhecido.')
  const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(8))
  decipher.setAAD(header)
  decipher.setAuthTag(tag)
  const hash = createHash('sha256')
  let bytes = 0
  const counter = new Transform({ transform(chunk, _, done) { bytes += chunk.length; hash.update(chunk); done(null, chunk) } })
  const output = typeof destination === 'string'
    ? createWriteStream(destination, { flags: 'wx', mode: 0o600 })
    : destination ?? new Writable({ write(_chunk, _encoding, done) { done() } })
  let createdOutput = false
  if (typeof destination === 'string') output.once('open', () => { createdOutput = true })
  try {
    const input = size === HEADER_SIZE + 16 ? Readable.from([]) : createReadStream(source, { start: HEADER_SIZE, end: size - 17 })
    await pipeline(input, decipher, counter, output)
    return { bytes, sha256: hash.digest('hex') }
  } catch {
    if (typeof destination === 'string' && createdOutput) await rm(destination, { force: true })
    throw new Error('Backup inválido: chave incorreta, arquivo alterado ou incompleto.')
  }
}

export async function readEncryptedJSON(source, key) {
  const chunks = []
  let size = 0
  await decrypt(source, key, new Writable({ write(chunk, _, done) {
    size += chunk.length
    if (size > 8 * 1024 * 1024) return done(new Error('Manifesto muito grande.'))
    chunks.push(chunk); done()
  } }))
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

export async function digest(file, algorithm = 'sha256') {
  const hash = createHash(algorithm)
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}
