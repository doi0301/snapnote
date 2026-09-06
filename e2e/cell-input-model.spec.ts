/**
 * P2 — 셀(칸) 입력 모델 회귀 테스트.
 *
 * 기본 입력 단위는 한 칸(엑셀 스타일): Enter = 칸 안 줄바꿈, Shift+Enter = 다음 칸.
 * 붙여넣기도 마크다운처럼 보여도 기본은 한 칸에 그대로 들어간다(`autoMarkdownPaste` 설정으로 옛 동작 복원 가능).
 * `---` 는 Enter 없이 입력 즉시 그 칸을 구분선으로 바꾼다.
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

async function pasteText(page: Page, index: number, text: string): Promise<void> {
  await page.evaluate(
    ({ i, t }) => {
      const ta = document.querySelectorAll('.editor-line-textarea')[i] as HTMLTextAreaElement
      ta.focus()
      const dt = new DataTransfer()
      dt.setData('text/plain', t)
      ta.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
      )
    },
    { i: index, t: text }
  )
  await page.waitForTimeout(300)
}

test.describe('셀(칸) 입력 모델', () => {
  test('Enter 는 칸을 나누지 않고 칸 안에서 줄바꿈만 한다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      const first = edit.locator('.editor-line-textarea').first()
      await first.click()
      await edit.keyboard.type('첫째줄')
      await edit.keyboard.press('Enter')
      await edit.keyboard.type('둘째줄')
      await edit.waitForTimeout(300)

      expect(await edit.locator('.editor-line-textarea').count()).toBe(1)
      expect(await first.inputValue()).toBe('첫째줄\n둘째줄')
    } finally {
      await app.close()
    }
  })

  test('Shift+Enter 는 다음 칸으로 넘어간다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      const first = edit.locator('.editor-line-textarea').first()
      await first.click()
      await edit.keyboard.type('제목')
      await edit.keyboard.press('Shift+Enter')
      await edit.keyboard.type('본문')
      await edit.waitForTimeout(300)

      expect(await edit.locator('.editor-line-textarea').count()).toBe(2)
      expect(await edit.locator('.editor-line-textarea').nth(0).inputValue()).toBe('제목')
      expect(await edit.locator('.editor-line-textarea').nth(1).inputValue()).toBe('본문')
    } finally {
      await app.close()
    }
  })

  test('붙여넣기는 기본적으로 마크다운처럼 보여도 한 칸에 그대로 들어간다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await edit.locator('.editor-line-textarea').first().click()
      await pasteText(edit, 0, '# Heading\n- [ ] todo\nplain body')

      expect(await edit.locator('.editor-line-textarea').count()).toBe(1)
      expect(await edit.locator('.editor-line-textarea').first().inputValue()).toBe(
        '# Heading\n- [ ] todo\nplain body'
      )
    } finally {
      await app.close()
    }
  })

  test('autoMarkdownPaste 설정을 켜면 붙여넣기가 다시 마크다운을 여러 칸으로 분해한다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await edit.evaluate(async () => {
        await window.snapnote.settings.update({ autoMarkdownPaste: true })
      })
      await edit.waitForTimeout(200)
      await edit.locator('.editor-line-textarea').first().click()
      await pasteText(edit, 0, '# Heading\nbody line')

      expect(await edit.locator('.editor-line-textarea').count()).toBeGreaterThan(1)
    } finally {
      await app.close()
    }
  })

  test('"---" 만 입력하면 Enter 없이 즉시 그 칸이 구분선이 된다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      const first = edit.locator('.editor-line-textarea').first()
      await first.click()
      await edit.keyboard.type('---')
      await edit.waitForTimeout(300)

      await expect(edit.locator('.editor-line-divider')).toHaveCount(1)
      expect(await first.inputValue()).toBe('')
    } finally {
      await app.close()
    }
  })
})
