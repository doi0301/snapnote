/**
 * resources/icon.png → build/icon.png 복사 + NSIS 호환 build/icon.ico
 * NSIS는 단일 해상도 ICO를 거부할 수 있음 → 16~256px 여러 크기를 한 ICO에 포함
 * 실행: npm run icons:build
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { Jimp } from 'jimp'
import pngToIco from 'png-to-ico'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const buildDir = join(root, 'build')
const srcPng = join(root, 'resources', 'icon.png')

/** NSIS / Windows 설치 마법사가 기대하는 표준 크기들 */
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

mkdirSync(buildDir, { recursive: true })
copyFileSync(srcPng, join(buildDir, 'icon.png'))

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
