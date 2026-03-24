/**
 * 메모지 형태 아이콘을 프로그램으로 생성하고
 * resources/icon.png + build/icon.png + build/icon.ico(NSIS-safe)를 만든다.
 * 실행: npm run icons:build
 */
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { Jimp, rgbaToInt } from 'jimp'
import pngToIco from 'png-to-ico'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const buildDir = join(root, 'build')
const resourcesDir = join(root, 'resources')
const srcPng = join(root, 'resources', 'icon.png')

/** NSIS / Windows 설치 마법사가 기대하는 표준 크기들 */
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

mkdirSync(buildDir, { recursive: true })
mkdirSync(resourcesDir, { recursive: true })

const SIZE = 1024
const icon = new Jimp({ width: SIZE, height: SIZE, color: 0x00000000 })

const rgba = (r, g, b, a = 255) => rgbaToInt(r, g, b, a)
const fillRoundRect = (img, x, y, w, h, radius, color) => {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      const rx = px - x
      const ry = py - y
      const cx = rx < radius ? radius - rx : rx >= w - radius ? rx - (w - radius - 1) : 0
      const cy = ry < radius ? radius - ry : ry >= h - radius ? ry - (h - radius - 1) : 0
      if (cx * cx + cy * cy <= radius * radius) {
        img.setPixelColor(color, px, py)
      }
    }
  }
}

const blueBg = rgba(47, 104, 247)
const noteWhite = rgba(255, 255, 255)
const foldShade = rgba(232, 239, 255)
const lineBlue = rgba(51, 92, 184)
const tabYellow = rgba(247, 199, 62)

fillRoundRect(icon, 80, 80, 864, 864, 190, blueBg)
fillRoundRect(icon, 220, 180, 584, 664, 56, noteWhite)

// folded corner
for (let py = 180; py < 310; py++) {
  for (let px = 675; px < 804; px++) {
    if (px - 675 >= py - 180) {
      icon.setPixelColor(foldShade, px, py)
    }
  }
}

fillRoundRect(icon, 250, 220, 120, 66, 18, tabYellow)
fillRoundRect(icon, 290, 370, 440, 34, 16, lineBlue)
fillRoundRect(icon, 290, 470, 400, 34, 16, lineBlue)
fillRoundRect(icon, 290, 570, 360, 34, 16, lineBlue)

await icon.write(srcPng)
await icon.write(join(buildDir, 'icon.png'))

const base = await Jimp.read(srcPng)
const pngBuffers = await Promise.all(
  ICO_SIZES.map(async (size) => {
    const clone = base.clone().resize({ w: size, h: size })
    return clone.getBuffer('image/png')
  })
)

const icoBuf = await pngToIco(pngBuffers)
writeFileSync(join(buildDir, 'icon.ico'), icoBuf)

console.log('[icons] Wrote build/icon.png, build/icon.ico (multi-size NSIS-safe)')
