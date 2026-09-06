/**
 * 창 최소화(접기) → 복원 시 스크롤 위치 리셋 회귀 테스트.
 *
 * "접기"는 `BrowserWindow.minimize()` 로 창을 실제로 닫지 않고 최소화만 하므로
 * React 인스턴스가 유지되고, 접힐 때의 스크롤 위치가 그대로 남는다.
 * 여러 줄 제목 + 긴 본문을 붙여넣으면 자동 스크롤로 제목이 sticky(한 줄 미리보기)
 * 상태가 되는데, 이 상태에서 접었다가 다시 열면 스크롤이 최상단으로 돌아오지 않아
 * 제목이 계속 한 줄로 잘려 보인다. `EDIT_WINDOW_RESTORED` IPC로 복원 시 스크롤을
 * 최상단으로 리셋해 이를 방지한다.
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

async function pasteMultiline(page: Page, index: number, text: string): Promise<void> {
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

function titleMetrics(page: Page) {
  return page.evaluate(() => {
    const ta = document.querySelectorAll('.editor-line-textarea')[0] as HTMLTextAreaElement
    const line = ta?.closest('.editor-line') as HTMLElement | null
    return {
      clientHeight: ta?.clientHeight ?? 0,
      scrollHeight: ta?.scrollHeight ?? 0,
      stuck: line?.classList.contains('editor-line--stuck') ?? false
    }
  })
}

test('제목이 sticky 상태로 잘린 채 접혔다 다시 열려도 스크롤이 최상단으로 복원된다', async () => {
  const app = await launchSnapNote()
  try {
    const folded = await waitForPage(app, 'folded.html')
    await folded.getByTestId('folded-new-memo').click()
    const edit = await waitForPage(app, 'edit.html')
    const firstTa = edit.locator('.editor-line-textarea').first()
    await firstTa.click()

    // 제목을 여러 줄로 만들고, 본문에 긴 내용을 붙여 자동 스크롤을 유도한다
    await pasteMultiline(edit, 0, '제목줄A\n제목줄B\n제목줄C\n제목줄D\n제목줄E')
    await edit.keyboard.press('End')
    await edit.keyboard.press('Shift+Enter')
    await edit.waitForTimeout(150)
    const manyLines = Array.from({ length: 60 }, (_, i) => `본문줄${i}`).join('\n')
    await pasteMultiline(edit, 1, manyLines)

    // 자동 스크롤로 제목이 sticky(한 줄) 상태가 된 것을 확인
    const beforeFold = await titleMetrics(edit)
    expect(beforeFold.stuck).toBe(true)

    // 접기(최소화) → 폴디드에서 다시 열기 (React 인스턴스는 유지된 채 창만 복원됨)
    await edit.getByTestId('edit-fold-btn').click()
    await folded.bringToFront()
    const slot = folded.getByTestId('folded-memo-slot').first()
    await expect(slot).toBeVisible({ timeout: 20_000 })
    await slot.locator('button[title="편집 열기"]').click()
    const editAgain = await waitForPage(app, 'edit.html', 20_000)
    await editAgain.waitForTimeout(400)

    const afterRestore = await titleMetrics(editAgain)
    expect(afterRestore.stuck).toBe(false)
    expect(afterRestore.scrollHeight - afterRestore.clientHeight).toBeLessThanOrEqual(2)
  } finally {
    await app.close()
  }
})
