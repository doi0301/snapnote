import { existsSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { launchSnapNote, mainScript, waitForPage } from './helpers'

/**
 * TASK-S5-07 Playwright 측정.
 * - `SNAPNOTE_PERF_STRICT=1` 이면 SRD에 가까운 타이트 한계(콜드 3s, 편집 200ms, 히스토리 300ms, 메모리 150MB).
 * - 기본값은 개발기·CI 변동을 허용하는 완화 한계(문서 `docs/PERF_S5-07.md` 참고).
 */
const strict = process.env.SNAPNOTE_PERF_STRICT === '1'

const LIMIT = {
  coldStartMs: strict ? 3000 : 8000,
  editOpenMs: strict ? 200 : 1200,
  /** 50개 + 창 생성·React 마운트 변동 */
  historyOpenMs: strict ? 300 : 1800,
  /** Chromium 다프로세스 합산은 기기별 편차 큼 — 엄격 모드만 150MB 목표 */
  idleMemoryMb: strict ? 150 : 400
}

test.beforeAll(() => {
  if (!existsSync(mainScript)) {
    throw new Error('`npm run build` 후 실행하세요 (out/main/index.js).')
  }
})

test.describe('TASK-S5-07 성능 예산', () => {
  test('콜드 스타트: Electron 기동 → 폴디드 load', async () => {
    const t0 = performance.now()
    const app = await electron.launch({
      args: [mainScript],
      cwd: process.cwd(),
      env: { ...process.env, SNAPNOTE_E2E: '1' }
    })
    try {
      const folded = await waitForPage(app, 'folded.html')
      await folded.waitForLoadState('load')
      const ms = performance.now() - t0
      expect(ms, `cold start ${ms.toFixed(0)}ms ≤ ${LIMIT.coldStartMs}ms`).toBeLessThanOrEqual(
        LIMIT.coldStartMs
      )
    } finally {
      await app.close()
    }
  })

  test('EditWindow: 새 메모 클릭 → edit domcontentloaded', async () => {
    const app = await launchSnapNote()
    try {
      const folded = await waitForPage(app, 'folded.html')
      await folded.waitForLoadState('load')
      const t0 = performance.now()
      await folded.getByTestId('folded-new-memo').click()
      const edit = await waitForPage(app, 'edit.html')
      await edit.waitForLoadState('domcontentloaded')
      const ms = performance.now() - t0
      expect(ms, `edit open ${ms.toFixed(0)}ms ≤ ${LIMIT.editOpenMs}ms`).toBeLessThanOrEqual(
        LIMIT.editOpenMs
      )
    } finally {
      await app.close()
    }
  })

  test('히스토리: 메모 50개 시드 후 열기까지', async () => {
    const app = await launchSnapNote({ SNAPNOTE_PERF_SEED: '50' })
    try {
      const folded = await waitForPage(app, 'folded.html')
      await folded.waitForLoadState('load')
      const t0 = performance.now()
      await folded.getByTestId('folded-history').click()
      const history = await waitForPage(app, 'history.html', 30_000)
      await history.getByRole('heading', { name: '메모 히스토리' }).waitFor({ state: 'visible' })
      await history.getByText(/전체 50개/).waitFor({ state: 'visible', timeout: 25_000 })
      await history.locator('.history-memo-item').first().waitFor({ state: 'visible', timeout: 10_000 })
      const ms = performance.now() - t0
      expect(ms, `history open ${ms.toFixed(0)}ms ≤ ${LIMIT.historyOpenMs}ms`).toBeLessThanOrEqual(
        LIMIT.historyOpenMs
      )
    } finally {
      await app.close()
    }
  })

  test('유휴 작업 집합 메모리 (getAppMetrics workingSet 합)', async () => {
    const app = await launchSnapNote()
    try {
      await waitForPage(app, 'folded.html')
      await new Promise((r) => setTimeout(r, 2500))
      const kb = await app.evaluate(({ app: electronApp }) => {
        const metrics = electronApp.getAppMetrics()
        let sum = 0
        for (const p of metrics) {
          sum += p.memory?.workingSetSize ?? 0
        }
        return sum
      })
      const mb = kb / 1024
      expect(mb, `idle sum working set ≈ ${mb.toFixed(0)}MB ≤ ${LIMIT.idleMemoryMb}MB`).toBeLessThanOrEqual(
        LIMIT.idleMemoryMb
      )
    } finally {
      await app.close()
    }
  })
})
