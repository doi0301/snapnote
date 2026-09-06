/** 편집창 입력 단축키 회귀 테스트 */
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

/** 제목 줄 아래 빈 본문 줄(칸)을 만들고 그 칸에 포커스를 둔다 — Shift+Enter = 다음 칸 */
async function focusEmptyBodyLine(page: Page): Promise<void> {
  const first = page.locator('.editor-line-textarea').first()
  await first.click()
  await first.fill('제목')
  await page.keyboard.press('End')
  await page.keyboard.press('Shift+Enter')
  await page.waitForTimeout(200)
}

test.describe('편집창 입력 단축키', () => {
  test('"-" 뒤 공백은 가운뎃점 목록으로 바뀌지 않는다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await focusEmptyBodyLine(edit)
      await edit.keyboard.type('- 항목')
      await edit.waitForTimeout(300)

      const value = await edit.locator('.editor-line-textarea').nth(1).inputValue()
      expect(value).toBe('- 항목')
    } finally {
      await app.close()
    }
  })

  test('"---" 만 입력하면 Enter 없이 그 칸에 구분선을 달고 칸은 계속 편집할 수 있다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await focusEmptyBodyLine(edit)
      const before = await edit.locator('.editor-line-textarea').count()

      await edit.keyboard.type('---')
      await edit.waitForTimeout(400)

      // 구분선이 생기고, `---` 텍스트는 남지 않는다
      await expect(edit.locator('.editor-line-divider')).toHaveCount(1)
      expect(await edit.locator('.editor-line-textarea').nth(1).inputValue()).toBe('')

      // 새 줄을 만들지 않고 그 칸에 그대로 머문다 — 이어서 입력할 수 있어야 한다
      expect(await edit.locator('.editor-line-textarea').count()).toBe(before)
      await edit.keyboard.type('구분선 아래 내용')
      await edit.waitForTimeout(300)
      expect(await edit.locator('.editor-line-textarea').nth(1).inputValue()).toBe('구분선 아래 내용')
      await expect(edit.locator('.editor-line-divider')).toHaveCount(1)
    } finally {
      await app.close()
    }
  })
})
