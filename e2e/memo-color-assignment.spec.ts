/**
 * P4 — 창 상단 컬러 랜덤 배정 회귀 테스트.
 *
 * 예전 로직은 `createMemo` 안에서 활성 메모 개수(deleted_at IS NULL) % 3 으로
 * 색을 골랐다. "만들고 바로 지우는" 흔한 워크플로에서는 활성 개수가 매번 같은
 * 값에 머물러, 새 메모가 항상 같은 색(사용자 보고: 초록색)만 받는 버그가 있었다.
 * 이제는 색이 (1) 현재 열린 창들이 안 쓰는 색 중 랜덤, (2) 다 소진되면 팔레트
 * 전체에서 랜덤으로 정해진다.
 */
import { existsSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchSnapNote, mainScript, waitForPage } from './helpers'

test.beforeAll(() => {
  if (!existsSync(mainScript)) {
    throw new Error(
      '빌드 산출물이 없습니다. E2E 전에 `npm run build` 를 실행하세요. (기대 경로: out/main/index.js)'
    )
  }
})

const HUE_CLASS_RE = /edit-root--memo-(\S+)/

/** 초기 "불러오는 중…" 상태엔 hue 클래스가 없으므로 메모 로드까지 폴링한다 */
async function currentEditHue(page: Page): Promise<string> {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const cls = await page.locator('.edit-root').getAttribute('class')
    const m = cls?.match(HUE_CLASS_RE)
    if (m) return m[1]!
    await page.waitForTimeout(100)
  }
  throw new Error('hue class did not appear on .edit-root in time')
}

async function openNewMemoEditWindow(app: ElectronApplication, folded: Page): Promise<Page> {
  await folded.getByTestId('folded-new-memo').click()
  return waitForPage(app, 'edit.html', 20_000)
}

/**
 * `waitForPage` 는 URL 부분 일치 중 첫 번째 창을 반환하므로, edit.html 창이
 * 여러 개 동시에 열려 있을 때는 방금 새로 뜬 창을 특정할 수 없다. 클릭 전후
 * 창 목록을 비교해 새로 추가된 edit.html 창만 골라낸다.
 */
async function openAnotherMemoEditWindow(app: ElectronApplication, folded: Page): Promise<Page> {
  const before = new Set(app.windows())
  await folded.getByTestId('folded-new-memo').click()
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      if (!before.has(w) && w.url().includes('edit.html')) return w
    }
    await new Promise((r) => setTimeout(r, 120))
  }
  throw new Error('new edit.html window did not appear')
}

test.describe('메모 색상 배정', () => {
  test('만들고 바로 닫는 걸 반복해도 매번 같은 색으로 고착되지 않는다 (버그 회귀)', async () => {
    const app = await launchSnapNote()
    try {
      const folded = await waitForPage(app, 'folded.html')
      const seenHues = new Set<string>()

      // 예전 버그: 항상 활성 메모가 0개인 상태에서 만들면 매번 같은 색(coral, index 0)이 나왔다.
      for (let i = 0; i < 15; i++) {
        const edit = await openNewMemoEditWindow(app, folded)
        seenHues.add(await currentEditHue(edit))
        await edit.close()
        await folded.bringToFront()
      }

      // 15번 반복해서 전부 같은 색이 나올 확률은 사실상 0에 가깝다 (팔레트 12색 중 랜덤)
      expect(seenHues.size).toBeGreaterThan(1)
    } finally {
      await app.close()
    }
  })

  test('동시에 여러 창을 열면 서로 다른 색을 우선 배정한다', async () => {
    const app = await launchSnapNote()
    try {
      const folded = await waitForPage(app, 'folded.html')
      const hues: string[] = []

      // 창을 닫지 않고 5개를 연달아 연다 — 서로 겹치지 않아야 한다 (12색 중 5개라 여유 있음)
      for (let i = 0; i < 5; i++) {
        const edit = await openAnotherMemoEditWindow(app, folded)
        await edit.waitForLoadState('domcontentloaded')
        hues.push(await currentEditHue(edit))
        await folded.bringToFront()
      }

      expect(new Set(hues).size).toBe(hues.length)
    } finally {
      await app.close()
    }
  })
})
