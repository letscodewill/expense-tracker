import { copyFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
const require = createRequire(import.meta.url)
await mkdir('public', { recursive: true })
await copyFile(path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'build/pdf.worker.min.mjs'), 'public/pdf.worker.min.mjs')
