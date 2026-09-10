import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = path.join(root, 'public')
const iconDir = path.join(publicDir, 'icons')
await mkdir(iconDir, { recursive: true })
const source = await readFile(path.join(publicDir, 'favicon.svg'))
await Promise.all([
  writeFile(path.join(iconDir, 'icon.svg'), source),
  sharp(source).resize(192, 192).png().toFile(path.join(iconDir, 'icon-192.png')),
  sharp(source).resize(512, 512).png().toFile(path.join(iconDir, 'icon-512.png')),
  sharp(source).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png')),
])
// Inset the complete symbol inside the central 80% safe area for circular masks.
const inset = await sharp(source).resize(384, 384).png().toBuffer()
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#167457' } })
  .composite([{ input: inset, left: 64, top: 64 }])
  .png()
  .toFile(path.join(iconDir, 'maskable-512.png'))
console.log('PWA icons generated in public/icons/ and public/apple-touch-icon.png')
