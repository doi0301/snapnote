/**
 * P3 (1/2, 재설계) — 섹션 범위(들여쓰기 기반) · 색상 회귀 테스트.
 *
 * 섹션 범위: 타이틀보다 들여쓰기가 깊은 줄들이 연속되는 동안만 그 섹션에 속한다.
 * 타이틀에서 Shift+Enter 로 만든 새 칸은 자동으로 한 단계 더 들여써져 시작하고,
 * Shift+Tab 으로 타이틀 레벨까지 내어쓰면 그 줄부터는 섹션에서 빠진다. 다음 섹션
 * 타이틀을 만나면 들여쓰기와 무관하게 항상 끊긴다(중첩 없음).
 *
 * 섹션 색상: 섹션 타이틀 행의 작은 원형 아이콘을 누르면 드롭다운으로 하이라이트
 * 팔레트(7색)를 재사용해 배경색을 고를 수 있다.
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

/** 제목 줄(맨 첫 줄)을 그대로 섹션 타이틀로 만든다 (Ctrl+`) */
async function makeSectionTitle(page: Page): Promise<void> {
  const first = page.locator('.editor-line-textarea').first()
  await first.click()
  await first.fill('섹션 A')
  await page.keyboard.press('Control+`')
  await page.waitForTimeout(200)
}

function indentLevels(page: Page): Promise<number[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('.editor-line')).map((el) => {
      const m = Array.from(el.classList)
        .find((c) => c.startsWith('editor-line--level-'))
        ?.replace('editor-line--level-', '')
      return m ? Number(m) : 0
    })
  )
}

function lineValues(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('.editor-line-textarea')).map(
      (el) => (el as HTMLTextAreaElement).value
    )
  )
}

