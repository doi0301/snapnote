import { existsSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import {
  countWindowsMatching,
  e2eToggleFoldedFromMain,
  expectFoldedVisibility,
  launchSnapNote,
  mainScript,
  waitForPage
} from './helpers'

test.beforeAll(() => {
  if (!existsSync(mainScript)) {
    throw new Error(
      '빌드 산출물이 없습니다. E2E 전에 `npm run build` 를 실행하세요. (기대 경로: out/main/index.js)'
    )
  }
})

test.describe('TASK-S5-06 핵심 플로우', () => {
  test('앱 실행 → 첫 메모 생성 → 접기 → 폴디드 스택 확인', async () => {
    const app = await launchSnapNote()
    try {
      const folded = await waitForPage(app, 'folded.html')
      await expect(folded.getByTestId('folded-panel')).toBeVisible()
      await folded.getByTestId('folded-new-memo').click()
      const edit = await waitForPage(app, 'edit.html')
      const ta = edit.locator('.editor-line-textarea').first()
      await ta.click()
      await ta.fill('e2e-fold-9')
      await edit.getByTestId('edit-fold-btn').click()
      await folded.bringToFront()
      await expect(folded.getByTestId('folded-memo-slot').first()).toBeVisible({
        timeout: 20_000
      })
      await expect(folded.getByText('e2e-fold-9')).toBeVisible()
    } finally {
      await app.close()
    }
  })

  test('호버 → 프리뷰 표시 → 이탈 후 닫힘', async () => {
    const app = await launchSnapNote()
    try {
      const folded = await waitForPage(app, 'folded.html')
      await folded.getByTestId('folded-new-memo').click()
      const edit = await waitForPage(app, 'edit.html')
      const ta = edit.locator('.editor-line-textarea').first()
      await ta.click()
      await ta.fill('e2e-preview-hover')
      await edit.getByTestId('edit-fold-btn').click()
      await folded.bringToFront()
      const slot = folded.getByTestId('folded-memo-slot').first()
      await expect(slot).toBeVisible()
      await slot.hover()
      await expect
        .poll(() => countWindowsMatching(app, 'preview.html'), { timeout: 15_000 })
        .toBeGreaterThan(0)
      await folded.locator('.folded-drag').hover()
      await expect
        .poll(() => countWindowsMatching(app, 'preview.html'), { timeout: 10_000 })
        .toBe(0)
    } finally {
      await app.close()
    }
  })

  test('호버 → 프리뷰 클릭 → 편집 창 전환', async () => {
    const app = await launchSnapNote()
    try {
      const folded = await waitForPage(app, 'folded.html')
      await folded.getByTestId('folded-new-memo').click()
      const edit = await waitForPage(app, 'edit.html')
      const ta = edit.locator('.editor-line-textarea').first()
      await ta.click()
      await ta.fill('e2e-preview-click-edit')
      await edit.getByTestId('edit-fold-btn').click()
      await folded.bringToFront()
      const slot = folded.getByTestId('folded-memo-slot').first()
      await slot.hover()
      const preview = await waitForPage(app, 'preview.html', 20_000)
      await preview.getByTestId('preview-root').click()
      const editAgain = await waitForPage(app, 'edit.html', 20_000)
      await expect(editAgain.locator('.editor-line-textarea').first()).toHaveValue(
        'e2e-preview-click-edit'
      )
    } finally {
      await app.close()
    }
  })

  test('히스토리: 검색 · 태그 필터 · 단일 삭제', async () => {
    const app = await launchSnapNote()
    try {
      const folded = await waitForPage(app, 'folded.html')
      await folded.getByTestId('folded-new-memo').click()
      const edit = await waitForPage(app, 'edit.html')
      const ta = edit.locator('.editor-line-textarea').first()
      await ta.click()
      await ta.fill('e2e-history-search-unique')
      await edit.locator('.tag-input-field').fill('#e2e_hist_only')
      await ta.click()
      await edit.getByTestId('edit-fold-btn').click()
      await folded.bringToFront()
      await folded.getByTestId('folded-history').click()
      const history = await waitForPage(app, 'history.html')
      await expect(history.getByRole('heading', { name: '메모 히스토리' })).toBeVisible()
      await history.getByTestId('history-search-input').fill('e2e-history-search-unique')
      await expect(history.getByText('e2e-history-search-unique')).toBeVisible()
      await history
        .locator('.history-tag-filter')
        .getByRole('button', { name: '#e2e_hist_only', exact: true })
        .click()
      await expect(history.getByText('e2e-history-search-unique')).toBeVisible()
      history.once('dialog', (d) => {
        void d.accept()
      })
      await history.getByRole('button', { name: '메모 영구 삭제' }).first().click()
      await expect(history.getByText('e2e-history-search-unique')).toHaveCount(0)
    } finally {
      await app.close()
    }
  })

  test('클립보드: 시스템 텍스트 → 패널 표시 → 삽입', async () => {
    const unique = `e2e-clip-${Date.now()}`
    const app = await launchSnapNote()
    try {
      await waitForPage(app, 'folded.html')
      await app.evaluate(
        ({ clipboard }, text: string) => {
          clipboard.writeText(text)
        },
        unique
      )
      await new Promise((r) => setTimeout(r, 2500))
      const folded = await waitForPage(app, 'folded.html')
      await folded.getByTestId('folded-new-memo').click()
      const edit = await waitForPage(app, 'edit.html')
      const ta = edit.locator('.editor-line-textarea').first()
      await ta.click()
      await edit.getByTestId('clipboard-panel-trigger').click()
      await expect(edit.getByText(unique)).toBeVisible({ timeout: 15_000 })
      /** `#edit-popover-root` 가 `aria-hidden` 이라 role 기반 탐색이 막힐 수 있음 */
      await edit
        .locator('.clipboard-panel button[aria-label="삽입"]')
        .first()
        .click({ force: true })
      await expect(ta).toHaveValue(new RegExp(unique.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    } finally {
      await app.close()
    }
  })

  test('전역 단축키와 동일 토글 경로: 메인에서 toggleFolded (E2E)', async () => {
    const app = await launchSnapNote()
    try {
      await waitForPage(app, 'folded.html')
      await expectFoldedVisibility(app, true)
      await e2eToggleFoldedFromMain(app)
      await expectFoldedVisibility(app, false)
      await e2eToggleFoldedFromMain(app)
      await expectFoldedVisibility(app, true)
    } finally {
      await app.close()
    }
  })
})