import fs from 'node:fs/promises'
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
const source = new URL('../public/icons/icon-source.png', import.meta.url)
for (const [name, size] of [['favicon-32.png', 32], ['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512], ['apple-touch-icon.png', 180]]) {
  await sharp(await fs.readFile(source)).resize(size, size).png().toFile(fileURLToPath(new URL(`../public/icons/${name}`, import.meta.url)))
}
const png = await sharp(await fs.readFile(source)).resize(32, 32).ensureAlpha().png().toBuffer()
const header = Buffer.alloc(22)
header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4)
header[6] = 32; header[7] = 32
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12)
header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18)
await fs.writeFile(new URL('../app/favicon.ico', import.meta.url), Buffer.concat([header, png]))