test.describe('섹션 범위 (들여쓰기 기반)', () => {
  test('타이틀에서 Shift+Enter 로 만든 줄은 자동으로 한 단계 들여써져 섹션에 포함된다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await makeSectionTitle(edit)
      await edit.keyboard.press('Shift+Enter')
      await edit.keyboard.type('본문')
      await edit.waitForTimeout(200)

      expect(await indentLevels(edit)).toEqual([0, 1])
      await expect(edit.locator('.editor-section-fold-btn')).toHaveCount(1)
      await edit.locator('.editor-section-fold-btn').click()
      await edit.waitForTimeout(200)

      expect(await edit.locator('.editor-line-textarea').count()).toBe(1)
    } finally {
      await app.close()
    }
  })

  test('Shift+Tab 으로 타이틀 레벨까지 내어쓰면 그 줄부터 섹션에서 빠진다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await makeSectionTitle(edit)
      await edit.keyboard.press('Shift+Enter')
      await edit.keyboard.type('본문 1')
      await edit.keyboard.press('Shift+Enter')
      await edit.keyboard.type('본문 2')
      // 본문 2 는 본문 1 의 들여쓰기를 물려받아 1단 — Shift+Tab 으로 0단(타이틀 레벨)까지 내어쓴다
      await edit.keyboard.press('Shift+Tab')
      await edit.waitForTimeout(200)

      expect(await indentLevels(edit)).toEqual([0, 1, 0])

      // 섹션(index 0)을 접으면 본문 1(index 1)만 숨고, 내어쓴 본문 2(index 2)는 남는다
      await edit.locator('.editor-section-fold-btn').click()
      await edit.waitForTimeout(200)
      expect(await lineValues(edit)).toEqual(['섹션 A', '본문 2'])
    } finally {
      await app.close()
    }
  })

  test('다음 섹션 타이틀은 들여쓰기와 무관하게 항상 범위를 끊는다 (중첩 없음)', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await makeSectionTitle(edit)
      await edit.keyboard.press('Shift+Enter')
      await edit.keyboard.type('본문 A')
      await edit.keyboard.press('Shift+Enter')
      await edit.keyboard.type('섹션 B')
      await edit.keyboard.press('Tab') // 일부러 A의 본문보다 더 깊게 들여씀
      await edit.keyboard.press('Control+`')
      await edit.waitForTimeout(200)

      expect(await indentLevels(edit)).toEqual([0, 1, 2])

      // 섹션 A(index 0)를 접어도 섹션 B 타이틀(index 2)은 숨지 않는다
      await edit.locator('.editor-section-fold-btn').first().click()
      await edit.waitForTimeout(200)
      expect(await lineValues(edit)).toEqual(['섹션 A', '섹션 B'])
    } finally {
      await app.close()
    }
  })

  test('본문이 없으면(들여쓰기 안 됨) 접기 버튼이 보이지 않는다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await makeSectionTitle(edit)
      await expect(edit.locator('.editor-section-fold-btn')).toHaveCount(0)
    } finally {
      await app.close()
    }
  })

  test('섹션 본문 중간에 붙여넣으면(autoMarkdownPaste 켜짐) 새 줄이 자동으로 보정되어 섹션이 끊기지 않는다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await edit.evaluate(async () => {
        await window.snapnote.settings.update({ autoMarkdownPaste: true })
      })
      await edit.waitForTimeout(150)
      await makeSectionTitle(edit)
      await edit.keyboard.press('Shift+Enter')
      await edit.keyboard.type('본문 A')
      await edit.keyboard.press('Shift+Enter')
      await edit.keyboard.type('본문 B')
      await edit.waitForTimeout(200)
      expect(await indentLevels(edit)).toEqual([0, 1, 1])

      // 본문 A 끝에 마크다운 두 줄을 붙여넣는다 — 본문 A 와 본문 B 사이에 새 줄이 끼어든다
      await edit.locator('.editor-line-textarea').nth(1).click()
      await edit.keyboard.press('End')
      await edit.evaluate(() => {
        const ta = document.querySelectorAll('.editor-line-textarea')[1] as HTMLTextAreaElement
        ta.focus()
        const dt = new DataTransfer()
        dt.setData('text/plain', '# 붙여넣은 제목\n붙여넣은 본문')
        ta.dispatchEvent(
          new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
        )
      })
      await edit.waitForTimeout(300)

      const levels = await indentLevels(edit)
      expect(levels.length).toBeGreaterThan(3)
      expect(levels[0]).toBe(0) // 타이틀만 0단
      for (let i = 1; i < levels.length; i++) {
        expect(levels[i]!).toBeGreaterThan(0)
      }

      // 접으면 타이틀만 남고 (붙여넣은 줄 + 원래 본문 B 포함) 나머지는 전부 숨는다
      await edit.locator('.editor-section-fold-btn').click()
      await edit.waitForTimeout(200)
      expect(await edit.locator('.editor-line-textarea').count()).toBe(1)
    } finally {
      await app.close()
    }
  })
})

test.describe('섹션 색상', () => {
  test('섹션 타이틀 행의 원형 아이콘을 눌러 드롭다운에서 색을 고른다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await makeSectionTitle(edit)

      await expect(edit.locator('.editor-section-color-btn')).toHaveCount(1)
      await edit.locator('.editor-section-color-btn').click()
      await expect(edit.locator('.editor-section-color-popover')).toBeVisible()

      await edit.locator('.editor-section-color-popover .format-hl-swatch--green').click()
      await edit.waitForTimeout(200)

      await expect(edit.locator('.editor-line--section-green')).toHaveCount(1)
      await expect(edit.locator('.editor-section-color-popover')).toHaveCount(0)
    } finally {
      await app.close()
    }
  })

  test('팝오버 바깥을 클릭하면 색을 고르지 않고 닫힌다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await makeSectionTitle(edit)
      await edit.locator('.editor-section-color-btn').click()
      await expect(edit.locator('.editor-section-color-popover')).toBeVisible()

      await edit.locator('.editor-bottom-bar').click({ position: { x: 5, y: 5 } })
      await edit.waitForTimeout(200)

      await expect(edit.locator('.editor-section-color-popover')).toHaveCount(0)
      await expect(edit.locator('.editor-line--section-green')).toHaveCount(0)
    } finally {
      await app.close()
    }
  })
})
