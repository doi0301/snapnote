/**
 * 메모지 형태 아이콘을 프로그램으로 생성하고
 * resources/icon.png + build/icon.png + build/icon.ico(NSIS-safe)를 만든다.
 * 실행: npm run icons:build
 *
 * 초기 버전과 같이 바깥·안쪽 라운드 배경을 두되, 둘 다 순백(#fff).
 * 그 위에 보라 메모 + 흰 테두리 링 + 흰 줄 2개.
 * ICO 다운스케일은 Hermite(번짐 완화).
 */
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { Jimp, rgbaToInt, ResizeStrategy } from 'jimp'
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

const pureWhite = rgba(255, 255, 255)
const memoPurple = rgba(139, 92, 246)

/** 초기 아이콘과 동일한 바깥·안쪽 배경 — 색만 순백 */
fillRoundRect(icon, 72, 72, 880, 880, 210, pureWhite)
fillRoundRect(icon, 96, 96, 832, 832, 190, pureWhite)

/** 메모 카드 영역 (원래 흰 메모지 좌표와 동일) */
const OUT_X = 176
const OUT_Y = 220
const OUT_W = 672
const OUT_H = 584
const R_OUT = 48

/** 큰 캔버스 기준 22px 링에 상응하는 두께 (672폭 메모에 맞춤) */
const BORDER_W = 15

const IN_X = OUT_X + BORDER_W
const IN_Y = OUT_Y + BORDER_W
const IN_W = OUT_W - 2 * BORDER_W
const IN_H = OUT_H - 2 * BORDER_W
const R_IN = Math.max(6, R_OUT - BORDER_W)

fillRoundRect(icon, OUT_X, OUT_Y, OUT_W, OUT_H, R_OUT, pureWhite)
fillRoundRect(icon, IN_X, IN_Y, IN_W, IN_H, R_IN, memoPurple)

const L1_X = Math.round(IN_X + (72 * IN_W) / 672)
const L1_Y = Math.round(IN_Y + (172 * IN_H) / 584)
const L1_W = Math.round((528 * IN_W) / 672)
const L1_H = Math.round((58 * IN_H) / 584)
const L1_R = Math.max(8, Math.round((12 * IN_W) / 672))

const L2_X = Math.round(IN_X + (116 * IN_W) / 672)
const L2_Y = Math.round(IN_Y + (296 * IN_H) / 584)
const L2_W = Math.round((440 * IN_W) / 672)

fillRoundRect(icon, L1_X, L1_Y, L1_W, L1_H, L1_R, pureWhite)
fillRoundRect(icon, L2_X, L2_Y, L2_W, L1_H, L1_R, pureWhite)

await icon.write(srcPng)
await icon.write(join(buildDir, 'icon.png'))

const base = await Jimp.read(srcPng)
const pngBuffers = await Promise.all(
  ICO_SIZES.map(async (size) => {
    const clone = base.clone().resize({ w: size, h: size, mode: ResizeStrategy.HERMITE })
    return clone.getBuffer('image/png')
  })
)

const icoBuf = await pngToIco(pngBuffers)
writeFileSync(join(buildDir, 'icon.ico'), icoBuf)

console.log('[icons] Wrote build/icon.png, build/icon.ico (multi-size NSIS-safe)')
