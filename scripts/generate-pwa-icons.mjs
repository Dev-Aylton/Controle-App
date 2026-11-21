import { mkdir } from 'node:fs/promises'
import { URL, fileURLToPath } from 'node:url'
import sharp from 'sharp'

const iconSvg = fileURLToPath(new URL('../docs/logos/opcao-a/icon-light.svg', import.meta.url))
const publicDir = fileURLToPath(new URL('../public/', import.meta.url))

await mkdir(publicDir, { recursive: true })

const iconBuffer = await sharp(iconSvg).resize(192, 192).toBuffer()

await sharp(iconBuffer).resize(192, 192).png().toFile(`${publicDir}pwa-192x192.png`)
await sharp(iconBuffer).resize(512, 512).png().toFile(`${publicDir}pwa-512x512.png`)
await sharp(iconBuffer).resize(180, 180).png().toFile(`${publicDir}apple-touch-icon-180x180.png`)

const maskableIcon = await sharp(iconBuffer)
  .resize(410, 410)
  .png()
  .toBuffer()

await sharp({
  create: {
    width: 512,
    height: 512,
    channels: 4,
    background: '#F7FAF8',
  },
})
  .composite([{ input: maskableIcon, left: 51, top: 51 }])
  .png()
  .toFile(`${publicDir}pwa-maskable-512x512.png`)
