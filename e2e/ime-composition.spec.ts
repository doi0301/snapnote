/**
 * 한글 IME 조합 경로 회귀 테스트.
 *
 * 조합(composition) 중에 붙여넣기·Enter 가 들어오면 `compositionend` 가 오지 않아
 * 에디터가 조합 상태에 갇히고, 그 줄은 높이 재계산이 영구히 멈추거나
 * Enter 가 줄 분할 대신 `\n` 을 본문에 흘린다.
 *
 * Playwright 의 `keyboard.type()` 은 조합 이벤트를 만들지 않으므로
 * CDP `Input.imeSetComposition` 으로 실제 조합 상태를 재현한다.
 */
import { existsSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import type { CDPSession, Page } from '@playwright/test'
import { launchSnapNote, mainScript, waitForPage } from './helpers'

test.beforeAll(() => {
  if (!existsSync(mainScript)) {
    throw new Error(
      '빌드 산출물이 없습니다. E2E 전에 `npm run build` 를 실행하세요. (기대 경로: out/main/index.js)'
    )
  }
})

/** 한 글자를 조합 → 확정 (조합 이벤트를 실제로 발생시킨다) */
async function typeComposed(page: Page, cdp: CDPSession, chars: string[]): Promise<void> {
  for (const ch of chars) {
    await cdp.send('Input.imeSetComposition', {
      text: ch,
      selectionStart: ch.length,
      selectionEnd: ch.length
    })
    await page.waitForTimeout(20)
    await cdp.send('Input.insertText', { text: ch })
    await page.waitForTimeout(20)
  }
}

/** 확정하지 않고 조합 상태로 열어둔다 */
async function startComposing(cdp: CDPSession, ch: string): Promise<void> {
  await cdp.send('Input.imeSetComposition', {
    text: ch,
    selectionStart: ch.length,
    selectionEnd: ch.length
  })
}

async function newEditWindow(app): Promise<Page> {
  const folded = await waitForPage(app, 'folded.html')
  await folded.getByTestId('folded-new-memo').click()
  return waitForPage(app, 'edit.html')
}

/** 제목 줄 아래에 본문 칸 하나를 만들고 그 칸에 포커스를 둔다 — Shift+Enter = 다음 칸 */
async function focusBodyLine(page: Page): Promise<void> {
  const first = page.locator('.editor-line-textarea').first()
  await first.click()
  await first.fill('제목')
  await page.keyboard.press('End')
  await page.keyboard.press('Shift+Enter')
  await page.waitForTimeout(200)
}

function lineMetrics(page: Page, index: number) {
  return page.evaluate((i) => {
    const ta = document.querySelectorAll('.editor-line-textarea')[i] as HTMLTextAreaElement
    return {
      value: ta?.value ?? '',
      clientHeight: ta?.clientHeight ?? 0,
      scrollHeight: ta?.scrollHeight ?? 0
    }
  }, index)
}

test.describe('IME 조합 중 편집', () => {
  test('조합 중 여러 줄을 붙여넣어도 그 줄 높이가 내용에 맞게 늘어난다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      const cdp = await edit.context().newCDPSession(edit)
      await focusBodyLine(edit)
      await typeComposed(edit, cdp, ['한', '글'])

      // 조합을 확정하지 않은 채로 붙여넣기 — compositionend 가 오지 않는 경로
      await startComposing(cdp, '가')
      await edit.waitForTimeout(50)
      await edit.evaluate(() => {
        const ta = document.querySelectorAll('.editor-line-textarea')[1] as HTMLTextAreaElement
        const dt = new DataTransfer()
        dt.setData('text/plain', '붙여A\n붙여B\n붙여C\n붙여D\n붙여E')
        ta.dispatchEvent(
          new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
        )
      })
      await edit.waitForTimeout(700)

      const m = await lineMetrics(edit, 1)
      expect(m.value).toContain('붙여E')
      // 내용이 5줄인데 높이가 1줄에 묶여 있으면 잘려 보인다
      expect(m.scrollHeight - m.clientHeight).toBeLessThanOrEqual(2)
    } finally {
      await app.close()
    }
  })

  test('조합 중 Enter 는 칸을 나누지 않고 그 칸 안에 줄바꿈을 남긴다 (셀 입력 모델)', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      const cdp = await edit.context().newCDPSession(edit)
      await focusBodyLine(edit)
      await typeComposed(edit, cdp, ['가', '나', '다'])

      const before = await edit.locator('.editor-line-textarea').count()

      // 조합을 열어둔 채 Enter
      await startComposing(cdp, '라')
      await edit.keyboard.press('End')
      await edit.keyboard.press('Enter')
      await edit.waitForTimeout(500)

      const after = await edit.locator('.editor-line-textarea').count()
      const m = await lineMetrics(edit, 1)

      expect(m.value).toContain('\n')
      expect(after).toBe(before)
    } finally {
      await app.close()
    }
  })

  test('조합 중 Shift+Enter 는 본문에 개행을 흘리지 않고 다음 칸으로 분할한다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      const cdp = await edit.context().newCDPSession(edit)
      await focusBodyLine(edit)
      await typeComposed(edit, cdp, ['가', '나', '다'])

      const before = await edit.locator('.editor-line-textarea').count()

      // 조합을 열어둔 채 Shift+Enter
      await startComposing(cdp, '라')
      await edit.keyboard.press('End')
      await edit.keyboard.press('Shift+Enter')
      await edit.waitForTimeout(500)

      const after = await edit.locator('.editor-line-textarea').count()
      const m = await lineMetrics(edit, 1)

      expect(m.value).not.toContain('\n')
      expect(after).toBe(before + 1)
    } finally {
      await app.close()
    }
  })
})
