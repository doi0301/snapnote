/**
 * SNAPNOTE_PERF_STRICT=1 로 성능 예산 테스트 실행 (NFR에 가까운 한계).
 * 선행: npm run build
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = { ...process.env, SNAPNOTE_PERF_STRICT: '1' }

const r = spawnSync('npx', ['playwright', 'test', 'e2e/perf-budgets.spec.ts'], {
  cwd: root,
  stdio: 'inherit',
  env,
  shell: true
})

process.exit(r.status ?? 1)
