import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svg = readFileSync(join(__dirname, '..', 'public', 'favicon.svg'), 'utf-8')
const outDir = join(__dirname, '..', 'public', 'icons')

const sizes = [192, 512]
for (const size of sizes) {
  const png = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()
  writeFileSync(join(outDir, `icon-${size}x${size}.png`), png)
  console.log(`✓ icon-${size}x${size}.png`)
}
