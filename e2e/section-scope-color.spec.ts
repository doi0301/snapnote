/**
 * P3 (1/2) — 섹션 범위 · 색상 회귀 테스트.
 *
 * 섹션 범위: 기본은 'until-next'(아래 줄 거느림). 좌측 아이콘으로 'self-only'(이 줄만)로
 * 전환할 수 있고, self-only 에서는 접기 버튼이 사라지고 접힘으로 아무 줄도 숨지 않는다.
 * 섹션 색상: 하이라이트 팔레트(7색)를 재사용해 섹션 타이틀 행 배경색을 바꿀 수 있다.
 */
import { existsSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { launchSnapNote, mainScript, waitForPage } from './helpers'

test.beforeAll(() => {
  if (!existsSync(mainScript)) {
    throw new Error(
      '빌드 산출물이 없습니다. E2E 전에 `npm run build` 를 실행하세요. (기대 경로: out/main/index.js)'
    )
  }
})

async function newEditWindow(app): Promise<Page> {
  const folded = await waitForPage(app, 'folded.html')
  await folded.getByTestId('folded-new-memo').click()
  return waitForPage(app, 'edit.html')
}

/** 제목 줄에서 Ctrl+` 로 섹션 타이틀을 켠다 */
async function makeSectionTitle(page: Page): Promise<void> {
  const first = page.locator('.editor-line-textarea').first()
  await first.click()
  await first.fill('섹션 A')
  await page.keyboard.press('Control+`')
  await page.waitForTimeout(200)
}

test.describe('섹션 범위', () => {
  test('기본(until-next)은 접기 버튼이 있고, 접으면 아래 줄이 숨는다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await makeSectionTitle(edit)
      await edit.keyboard.press('Shift+Enter')
      await edit.keyboard.type('본문')

      await expect(edit.locator('.editor-section-fold-btn')).toHaveCount(1)
      await edit.locator('.editor-section-fold-btn').click()
      await edit.waitForTimeout(200)

      expect(await edit.locator('.editor-line-textarea').count()).toBe(1)
    } finally {
      await app.close()
    }
  })

  test('좌측 아이콘으로 self-only 전환하면 접기 버튼이 사라진다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await makeSectionTitle(edit)
      await edit.keyboard.press('Shift+Enter')
      await edit.keyboard.type('본문')

      await edit.locator('.editor-section-scope-btn').click()
      await edit.waitForTimeout(200)

      await expect(edit.locator('.editor-section-fold-btn')).toHaveCount(0)
      expect(await edit.locator('.editor-line-textarea').count()).toBe(2)
    } finally {
      await app.close()
    }
  })

  test('self-only 섹션 뒤에도 다음 섹션 없이 본문이 그대로 보인다 (숨김 없음)', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await makeSectionTitle(edit)
      await edit.locator('.editor-section-scope-btn').click()
      await edit.waitForTimeout(150)
      await edit.keyboard.press('Shift+Enter')
      await edit.keyboard.type('본문 1')
      await edit.keyboard.press('Shift+Enter')
      await edit.keyboard.type('본문 2')
      await edit.waitForTimeout(200)

      expect(await edit.locator('.editor-line-textarea').count()).toBe(3)
      await expect(edit.locator('.editor-line-textarea').nth(1)).toBeVisible()
      await expect(edit.locator('.editor-line-textarea').nth(2)).toBeVisible()
    } finally {
      await app.close()
    }
  })
})

test.describe('섹션 색상', () => {
  test('더보기 모달에서 색을 고르면 섹션 타이틀 행에 색 클래스가 붙는다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await makeSectionTitle(edit)

      if ((await edit.locator('.format-toolbar-btn--more-tools').count()) === 0) {
        await edit.locator('.format-toolbar-btn--more-tools').first().click()
      } else {
        await edit.locator('.format-toolbar-btn--more-tools').click()
      }
      await edit.waitForTimeout(200)

      await expect(edit.locator('.format-toolbar-modal-hl-swatches').last()).toBeVisible()
      await edit.locator('.format-hl-swatch--green').last().click()
      await edit.waitForTimeout(200)

      await expect(edit.locator('.editor-line--section-green')).toHaveCount(1)
    } finally {
      await app.close()
    }
  })
})
