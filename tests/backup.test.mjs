import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { Readable } from 'node:stream'
import { mkdtemp, writeFile, readFile, rm, stat, readdir, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { encrypt, decrypt, digest, readKey } from '../scripts/backup/crypto.mjs'
import { verify, validateManifest, databaseEnv, publish, syncLocal, retain, execute } from '../scripts/backup/core.mjs'
import { Drive } from '../scripts/backup/drive.mjs'

async function fixture(callback) {
  const directory = await mkdtemp(path.join(tmpdir(), 'nocontrole-test-'))
  try { await callback(directory, randomBytes(32)) }
  finally { await rm(directory, { recursive: true, force: true }) }
}

async function sample(directory, key) {
  const files = []
  for (const [name, data] of [['database.dump.enc', 'dados financeiros de teste'], ['roles.sql.enc', 'roles de teste'], ['storage-000000.enc', 'foto de teste']]) {
    files.push({ name, ...await encrypt(Readable.from([Buffer.from(data)]), path.join(directory, name), key) })
  }
  const manifest = { format: 1, project: 'fixture', files }
  await encrypt(Readable.from([Buffer.from(JSON.stringify(manifest))]), path.join(directory, 'manifest.json.enc'), key)
  return manifest
}

test('backup encrypts large streams, hides financial text and recovers exactly', async () => {
  await fixture(async (directory, key) => {
    const original = Buffer.concat([Buffer.from('informação financeira confidencial'), randomBytes(1024 * 1024)])
    const file = path.join(directory, 'backup.enc'), output = path.join(directory, 'recovered')
    const expected = await encrypt(Readable.from([original.subarray(0, 50000), original.subarray(50000)]), file, key)
    const ciphertext = await readFile(file)
    assert.equal(ciphertext.includes(Buffer.from('informação financeira confidencial')), false)
    assert.deepEqual(await decrypt(file, key, output), expected)
    assert.deepEqual(await readFile(output), original)
    await assert.rejects(decrypt(file, key, output))
    assert.deepEqual(await readFile(output), original, 'existing recovery files must survive failed overwrite attempts')
    const second = path.join(directory, 'second.enc')
    await encrypt(Readable.from([original]), second, key)
    assert.notDeepEqual(await readFile(second), ciphertext)
    assert.throws(() => readKey('senha-curta'))
    assert.deepEqual(readKey(key.toString('hex')), key)
  })
})

test('wrong key, changed header, ciphertext, tag and truncation never leave recovered files', async () => {
  await fixture(async (directory, key) => {
    const file = path.join(directory, 'original.enc')
    await encrypt(Readable.from([Buffer.from('snapshot privado')]), file, key)
    const original = await readFile(file)
    for (const [index, badKey] of [[0, false], [9, false], [22, false], [original.length - 1, false], [null, true]]) {
      const corrupted = Buffer.from(original)
      if (index !== null) corrupted[index] ^= 1
      const input = path.join(directory, `bad-${index}.enc`), output = `${input}.plain`
      await writeFile(input, corrupted)
      await assert.rejects(decrypt(input, badKey ? randomBytes(32) : key, output))
      await assert.rejects(stat(output), { code: 'ENOENT' })
    }
    await writeFile(file, original.subarray(0, 30))
    await assert.rejects(decrypt(file, key), /truncado/)
    const empty = path.join(directory, 'empty.enc')
    const expected = await encrypt(Readable.from([]), empty, key)
    assert.deepEqual(await decrypt(empty, key), expected)
  })
})

test('backup manifest detects missing, changed and unexpected files and rejects traversal', async () => {
  await fixture(async (directory, key) => {
    const manifest = await sample(directory, key)
    assert.deepEqual(await verify(directory, key), manifest)
    for (const name of ['../credentials.enc', 'manifest.json.enc', 'storage-000000.enc/evil']) {
      assert.throws(() => validateManifest({ ...manifest, files: [{ ...manifest.files[0], name }] }))
    }
    assert.throws(() => validateManifest({ ...manifest, files: [...manifest.files, manifest.files[0]] }))
    await writeFile(path.join(directory, 'unexpected.txt'), 'extra')
    await assert.rejects(verify(directory, key), /inesperados/)
    await rm(path.join(directory, 'unexpected.txt'))
    await rm(path.join(directory, 'roles.sql.enc'))
    await assert.rejects(verify(directory, key), /incompletos/)
  })
})

test('recovery extracts authenticated files to a new folder without writing to a database', async () => {
  await fixture(async (directory, key) => {
    const source = path.join(directory, 'source'), target = path.join(directory, 'recovery')
    await mkdir(source)
    await sample(source, key)
    await execute('extract', [source, target], { BACKUP_ENCRYPTION_KEY: key.toString('hex') })
    assert.equal(await readFile(path.join(target, 'database.dump'), 'utf8'), 'dados financeiros de teste')
    assert.equal(await readFile(path.join(target, 'storage-000000'), 'utf8'), 'foto de teste')
    await assert.rejects(execute('extract', [source, target], { BACKUP_ENCRYPTION_KEY: key.toString('hex') }), { code: 'EEXIST' })
  })
})

test('database credentials stay out of command arguments and transaction pooler is rejected', () => {
  const env = databaseEnv('postgresql://postgres.project:p%40ss@pooler.supabase.com:5432/postgres', {})
  assert.equal(env.PGPASSWORD, 'p@ss')
  assert.equal(env.PGSSLMODE, 'require')
  assert.throws(() => databaseEnv('postgresql://postgres.project:secret@pooler.supabase.com:6543/postgres'), /Session Pooler/)
})

test('Drive refuses shared folders and paginates lists', async () => {
  const shared = new Drive('test', async () => new Response(JSON.stringify({ mimeType: 'application/vnd.google-apps.folder', shared: true })))
  await assert.rejects(shared.assertPrivate('folder'), /privada/)
  let requests = 0
  const drive = new Drive('test', async url => {
    requests++
    assert.ok(url.startsWith('https://www.googleapis.com/drive/v3/files?'))
    return new Response(JSON.stringify(requests === 1 ? { files: [{ id: 'one' }], nextPageToken: 'next' } : { files: [{ id: 'two' }] }))
  })
  assert.equal((await drive.list('trashed = false')).length, 2)
  assert.equal(requests, 2)
})

test('failed upload never marks a snapshot complete or deletes older backups', async () => {
  await fixture(async (directory, key) => {
    await sample(directory, key)
    const calls = []
    const drive = { assertPrivate: async () => {}, createFolder: async () => ({ id: 'snapshot' }), upload: async () => { throw Error('offline') }, complete: async () => calls.push('complete'), trash: async () => calls.push('trash') }
    await assert.rejects(publish(directory, drive, 'root'), /offline/)
    assert.deepEqual(calls, [])
  })
})

test('HD receives encrypted complete snapshots only, verifies them and skips valid copies', async () => {
  await fixture(async (directory, key) => {
    const remote = path.join(directory, 'remote'), local = path.join(directory, 'local')
    await mkdir(remote)
    await sample(remote, key)
    const name = 'nocontrole-2026-10-06T06-17-00-1234abcd'
    let downloads = 0
    const drive = {
      assertPrivate: async () => {},
      list: async q => q.includes("'root'") ? [{ id: 'snapshot', name }] : Promise.all((await readdir(remote)).map(async name => ({ id: name, name, md5Checksum: await digest(path.join(remote, name), 'md5') }))),
      download: async (id, destination) => { downloads++; await writeFile(destination, await readFile(path.join(remote, id)), { flag: 'wx' }) },
    }
    await syncLocal(drive, 'root', local, key)
    assert.ok(downloads > 0)
    const count = downloads
    await syncLocal(drive, 'root', local, key)
    assert.equal(downloads, count)
    await verify(path.join(local, name), key)
    drive.list = async () => [{ id: 'snapshot', name: '../../escape' }]
    await assert.rejects(syncLocal(drive, 'root', local, key), /Nome inesperado/)
  })
})

test('retention preserves three complete backups and ignores unrelated folders', async () => {
  const trashed = []
  const drive = { assertPrivate: async () => {}, trash: async id => trashed.push(id), list: async () => [
    ...Array.from({ length: 4 }, (_, index) => ({ id: String(index), name: `nocontrole-2026-01-0${index + 1}T06-17-00-1234abcd`, createdTime: `2026-01-0${index + 1}T06:17:00Z` })),
    { id: 'unrelated', name: 'documentos', createdTime: '2020-01-01T00:00:00Z' },
  ] }
  await retain(drive, 'root', 30, new Date('2026-10-06T00:00:00Z'))
  assert.deepEqual(trashed, ['0'])
})
