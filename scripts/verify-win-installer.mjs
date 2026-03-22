/**
 * TASK-S5-08: Windows NSIS 설치 파일이 dist/에 생성됐는지 검사.
 * 실행: npm run verify:win-installer
 * (선행) npm run build:win
 */
import { readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = join(root, 'dist')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const expectedName = `${pkg.name}-${pkg.version}-setup.exe`
const expectedPath = join(distDir, expectedName)

/** NSIS Electron 앱은 보통 수십 MB 이상 */
const MIN_BYTES = 8 * 1024 * 1024

function fail(msg) {
  console.error(`[verify-win-installer] ${msg}`)
  process.exit(1)
}

let stat
try {
  stat = statSync(expectedPath)
} catch {
  let found = []
  try {
    found = readdirSync(distDir).filter((f) => f.endsWith('-setup.exe'))
  } catch {
    fail(`dist/ 폴더가 없습니다. 먼저 npm run build:win 을 실행하세요.`)
  }
  if (found.length === 0) {
    fail(`예상 파일 없음: dist/${expectedName}\ndist 내용: ${readdirSync(distDir).join(', ') || '(비어 있음)'}`)
  }
  fail(`예상 파일명 불일치. 기대: ${expectedName}, 발견: ${found.join(', ')}`)
}

if (!stat.isFile()) fail(`${expectedPath} 가 파일이 아닙니다.`)
if (stat.size < MIN_BYTES) {
  fail(`설치 파일이 너무 작습니다 (${stat.size} bytes). 최소 ${MIN_BYTES} bytes 기대.`)
}

console.log(`[verify-win-installer] OK  dist/${expectedName}  (${(stat.size / (1024 * 1024)).toFixed(1)} MB)`)
console.log('[verify-win-installer] 다음: docs/INSTALL_VERIFY_WIN_S5-08.md 수동 절차(클린 PC 설치·제거)')
